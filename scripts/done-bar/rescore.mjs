// Rescores the recorded hold-outs 2 to 6 (and the parser group 6p, apart) under the split bar of docs/decisions/done-bar-split.md. Post hoc, not a pass.
// Usage: node rescore.mjs [EVALS_DIR] [OUT_DIR]; writes cases.jsonl (no evidence text) and summary.json, sends nothing.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scoreByClass, verdictOfBar } from "./lib.mjs";
import { replaySuite } from "./replay.mjs";

const MAIN = ["done-v2-h2", "done-v2-h3", "done-v2-h4", "done-v2-h5", "done-v2-h6"];
const GROUP = ["done-v2-h6p"];
const [root = "jev-evals", out = "docs/data/done-bar-split"] = process.argv.slice(2);

const rows = new Map([...MAIN, ...GROUP].map((s) => [s, replaySuite(root, s)]));
const pooled = MAIN.flatMap((s) => rows.get(s) ?? []);
const summary = {
  note: "Post hoc rescoring of recorded answers; not a pass of the split bar. Classes by the repository's own parseEvidence; counts over clusters of sent cases.",
  main_suites: MAIN,
  group_suites: GROUP,
  pooled_main: { score: scoreByClass(pooled), bar: verdictOfBar(scoreByClass(pooled)) },
  group: { score: scoreByClass(GROUP.flatMap((s) => rows.get(s) ?? [])), bar: verdictOfBar(scoreByClass(GROUP.flatMap((s) => rows.get(s) ?? []))) },
  by_suite: Object.fromEntries([...rows].map(([s, r]) => [s, { score: scoreByClass(r), unusable: r.filter((x) => !x.code_decided && x.status !== "ok").length }])),
  capped_by_code: pooled.filter((r) => r.raw_met && r.verdict !== "met").map((r) => ({ id: r.id, expected: r.expected, cls: r.cls, verdict: r.verdict, reason: r.reason })),
  cases_merged_by_clustering: [...rows.values()].flat().length - new Set([...rows.values()].flat().map((r) => r.cluster)).size,
};
mkdirSync(out, { recursive: true });
const lines = [...rows.values()].flat().map(({ cluster, ...r }) => JSON.stringify({ ...r, cluster: cluster.slice(0, 12) }));
writeFileSync(join(out, "cases.jsonl"), `${lines.join("\n")}\n`);
writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 1)}\n`);
console.log(`cases ${lines.length}; main pooled clusters ${summary.pooled_main.score.all.clusters}; unusable ${Object.values(summary.by_suite).reduce((s, x) => s + x.unusable, 0)}`);
