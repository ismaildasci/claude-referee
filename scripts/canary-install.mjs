// Canary: installs this checkout as a plugin into an isolated CLAUDE_CONFIG_DIR and HOME, then checks the installed CLI version.
// Exit 0 pass, 1 fail, 2 skipped (no claude binary). No secrets or API key are read or needed. Use --claude BIN, --repo DIR.

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ID = "claude-referee@claude-referee";
const KEYS = ["TYPESAFE_API_KEY", "EVAL_TYPESAFE_API_KEY", "TYPESAFE_API_KEY_CMD", "REFEREE_DATA_DIR"];

export function assessInstall({ list, id = ID, expectedVersion, cliOut }) {
  const problems = [];
  const entry = Array.isArray(list) ? list.find((p) => p?.id === id) : undefined;
  if (!entry) return [`${id} is missing from "claude plugin list --json"`];
  if (entry.enabled !== true) problems.push(`${id} is installed but not enabled`);
  if (entry.version !== expectedVersion) problems.push(`installed version ${entry.version} differs from the repo version ${expectedVersion}`);
  if (typeof entry.installPath !== "string" || !entry.installPath) problems.push("the plugin list has no installPath");
  if (String(cliOut ?? "").trim() !== expectedVersion) problems.push(`installed CLI printed "${String(cliOut ?? "").trim()}", expected "${expectedVersion}"`);
  return problems;
}

function sh(bin, args, env, cwd) {
  const r = spawnSync(bin, args, { encoding: "utf8", env, cwd, timeout: 180_000 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(), stdout: r.stdout ?? "" };
}

export function runCanary({ repo, claude = "claude" }) {
  const probe = spawnSync(claude, ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) return { status: "skip", claudeVersion: "", problems: [`no usable "${claude}" binary`] };
  const claudeVersion = probe.stdout.trim();
  const expectedVersion = JSON.parse(readFileSync(join(repo, "plugins", "claude-referee", ".claude-plugin", "plugin.json"), "utf8")).version;
  const dir = mkdtempSync(join(tmpdir(), "canary-"));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: join(dir, "config"), HOME: join(dir, "home") };
  for (const k of KEYS) delete env[k];
  const problems = [];
  try {
    const add = sh(claude, ["plugin", "marketplace", "add", repo], env, dir);
    if (add.code !== 0) return { status: "fail", claudeVersion, expectedVersion, problems: [`marketplace add failed: ${add.out}`] };
    const inst = sh(claude, ["plugin", "install", ID], env, dir);
    if (inst.code !== 0) return { status: "fail", claudeVersion, expectedVersion, problems: [`install failed: ${inst.out}`] };
    let list;
    try {
      list = JSON.parse(sh(claude, ["plugin", "list", "--json"], env, dir).stdout);
    } catch {
      return { status: "fail", claudeVersion, expectedVersion, problems: ["plugin list --json was not JSON"] };
    }
    const entry = Array.isArray(list) ? list.find((p) => p?.id === ID) : undefined;
    const cli = entry?.installPath ? sh(process.execPath, [join(entry.installPath, "dist", "cli.mjs"), "--version"], env, dir) : { out: "" };
    problems.push(...assessInstall({ list, expectedVersion, cliOut: cli.out }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { status: problems.length ? "fail" : "pass", claudeVersion, expectedVersion, problems };
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(arg("--repo", resolve(fileURLToPath(import.meta.url), "..", "..")));
  const res = runCanary({ repo, claude: arg("--claude", "claude") });
  const line = `canary ${res.status}: Claude Code ${res.claudeVersion || "n/a"}, plugin ${res.expectedVersion ?? "n/a"}`;
  console.log(line);
  for (const p of res.problems) console.error(`  - ${p}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n${res.problems.map((p) => `- ${p}\n`).join("")}`);
  process.exit(res.status === "pass" ? 0 : res.status === "skip" ? 2 : 1);
}
