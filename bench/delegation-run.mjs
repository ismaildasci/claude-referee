// Command line of the delegation A/B (bench/PREREG.md). Raw runs go under --out, outside the repository; repositories are fetched into --cache (default <out>/repos).
// Usage: node bench/delegation-run.mjs plan|run|report|size --out <dir> [--stage dry|pilot|main] [--cases id,id] [--reps n] [--cap-usd n] [--only arm] [--projects-dir dir] [--claude bin] [--referee-env K=V,...]

import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DRY_CAP_USD, MAIN_CAP_USD, MAIN_REPS, PILOT_CAP_USD, PILOT_REPS, analyzeDelegation, buildItems, loadDelegationCases, planDelegation, planDry, prepareDelegation, readDelegationGrounds, runAllDelegation, sizeDelegationPilot } from "./delegation-session.mjs";
import { readLedger, spentUsd } from "./session.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback);
const usage = "usage: delegation-run.mjs plan|run|report|size --out <dir> [--stage dry|pilot|main] [--cases id,id] [--reps n] [--cap-usd n] [--only arm] [--cache dir] [--projects-dir dir] [--claude bin] [--referee-env K=V,...]";
const out = flag("--out");
if (!command || !out) {
  console.error(usage);
  process.exit(2);
}
const outDir = resolve(out);
const stage = flag("--stage", "pilot");
const cases = loadDelegationCases(join(here, "cases-delegation.json"));
const caseIds = flag("--cases") ? flag("--cases").split(",") : cases.cases.map((c) => c.id);

function plans() {
  const only = flag("--only");
  const list = stage === "dry" ? planDry(flag("--case", "d-pytest")) : planDelegation({ caseIds, reps: stage === "pilot" ? PILOT_REPS : Number(flag("--reps", String(MAIN_REPS))), stage });
  return only ? list.filter((s) => s.arm === only) : list;
}

if (command === "plan") {
  const list = plans();
  console.log(JSON.stringify({ stage, sessions: list.length, order: list.map((s) => s.id) }));
} else if (command === "run") {
  const itemsByCase = buildItems({ cacheDir: resolve(flag("--cache", join(outDir, "repos"))), cases });
  prepareDelegation({ out: outDir, repoRoot, cases, itemsByCase });
  const defaultCap = stage === "main" ? MAIN_CAP_USD : stage === "dry" ? DRY_CAP_USD : PILOT_CAP_USD;
  const capUsd = Number(flag("--cap-usd", String(defaultCap)));
  if (!(capUsd > 0 && capUsd <= defaultCap)) throw new Error(`--cap-usd must be above 0 and at most the registered ${defaultCap}`);
  const extraEnv = flag("--referee-env") ? Object.fromEntries(flag("--referee-env").split(",").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)])) : {};
  const opts = { claude: flag("--claude", "claude"), projectsDir: resolve(flag("--projects-dir", join(homedir(), ".claude", "projects"))), extraEnv };
  const summary = await runAllDelegation({ out: outDir, plans: plans(), cases, itemsByCase, capUsd, opts, log: (line) => console.error(line) });
  console.log(JSON.stringify(summary));
  process.exit(summary.stopped === "budget" ? 3 : 0);
} else if (command === "size") {
  console.log(JSON.stringify(sizeDelegationPilot(readDelegationGrounds(outDir).filter((g) => g.stage === "pilot")), null, 1));
} else if (command === "report") {
  const grounds = readDelegationGrounds(outDir).filter((g) => g.stage === stage);
  console.log(JSON.stringify({ stage, ...analyzeDelegation(grounds), ledger_entries: readLedger(outDir).length, spent_usd: Math.round(spentUsd(readLedger(outDir)) * 10000) / 10000 }, null, 1));
} else {
  console.error(usage);
  process.exit(2);
}
