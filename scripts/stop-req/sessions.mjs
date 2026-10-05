// Fresh-session plan and runner of the stop-requirements study (docs/decisions/stop-requirements-question.md): registered shuffle, model mix, cap; reuses scripts/session-study.
// Usage: node scripts/stop-req/sessions.mjs plan|run --out <dir> [--cap-usd 6] [--projects-dir <dir>] [--claude <bin>]

import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sessionId } from "../session-study/lib.mjs";
import { ALLOWED_TOOLS_HARD, prepare, runAll } from "../session-study/runner.mjs";
import { HARD_TASKS } from "../session-study/tasks.mjs";
import { mulberry32 } from "../stop-state/stats.mjs";

export const FRESH_SEED = 20261006;
export const FRESH_CAP_USD = 6;
export const FRESH_PER_SESSION_USD = 0.25;
export const FRESH_MAX = 60;

// Shuffle of the id-sorted task ids (Fisher-Yates from the last index down), then sonnet, sonnet, sonnet, haiku, repeating: sonnet T at marker 11 then the first 13 of T at marker 12, haiku the first 15 of T at marker 11.
export function planFresh(taskIds, seed = FRESH_SEED) {
  const rand = mulberry32(seed);
  const order = [...taskIds].sort();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const make = (task, model, rep) => ({ id: sessionId(task, model, rep), task, model, rep });
  const sonnet = [...order.map((t) => make(t, "sonnet", 11)), ...order.slice(0, 13).map((t) => make(t, "sonnet", 12))];
  const haiku = order.slice(0, 15).map((t) => make(t, "haiku", 11));
  const out = [];
  sonnet.forEach((s, i) => {
    out.push(s);
    if ((i + 1) % 3 === 0 && haiku[(i + 1) / 3 - 1]) out.push(haiku[(i + 1) / 3 - 1]);
  });
  return out.slice(0, FRESH_MAX);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const [command, ...rest] = process.argv.slice(2);
  const flag = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback);
  const out = flag("--out");
  if (!command || !out) {
    console.error("usage: sessions.mjs plan|run --out <dir> [--cap-usd n] [--projects-dir dir] [--claude bin]");
    process.exit(2);
  }
  const outDir = resolve(out);
  const plans = planFresh(HARD_TASKS.map((t) => t.id));
  if (command === "plan") console.log(JSON.stringify({ sessions: plans.length, sonnet: plans.filter((p) => p.model === "sonnet").length, haiku: plans.filter((p) => p.model === "haiku").length, cap_usd: FRESH_CAP_USD, first: plans.slice(0, 8) }));
  else if (command === "run") {
    prepare({ out: outDir, repoRoot, tasks: HARD_TASKS });
    const capUsd = Number(flag("--cap-usd", String(FRESH_CAP_USD)));
    if (!(capUsd > 0 && capUsd <= FRESH_CAP_USD)) throw new Error(`--cap-usd must be above 0 and at most the registered ${FRESH_CAP_USD}`);
    const opts = { claude: flag("--claude", "claude"), projectsDir: resolve(flag("--projects-dir", join(homedir(), ".claude", "projects"))), allowedTools: ALLOWED_TOOLS_HARD };
    const summary = await runAll({ out: outDir, plans, capUsd, perSessionUsd: FRESH_PER_SESSION_USD, opts, log: (line) => console.error(line) });
    console.log(JSON.stringify(summary));
    process.exit(summary.stopped === "budget" ? 3 : 0);
  } else {
    console.error(`unknown command ${command}`);
    process.exit(2);
  }
}
