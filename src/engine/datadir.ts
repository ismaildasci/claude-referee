// Where receipts, cache and results live, and the hashed project id that groups them.
// Order: --data-dir, CLAUDE_PLUGIN_DATA, REFEREE_DATA_DIR, then <config dir>/plugins/data/<plugin id>.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { KIT, MARKETPLACE, type Env } from "./config.ts";

export function pluginDataId(): string {
  return `${KIT}@${MARKETPLACE}`.replace(/[^A-Za-z0-9_-]/g, "-");
}

export function resolveDataDir(env: Env, home: string, cwd: string, flag?: string): string {
  if (flag) return resolve(cwd, flag);
  const fromEnv = env["CLAUDE_PLUGIN_DATA"]?.trim() || env["REFEREE_DATA_DIR"]?.trim();
  if (fromEnv) return fromEnv;
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join(home, ".claude");
  return join(configDir, "plugins", "data", pluginDataId());
}

export function projectRoot(cwd: string): string {
  let root = cwd;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim() || cwd;
  } catch {
    root = cwd;
  }
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}

export function projectId(cwd: string): string {
  return createHash("sha256").update(projectRoot(cwd)).digest("hex").slice(0, 12);
}

export function dirSize(dir: string): number {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(path);
    else if (entry.isFile()) total += statSync(path).size;
  }
  return total;
}

export function tildify(path: string, home: string): string {
  return home && path.startsWith(home) ? "~" + path.slice(home.length) : path;
}
