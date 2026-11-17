// Runs one detected check for `done --run` (docs/decisions/done-run.md): only a command that detect-checks found, in the manifest folder, never an arbitrary string.
// The shell writes stdout and stderr to one pipe so their order holds, gets no stdin and no key variables; the exit code comes from the shell's exit, not from the pipe closing.
// A timeout kills the whole process group and reports 124; if this process is stopped, the group dies with it. Output over the cap keeps its head and its tail; the evidence reader clips further.
// scopedCheck (docs/decisions/done-run-scoped.md): `<tool> <paths>` for eslint or vitest, only when a package.json script runs the tool with no config-changing flag and its binary is in the project's node_modules; arguments are existing paths inside the root, passed single-quoted, never flags.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import type { Env } from "./config.ts";
import { RefereeError } from "./errors.ts";
import type { Check } from "./detect-checks.ts";

const HEAD_MAX = 1_000_000;
const TAIL_MAX = 4_000_000;
export const KEY_VARIABLES = /^(?:TYPESAFE_API_KEY(?:_CMD)?|EVAL_TYPESAFE_API_KEY|REFEREE_BASE_URL_KEY|CLAUDE_PLUGIN_OPTION_\w*(?:KEY|SECRET|TOKEN)\w*)$/;
const GRACE_MS = 1500;
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

export const DEFAULT_CRITERIA: Readonly<Record<string, string>> = {
  test: "all tests pass",
  typecheck: "the typecheck passes",
  lint: "lint is clean",
  build: "the build succeeds",
  check: "all checks pass",
  ci: "all checks pass",
  verify: "all checks pass",
};

export interface CheckRun {
  readonly output: string;
  readonly code: number;
  readonly timedOut: boolean;
}

const bad = (message: string, next_step: string): RefereeError => new RefereeError("bad_input", message, { next_step });

export function pickCheck(spec: string, set: { checks: readonly Check[] } | null): Check {
  const pipe = "Pipe the check's output instead: <check> 2>&1 | claude-referee done --criteria \"...\" --evidence -";
  if (!set || set.checks.length === 0) throw bad("No check was detected here (a package.json or composer.json script named test, lint, typecheck, build, check, ci or verify; Cargo.toml; go.mod).", pipe);
  const runnable = set.checks.filter((c) => c.runnable);
  const found = runnable.find((c) => c.family === spec.trim() || c.command === spec.trim());
  if (found) return found;
  const list = runnable.map((c) => `${c.family} = ${c.command}`).join("; ");
  throw bad(`--run takes a detected check by family or exact command, not ${JSON.stringify(spec.slice(0, 60))}.`, runnable.length > 0 ? `Detected here: ${list}. ${pipe}` : pipe);
}

const SCOPED_TOOLS: ReadonlyMap<string, { family: "lint" | "test"; args: string; refuse: ReadonlySet<string> }> = new Map([
  ["eslint", { family: "lint" as const, args: "", refuse: new Set(["-c", "--config", "--no-eslintrc", "--no-config-lookup", "--rulesdir", "--resolve-plugins-relative-to", "--parser", "--parser-options", "--plugin", "--rule", "--env", "--global", "--flag"]) }],
  ["vitest", { family: "test" as const, args: " run", refuse: new Set(["-c", "--config", "-r", "--root", "--dir", "--project", "--workspace", "--environment"]) }],
]);
export const SCOPED_PATHS_MAX = 50;
export const RAN_MAX = 80;
const LISTED_MAX = 5;
const WRAPPERS: ReadonlySet<string> = new Set(["npx", "bunx", "pnpx"]);

export interface ScopedPath {
  readonly typed: string;
  readonly real: string;
  readonly dir: boolean;
}

export interface ScopedCheck extends Check {
  readonly tool: string;
  readonly dir: string;
  readonly shown: string;
  readonly scope: readonly ScopedPath[];
  readonly criterion: string;
  readonly silent?: boolean;
}

const quote = (text: string): string => `'${text.replaceAll("'", "'\\''")}'`;

