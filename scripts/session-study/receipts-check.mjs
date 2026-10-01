// Checks the labelling mechanism end to end on a study run: ground-truth labels go in through `receipts --stops --label` into an isolated data dir, then stats, threshold suggestion and weak hint are read back.
// Usage: node scripts/session-study/receipts-check.mjs --out <study dir> [--work <scratch dir>]. Test-rig adjustment: the stop records' project field is rewritten to one id so the single-project filter of `receipts --stops` sees them all.

import { copyFileSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectId } from "../../src/engine/datadir.ts";
import { suggestFromTranscript } from "../../src/engine/stopgate/weak.ts";
import { encodeProjectDir } from "./lib.mjs";
import { readGrounds } from "./runner.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = flag("--out");
if (!out) {
  console.error("usage: receipts-check.mjs --out <study dir> [--work <scratch dir>]");
  process.exit(2);
}
const work = resolve(flag("--work") ?? join(out, "receipts-check"));
rmSync(work, { recursive: true, force: true });
const home = join(work, "home");
const cwd = join(work, "cwd");
const data = join(work, "data");
for (const dir of [home, cwd, data]) mkdirSync(dir, { recursive: true });
const realCwd = realpathSync(cwd);
const project = projectId(realCwd);
const cli = join(repoRoot, "plugins/claude-referee/dist/cli.mjs");

const grounds = readGrounds(out).filter((g) => g.stop?.id && !["leaked", "run_failed", "error", "unresolved"].includes(g.class));
const byStop = new Map(grounds.map((g) => [g.stop.id, g]));
const stops = readFileSync(join(out, "merged", "stops.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
writeFileSync(join(data, "stops.jsonl"), stops.map((s) => JSON.stringify({ ...s, project })).join("\n") + "\n");
const projectDir = join(home, ".claude", "projects", encodeProjectDir(realCwd));
mkdirSync(projectDir, { recursive: true });
for (const g of grounds) copyFileSync(join(out, "sessions", g.id, "transcript.jsonl"), join(projectDir, `${g.session_id}.jsonl`));

const env = { PATH: process.env.PATH, HOME: home, CLAUDE_CONFIG_DIR: join(home, ".claude") };
const receipts = (...extra) => {
  const r = spawnSync("node", [cli, "receipts", "--data-dir", data, ...extra], { cwd: realCwd, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`receipts ${extra.join(" ")} failed: ${r.stdout}${r.stderr}`.slice(0, 400));
  const result = JSON.parse(r.stdout);
  return typeof result.details === "string" ? JSON.parse(readFileSync(result.details, "utf8")) : result;
};

const asked = grounds.filter((g) => g.stop.would_block === true);
const beforeList = receipts("--stops", "--unlabelled", "--days", "30");
const hintsListed = beforeList.stops.filter((s) => s.suggestion).length;
let hintsAll = 0;
let hintsOnWrongDone = 0;
for (const g of asked) {
  const stop = stops.find((s) => s.id === g.stop.id);
  const hint = suggestFromTranscript(readFileSync(join(projectDir, `${g.session_id}.jsonl`), "utf8"), stop.ts);
  if (hint) {
    hintsAll++;
    if (g.class === "wrong_done") hintsOnWrongDone++;
  }
}
for (const g of asked) receipts("--label", g.stop.id, g.class === "wrong_done" ? "--right" : "--wrong");
const after = receipts("--stops", "--days", "30");
const written = readFileSync(join(data, "labels.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const merged = new Map(readFileSync(join(out, "merged", "labels.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => [JSON.parse(l).id, JSON.parse(l).label]));
const same = written.length === merged.size && written.every((l) => merged.get(l.id) === l.label);

console.log(
  JSON.stringify(
    {
      stops_in_store: stops.length,
      would_block: asked.length,
      weak_hint: { listed_unlabelled: beforeList.stops.length, suggestions_listed: hintsListed, suggestions_all: hintsAll, suggestions_on_wrong_done: hintsOnWrongDone, ground_wrong_done: asked.filter((g) => g.class === "wrong_done").length },
      labels_written: written.length,
      labels_match_harness: same,
      stats: after.stats,
      threshold_suggestion: after.threshold_suggestion,
    },
    null,
    1,
  ),
);
