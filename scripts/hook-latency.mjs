// Hook start latency: a hook process must add at most 40 ms at p95 over a bare `node -e ""` on the same machine. Exit 1 when it doesn't.
// Usage: node scripts/hook-latency.mjs [--runs 40] [--budget-ms 40]; no key and no network (the hooks get an empty event).

import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const flag = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const runs = flag("--runs", 40);
const budget = flag("--budget-ms", 40);
const hook = fileURLToPath(new URL("../plugins/claude-referee/dist/hook.mjs", import.meta.url));
const home = mkdtempSync(join(tmpdir(), "hook-latency-"));

const once = (args, input) => {
  const start = process.hrtime.bigint();
  spawnSync(process.execPath, args, { input, env: { PATH: process.env.PATH ?? "", HOME: home, REFEREE_DATA_DIR: home }, stdio: ["pipe", "ignore", "ignore"] });
  return Number(process.hrtime.bigint() - start) / 1e6;
};
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.ceil(0.95 * xs.length) - 1];

const targets = [
  ["bare node", ["-e", ""], ""],
  ["hook session-start", [hook, "session-start"], "{}"],
  ["hook stop", [hook, "stop"], "{}"],
];
const result = {};
for (const [name, args, input] of targets) {
  once(args, input);
  result[name] = p95(Array.from({ length: runs }, () => once(args, input)));
}
const bare = result["bare node"];
let ok = true;
for (const [name, ms] of Object.entries(result)) {
  const over = ms - bare;
  const bad = name !== "bare node" && over > budget;
  if (bad) ok = false;
  console.log(`${name.padEnd(20)} p95 ${ms.toFixed(1)} ms${name === "bare node" ? "" : `  (+${over.toFixed(1)} ms${bad ? `, over the ${budget} ms budget` : ""})`}`);
}
process.exitCode = ok ? 0 : 1;
