// Names up to 4 check commands from the nearest manifest (package.json, composer.json, Cargo.toml, go.mod); reads script names only.
// Used by the SessionStart briefing when no area lists checks. Any read or parse error means "no checks".

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const FAMILIES = ["test", "typecheck", "lint", "check", "build", "ci", "verify"] as const;
export const DETECTED_MAX = 4;
const JOINED_MAX = 80;

function scripts(file: string): string[] {
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { scripts?: unknown };
    return typeof raw.scripts === "object" && raw.scripts !== null && !Array.isArray(raw.scripts) ? Object.keys(raw.scripts) : [];
  } catch {
    return [];
  }
}

function pick(names: readonly string[], family: string): string | undefined {
  return names.includes(family) ? family : names.filter((n) => n.startsWith(`${family}:`)).sort()[0];
}

function runner(dir: string): string {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm run";
  if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) return "bun run";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn run";
  return "npm run";
}

function laravel(dir: string): boolean {
  if (existsSync(join(dir, "artisan"))) return true;
  try {
    return "laravel/framework" in ((JSON.parse(readFileSync(join(dir, "composer.json"), "utf8")) as { require?: object }).require ?? {});
  } catch {
    return false;
  }
}

function manifestDir(cwd: string, root: string): string | null {
  for (let dir = cwd; ; dir = dirname(dir)) {
    if (["package.json", "composer.json", "Cargo.toml", "go.mod", "artisan"].some((f) => existsSync(join(dir, f)))) return dir;
    if (dir === root || dirname(dir) === dir) return null;
  }
}

function checksIn(dir: string): string[] {
  const found = new Map<string, string>();
  const composer = scripts(join(dir, "composer.json"));
  const npm = scripts(join(dir, "package.json"));
  for (const family of FAMILIES) {
    const fromComposer = pick(composer, family);
    const fromNpm = pick(npm, family);
    if (fromComposer) found.set(family, `composer ${fromComposer}`);
    else if (family === "test" && laravel(dir)) found.set(family, "php artisan test");
    else if (fromNpm) found.set(family, `${runner(dir)} ${fromNpm}`);
    else if (family === "test" && existsSync(join(dir, "Cargo.toml"))) found.set(family, "cargo test");
    else if (family === "test" && existsSync(join(dir, "go.mod"))) found.set(family, "go test ./...");
  }
  return FAMILIES.flatMap((f) => found.get(f) ?? []);
}

// Only when exactly one immediate subdirectory of the root has checks; several would mean guessing the subproject.
function onlySubdir(root: string): { name: string; commands: string[] } | null {
  const isDir = (d: string): boolean => {
    try {
      return statSync(join(root, d)).isDirectory();
    } catch {
      return false;
    }
  };
  let names: string[];
  try {
    names = readdirSync(root).filter((d) => !d.startsWith(".") && d !== "node_modules" && d !== "vendor" && isDir(d));
  } catch {
    return null;
  }
  const hits = names.map((name) => ({ name, commands: checksIn(join(root, name)) })).filter((h) => h.commands.length > 0);
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

export function detectChecks(cwd: string, root: string): string[] {
  const dir = manifestDir(cwd, root);
  let commands: string[];
  if (dir) commands = checksIn(dir);
  else {
    const sub = onlySubdir(root);
    const cd = sub ? (/^[\w.-]+$/.test(sub.name) ? sub.name : JSON.stringify(sub.name)) : "";
    commands = sub ? sub.commands.map((c) => `cd ${cd} && ${c}`) : [];
  }
  const out: string[] = [];
  for (const command of commands) {
    if (out.length === DETECTED_MAX || [...out, command].join("; ").length > JOINED_MAX) break;
    out.push(command);
  }
  return out;
}
