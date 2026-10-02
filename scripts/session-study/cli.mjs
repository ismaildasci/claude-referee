// Command line of the session base-rate study (docs/decisions/session-base-rate.md). Raw runs go under --out, outside the repository.
// Usage: node scripts/session-study/cli.mjs prepare|plan|run|review|labels|report|fixture --out <dir> [--set hard] [--pilot] [--stage 1|2] [--cap-usd 8] [--projects-dir <dir>] [--claude <bin>]

import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addFixture } from "./fixture.mjs";
import { HARD_ASKED_TARGET, HARD_CAP_USD, HARD_PER_SESSION_USD, hardReport, planHard } from "./hard.mjs";
import { ASKED_TARGET, CAP_USD, MAX_SESSIONS, PER_SESSION_USD, analyze, planSessions } from "./lib.mjs";
import { ALLOWED_TOOLS_HARD, ambiguousPending, askedCount, prepare, readGrounds, readLedger, runAll, setManual, writeLabels } from "./runner.mjs";
import { HARD_TASKS, TASKS } from "./tasks.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback);
const has = (name) => rest.includes(name);
const out = flag("--out");
if (!command || !out) {
  console.error("usage: cli.mjs prepare|plan|run|review|labels|report|fixture --out <dir> [--pilot] [--stage 1|2] [--cap-usd n] [--projects-dir dir] [--claude bin]");
  process.exit(2);
}
const outDir = resolve(out);
const stage = Number(flag("--stage", "1"));
const hard = flag("--set", "base") === "hard";
const tasks = hard ? HARD_TASKS : TASKS;
const plans = () => (hard ? planHard(tasks).slice(0, has("--pilot") ? 6 : undefined) : planSessions({ tasks, stage, pilot: has("--pilot"), maxSessions: Number(flag("--max-sessions", String(MAX_SESSIONS))) }));
const registeredCap = hard ? HARD_CAP_USD : CAP_USD;
const perSession = hard ? HARD_PER_SESSION_USD : PER_SESSION_USD;

async function report() {
  const { clopperPearson } = await import("../../src/engine/stopgate/interval.ts");
  return hard ? hardReport(readGrounds(outDir), clopperPearson) : analyze(readGrounds(outDir), clopperPearson);
}

if (command === "prepare") {
  console.log(JSON.stringify(prepare({ out: outDir, repoRoot, tasks })));
} else if (command === "plan") {
  const list = plans();
  console.log(JSON.stringify({ sessions: list.length, first: list.slice(0, 3), cap_usd: registeredCap, per_session_usd: perSession }));
} else if (command === "run") {
  prepare({ out: outDir, repoRoot, tasks });
  const capUsd = Number(flag("--cap-usd", String(registeredCap)));
  if (!(capUsd > 0 && capUsd <= registeredCap)) throw new Error(`--cap-usd must be above 0 and at most the registered ${registeredCap}`);
  const opts = { claude: flag("--claude", "claude"), projectsDir: resolve(flag("--projects-dir", join(homedir(), ".claude", "projects"))), ...(hard ? { allowedTools: ALLOWED_TOOLS_HARD } : {}) };
  const askedTarget = hard ? HARD_ASKED_TARGET : ASKED_TARGET;
  const shouldStop = hard || stage === 2 ? () => askedCount(outDir) >= askedTarget : () => false;
  const summary = await runAll({ out: outDir, plans: plans(), capUsd, perSessionUsd: perSession, opts, shouldStop, log: (line) => console.error(line) });
  console.log(JSON.stringify(summary));
  process.exit(summary.stopped === "budget" ? 3 : 0);
} else if (command === "review") {
  if (has("--set")) {
    setManual(outDir, flag("--set"), flag("--as"));
    console.log("ok");
  } else {
    console.log(JSON.stringify(ambiguousPending(outDir).map((g) => ({ id: g.id, final_message: g.final_message })), null, 1));
  }
} else if (command === "labels") {
  console.log(JSON.stringify(writeLabels(outDir)));
} else if (command === "fixture") {
  console.log(JSON.stringify(addFixture({ out: outDir, id: flag("--id"), name: flag("--name"), dest: resolve(flag("--dest", join(repoRoot, "jev-evals/stop-sessions"))), split: flag("--split", "dev"), expected: flag("--expected") })));
} else if (command === "report") {
  const result = await report();
  console.log(JSON.stringify({ ...result, ledger_entries: readLedger(outDir).length }, null, 1));
} else {
  console.error(`unknown command ${command}`);
  process.exit(2);
}
