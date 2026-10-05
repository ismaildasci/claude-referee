// Scores a real-log table per split half (dev, holdout): wrong met, met recall among parsed, parsed coverage; no log text needed.
// Usage: node halves.mjs TABLE.jsonl [SPLIT.json] [dev|holdout]

import { readFileSync } from "node:fs";
import { clopperPearson } from "../real-ci/lib.mjs";

const [file, splitFile = "docs/data/done-v2-real/split.json", only] = process.argv.slice(2);
if (!file) throw new Error("usage: halves.mjs TABLE.jsonl [SPLIT.json] [dev|holdout]");
const split = JSON.parse(readFileSync(splitFile, "utf8")).repos;
const table = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const r = (k, n) => ({ k, n, p: n ? Number((k / n).toFixed(3)) : null, ...clopperPearson(k, n) });
const out = {};
for (const half of only ? [only] : ["dev", "holdout", "all"]) {
  const rows = table.filter((x) => half === "all" || split[x.repo] === half);
  const sent = rows.filter((x) => !x.code_decided);
  const parsed = sent.filter((x) => x.parsed);
  const missing = sent.filter((x) => x.expected === "missing");
  out[half] = {
    cases: rows.length,
    sent: sent.length,
    wrong_met: r(missing.filter((x) => x.verdict === "met").length, missing.length),
    met_recall_parsed: r(parsed.filter((x) => x.expected === "met" && x.verdict === "met").length, parsed.filter((x) => x.expected === "met").length),
    met_recall_exit_code_only: r(sent.filter((x) => !x.parsed && x.expected === "met" && x.verdict === "met").length, sent.filter((x) => !x.parsed && x.expected === "met").length),
    parsed_coverage: r(parsed.length, sent.length),
    verdicts: sent.reduce((m, x) => ((m[x.verdict] = (m[x.verdict] ?? 0) + 1), m), {}),
  };
}
console.log(JSON.stringify(out));
