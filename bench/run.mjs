// Command line of the A/B harness (bench/PREREG.md). Raw runs go under --out, outside the repository.
// Usage: node bench/run.mjs plan|run|review|report|size|cost|dry-plan --out <dir> [--stage pilot|full] [--reps n] [--cap-usd n] [--projects-dir dir] [--claude bin]

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { accountTranscript } from "./cost.mjs";
import { DRY_CAP_USD, FULL_CAP_USD, PILOT_CAP_USD, sizeFromPilot } from "./pilot.mjs";
import { planDry, planFull, planPilot, positionCounts } from "./plan.mjs";
import { analyze } from "./report.mjs";
import { ambiguousPending, loadCases, prepare, readGrounds, readLedger, runAll, setManual, spentUsd } from "./session.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback);
const has = (name) => rest.includes(name);
const usage = "usage: run.mjs plan|run|review|report|size|cost --out <dir> [--stage dry|pilot|full] [--reps n] [--cap-usd n] [--only arm,arm] [--tasks id,id] [--projects-dir dir] [--claude bin]";

if (command === "cost") {
  console.log(JSON.stringify(accountTranscript(readFileSync(resolve(rest[0]), "utf8")), null, 1));
  process.exit(0);
}
const out = flag("--out");
if (!command || !out) {
  console.error(usage);
  process.exit(2);
}
const outDir = resolve(out);
const cases = loadCases(join(here, "cases.json"));
const stage = flag("--stage", "pilot");
const taskIds = flag("--tasks") ? flag("--tasks").split(",") : cases.tasks.map((t) => t.id);

function plans() {
  const only = flag("--only") ? flag("--only").split(",") : null;
  let list;
  if (stage === "dry") list = planDry({ task: flag("--task", "n-clamp") });
  else if (stage === "pilot") list = planPilot({ taskIds });
  else {
    const reps = Number(flag("--reps"));
    if (!(reps >= 1)) throw new Error("--reps is required for the full stage (take it from `size`)");
    list = planFull({ taskIds, reps });
  }
  return only ? list.filter((s) => only.includes(s.arm)) : list;
}

if (command === "plan") {
  const list = plans();
  console.log(JSON.stringify({ stage, sessions: list.length, positions: stage === "full" ? positionCounts(list) : undefined, first: list.slice(0, 5).map((s) => s.id) }));
} else if (command === "run") {
  prepare({ out: outDir, repoRoot, cases });
  const defaultCap = stage === "full" ? FULL_CAP_USD : stage === "dry" ? DRY_CAP_USD : PILOT_CAP_USD;
  const capUsd = Number(flag("--cap-usd", String(defaultCap)));
  if (!(capUsd > 0 && capUsd <= defaultCap)) throw new Error(`--cap-usd must be above 0 and at most the registered ${defaultCap}`);
  const extraEnv = flag("--referee-env") ? Object.fromEntries(flag("--referee-env").split(",").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)])) : {};
  const opts = { claude: flag("--claude", "claude"), projectsDir: resolve(flag("--projects-dir", join(homedir(), ".claude", "projects"))), extraEnv };
  const summary = await runAll({ out: outDir, plans: plans(), cases, capUsd, opts, log: (line) => console.error(line) });
  console.log(JSON.stringify(summary));
  process.exit(summary.stopped === "budget" ? 3 : 0);
} else if (command === "review") {
  if (has("--set")) {
    setManual(outDir, flag("--set"), flag("--as"));
    console.log("ok");
  } else {
    console.log(JSON.stringify(ambiguousPending(outDir).map((g) => ({ id: g.id, final_message: g.final_message })), null, 1));
  }
} else if (command === "size") {
  console.log(JSON.stringify(sizeFromPilot(readGrounds(outDir).filter((g) => g.stage === "pilot")), null, 1));
} else if (command === "report") {
  const grounds = readGrounds(outDir).filter((g) => has("--all") || g.stage === stage);
  console.log(JSON.stringify({ ...analyze(grounds), ledger_entries: readLedger(outDir).length, spent_usd: Math.round(spentUsd(readLedger(outDir)) * 10000) / 10000 }, null, 1));
} else {
  console.error(usage);
  process.exit(2);
}
