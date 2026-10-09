// Where receipts, cache and results live, and the hashed project id that groups them.
// Order: --data-dir, CLAUDE_PLUGIN_DATA, REFEREE_DATA_DIR, then <config dir>/plugins/data/<plugin id>.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
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

// What kind of checkout a command ran in: a fixed word, never the path (docs/decisions/checkout-class.md).
export const CHECKOUT_CLASSES = ["main", "linked", "claude-worktree", "no-checkout"] as const;
export type CheckoutClass = (typeof CHECKOUT_CLASSES)[number];

export function checkoutClass(cwd: string): CheckoutClass {
  let out: string;
  try {
    out = execFileSync("git", ["rev-parse", "--show-toplevel", "--git-dir", "--git-common-dir"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 });
  } catch {
    return "no-checkout";
  }
  const [top = "", gitDir = "", common = ""] = out.split("\n");
  if (top === "") return "no-checkout";
  const real = (path: string): string => {
    try {
      return realpathSync.native(resolve(cwd, path));
    } catch {
      return resolve(cwd, path);
    }
  };
  // A main checkout, and a submodule, has its git dir as the common dir; a linked worktree has its own git dir under the common one.
  if (real(gitDir) === real(common)) return "main";
  return real(top).includes(`${sep}.claude${sep}worktrees${sep}`) ? "claude-worktree" : "linked";
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