function scriptBodies(dir: string): string[] {
  try {
    const raw = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { scripts?: unknown };
    return typeof raw.scripts === "object" && raw.scripts !== null && !Array.isArray(raw.scripts) ? Object.values(raw.scripts).filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// The flags a script passes to the tool, per shell segment whose command word is the tool (bare, by path, or behind npx, bunx, pnpx or `pnpm exec`); null when no script runs it.
export function toolFlags(bodies: readonly string[], tool: string): string[] | null {
  let used = false;
  const flags: string[] = [];
  for (const segment of bodies.flatMap((body) => body.split(/&&|\|\||[;|&\n]/))) {
    const words = segment.trim().split(/\s+/).filter((w) => !/^\w+=/.test(w));
    const at = WRAPPERS.has(words[0] ?? "") ? 1 : words[0] === "pnpm" && words[1] === "exec" ? 2 : 0;
    const command = words[at] ?? "";
    if (command !== tool && !command.endsWith(`/${tool}`)) continue;
    used = true;
    flags.push(...words.slice(at + 1).filter((w) => w.startsWith("-")).map((w) => w.split("=")[0] as string));
  }
  return used ? flags : null;
}

function inside(path: string, root: string): string | null {
  try {
    const real = realpathSync(path);
    const base = realpathSync(root);
    return real === base || real.startsWith(base.endsWith(sep) ? base : base + sep) ? real : null;
  } catch {
    return null;
  }
}

// Whether a criterion names the scope of a run: a path-like word of it (with a "/" or a ".") that is a typed path, the tail of a covered path on a segment boundary, or a path under a covered folder.
// A bare word never counts ("tests" is not the folder tests/), so a criterion about the whole project stays capped.
const PATH_WORD = /[\w@.+\-/\\[\]()~]+/g;

function namesPath(word: string, scope: readonly ScopedPath[]): boolean {
  const token = word.replace(/^[(]+/, "").replace(/[.,;:!?)]+$/, "").replace(/^\.\//, "");
  const bare = token.replace(/\/+$/, "");
  if (bare.length < 3 || !/[./]/.test(token)) return false;
  return scope.some((path) => {
    const tail = path.real === bare || path.real.endsWith(`${sep}${bare}`);
    if (!path.dir) return tail;
    if (tail) return token.includes("/");
    const typed = path.typed.replace(/^\.\//, "").replace(/\/+$/, "");
    return typed !== "" && typed !== "." && token.startsWith(`${typed}/`);
  });
}

export const namesScope = (criterion: string, scope: readonly ScopedPath[]): boolean => (criterion.match(PATH_WORD) ?? []).some((word) => namesPath(word, scope));

// The criterion with the words that name the scope blanked, so a path such as src/a.test.js is not read as a claim about tests.
export const withoutScopeNames = (criterion: string, scope: readonly ScopedPath[]): string => criterion.replace(PATH_WORD, (word) => (namesPath(word, scope) ? " " : word));

// Returns null when the string does not start with a scoped tool, so the caller's own refusal applies; throws bad_input for a scoped string that breaks a rule.
export function scopedCheck(spec: string, cwd: string, root: string): ScopedCheck | null {
  const words = spec.trim().split(/[ \t]+/);
  const tool = words[0] ?? "";
  const known = SCOPED_TOOLS.get(tool);
  if (known === undefined || words.length === 1) return null;
  const whole = 'Run the project\'s whole check instead (--run with its family), or pipe the output: <check> 2>&1 | claude-referee done --criteria "..." --evidence -';
  if (/[\n\r\0]/.test(spec)) throw bad("--run takes one line.", whole);
  const typed = tool === "vitest" && words[1] === "run" ? words.slice(2) : words.slice(1);
  if (typed.length === 0 || typed.length > SCOPED_PATHS_MAX) throw bad(`--run "${tool} <paths>" takes 1 to ${SCOPED_PATHS_MAX} paths.`, whole);
  const flag = typed.find((p) => p.startsWith("-"));
  if (flag !== undefined) throw bad(`--run "${tool} <paths>" takes paths only, not ${JSON.stringify(flag.slice(0, 40))}.`, whole);
  let dir = cwd;
  while (!existsSync(join(dir, "package.json"))) {
    if (dir === root || dirname(dir) === dir) throw bad(`No package.json here, so ${tool} cannot be run on paths.`, whole);
    dir = dirname(dir);
  }
  const flags = toolFlags(scriptBodies(dir), tool);
  if (flags === null) throw bad(`No script in this package.json runs ${tool}, so done will not run it.`, whole);
  const dropped = flags.find((f) => known.refuse.has(f));
  if (dropped !== undefined) throw bad(`A script here runs ${tool} with ${dropped}, which a run on paths would drop, so done will not run it.`, whole);
  let bin: string | undefined;
  for (let d = dir; bin === undefined; d = dirname(d)) {
    const candidate = join(d, "node_modules", ".bin", tool);
    if (existsSync(candidate)) bin = candidate;
    else if (d === root || dirname(d) === d) break;
  }
  if (bin === undefined || inside(bin, root) === null) throw bad(`${tool} is not installed in this project's node_modules.`, whole);
  const scope: ScopedPath[] = [];
  for (const text of typed) {
    const real = existsSync(resolve(cwd, text)) ? inside(resolve(cwd, text), root) : null;
    if (real === null) throw bad(`${JSON.stringify(text.slice(0, 80))} does not exist inside this project.`, whole);
    const isDir = statSync(real).isDirectory();
    if (isDir && flags.includes("--ext")) throw bad(`A script here runs ${tool} with --ext, which a run on a folder would drop; name files, not ${JSON.stringify(text.slice(0, 80))}.`, whole);
    scope.push({ typed: isDir ? `${text.replace(/\/+$/, "")}/` : text, real, dir: isDir });
  }
  const shown = `${tool}${known.args} ${typed.join(" ")}`;
  const visible = scope.map((p) => p.typed).filter((_, i) => `${tool}${known.args} ${typed.slice(0, i + 1).join(" ")}`.length <= RAN_MAX).slice(0, LISTED_MAX);
  const listed = visible.length === 0 ? "the given paths" : `${visible.join(", ")}${scope.length > visible.length ? ` and ${scope.length - visible.length} more` : ""}`;
  const criterion = known.family === "lint" ? `${tool} finds no problems in ${listed}` : `the tests in ${listed} pass`;
  return { family: known.family, command: `${quote(bin)}${known.args} ${typed.map((p) => quote(resolve(cwd, p))).join(" ")}`, runnable: true, tool, dir, shown, scope, criterion };
}

export function runCheck(command: string, cwd: string, env: Env, timeoutMs: number): Promise<CheckRun> {
  const clean = Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined && !KEY_VARIABLES.test(e[0])));
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", `exec 2>&1; ${command}`], { cwd, env: clean, stdio: ["ignore", "pipe", "ignore"], detached: true });
    let head = Buffer.alloc(0);
    let tail: Buffer[] = [];
    let tailSize = 0;
    let omitted = false;
    let timedOut = false;
    let finished = false;
    let grace: NodeJS.Timeout | undefined;
    const killGroup = (): void => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const onSignal = (signal: NodeJS.Signals): void => {
      killGroup();
      process.kill(process.pid, signal);
    };
    process.on("exit", killGroup);
    for (const signal of SIGNALS) process.once(signal, onSignal);
    child.stdout.on("data", (chunk: Buffer) => {
      if (head.length < HEAD_MAX) {
        const take = chunk.subarray(0, HEAD_MAX - head.length);
        head = Buffer.concat([head, take]);
        chunk = chunk.subarray(take.length);
      }
      if (chunk.length === 0) return;
      tail.push(chunk);
      tailSize += chunk.length;
      while (tailSize > TAIL_MAX && tail.length > 1) {
        tailSize -= (tail.shift() as Buffer).length;
        omitted = true;
      }
    });
    const finish = (code: number | null): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(grace);
      process.off("exit", killGroup);
      for (const signal of SIGNALS) process.off(signal, onSignal);
      child.stdout.destroy();
      const output = `${head.toString("utf8")}${omitted ? "\n[… output omitted …]\n" : ""}${Buffer.concat(tail).toString("utf8")}`;
      resolve({ output, code: timedOut ? 124 : (code ?? 1), timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
      grace = setTimeout(() => finish(null), GRACE_MS);
    }, timeoutMs);
    child.on("exit", (code) => {
      grace ??= setTimeout(() => finish(code), GRACE_MS);
    });
    child.on("close", (code) => finish(code));
    child.on("error", () => finish(127));
  });
}
