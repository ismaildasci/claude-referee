// Command line of the session base-rate study (docs/decisions/session-base-rate.md). Raw runs go under --out, outside the repository.
// Usage: node scripts/session-study/cli.mjs prepare|plan|run|review|labels|report --out <dir> [--pilot] [--stage 1|2] [--cap-usd 8] [--projects-dir <dir>] [--claude <bin>]

import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASKED_TARGET, CAP_USD, MAX_SESSIONS, PER_SESSION_USD, analyze, planSessions } from "./lib.mjs";
import { ambiguousPending, prepare, readGrounds, readLedger, runAll, setManual, writeLabels } from "./runner.mjs";
import { TASKS } from "./tasks.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback);
const has = (name) => rest.includes(name);
const out = flag("--out");
if (!command || !out) {
  console.error("usage: cli.mjs prepare|plan|run|review|labels|report --out <dir> [--pilot] [--stage 1|2] [--cap-usd n] [--projects-dir dir] [--claude bin]");
  process.exit(2);
}
const outDir = resolve(out);
const stage = Number(flag("--stage", "1"));
const plans = () => planSessions({ tasks: TASKS, stage, pilot: has("--pilot"), maxSessions: Number(flag("--max-sessions", String(MAX_SESSIONS))) });

async function report() {
  const { clopperPearson } = await import("../../src/engine/stopgate/interval.ts");
  return analyze(readGrounds(outDir), clopperPearson);
}

if (command === "prepare") {
  console.log(JSON.stringify(prepare({ out: outDir, repoRoot })));
} else if (command === "plan") {
  const list = plans();
  console.log(JSON.stringify({ sessions: list.length, first: list.slice(0, 3), cap_usd: CAP_USD, per_session_usd: PER_SESSION_USD }));
} else if (command === "run") {
  prepare({ out: outDir, repoRoot });
  const capUsd = Number(flag("--cap-usd", String(CAP_USD)));
  if (!(capUsd > 0 && capUsd <= CAP_USD)) throw new Error(`--cap-usd must be above 0 and at most the registered ${CAP_USD}`);
  const opts = { claude: flag("--claude", "claude"), projectsDir: resolve(flag("--projects-dir", join(homedir(), ".claude", "projects"))) };
  const shouldStop = stage === 2 ? () => readGrounds(outDir).filter((g) => g.stop && !g.stop.skipped && g.stop.would_block !== undefined).length >= ASKED_TARGET : () => false;
  const summary = await runAll({ out: outDir, plans: plans(), capUsd, opts, shouldStop, log: (line) => console.error(line) });
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
} else if (command === "report") {
  const result = await report();
  console.log(JSON.stringify({ ...result, ledger_entries: readLedger(outDir).length }, null, 1));
} else {
  console.error(`unknown command ${command}`);
  process.exit(2);
}
