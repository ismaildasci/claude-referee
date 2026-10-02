// Real-log study scoring: the registered metrics (wrong met, parsed coverage, met recall among parsed) from table.jsonl alone.
// Usage: node score.mjs TABLE.jsonl [--json]; no network, no log text needed.

import { readFileSync } from "node:fs";
import { clopperPearson, upperOneSided } from "./lib.mjs";

const file = process.argv[2];
if (!file) throw new Error("usage: score.mjs TABLE.jsonl [--json]");
const table = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const sent = table.filter((r) => !r.code_decided);
const ratio = (k, n) => ({ k, n, p: n ? k / n : null, ...clopperPearson(k, n) });
const wrongOf = (rows) => rows.filter((r) => r.expected === "missing" && r.verdict === "met").length;
const missingOf = (rows) => rows.filter((r) => r.expected === "missing").length;

const wrong = (rows) => ({ k: wrongOf(rows), n: missingOf(rows), upper95_one_sided: upperOneSided(wrongOf(rows), missingOf(rows)) });
const parsed = sent.filter((r) => r.parsed);
const exitOnly = sent.filter((r) => !r.parsed);
const recall = (rows) => ratio(rows.filter((r) => r.expected === "met" && r.verdict === "met").length, rows.filter((r) => r.expected === "met").length);
const missRecall = (rows) => ratio(rows.filter((r) => r.expected === "missing" && r.verdict === "missing").length, missingOf(rows));
const mix = (rows) => rows.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] ?? 0) + 1), m), {});
const group = (rows, key) => Object.fromEntries([...new Set(rows.map((r) => r[key]))].sort().map((v) => [v, ratio(rows.filter((r) => r[key] === v && r.parsed).length, rows.filter((r) => r[key] === v).length)]));

const reach = (rows, exp) => ratio(rows.filter((r) => r.expected === exp && r.met_reachable).length, rows.filter((r) => r.expected === exp).length);
const kindOf = (kind) => {
  const rows = sent.filter((r) => r.expected === "missing" && r.negative_kind === kind);
  return { n: rows.length, met_reachable: rows.filter((r) => r.met_reachable).length, upper95_one_sided_if_0_wrong: upperOneSided(0, rows.length) };
};
const scored = sent.every((r) => r.verdict !== null);
const parsedExpectedMet = parsed.filter((r) => r.expected === "met").length;
const pending = "not scored: no Jev answers recorded";
const result = {
  jev_scored: scored,
  cases: table.length,
  repos: new Set(table.map((r) => r.repo)).size,
  code_decided: { n: table.length - sent.length, all_missing: table.filter((r) => r.code_decided).every((r) => r.verdict === "missing") },
  sent: { n: sent.length, expected_met: sent.filter((r) => r.expected === "met").length, expected_missing: missingOf(sent), verdicts: scored ? mix(sent) : pending },
  wrong_met: !scored ? pending : { total: wrong(sent), parsed: wrong(parsed), exit_code_only: wrong(exitOnly), bar: 0, passed: wrongOf(sent) === 0 },
  negatives: { note: "expected-missing succeeded steps: ran_not_clean = the check ran and shows a skip, warning, zero tests or failure; not_run = the step only mentions the tool", ran_not_clean: kindOf("ran_not_clean"), not_run: kindOf("not_run") },
  met_reachable_offline: { note: "share whose code caps allow met if Jev answered p=1; no Jev needed", parsed_expected_met: reach(parsed, "met"), parsed_expected_missing: reach(parsed, "missing"), exit_code_expected_met: reach(exitOnly, "met"), exit_code_expected_missing: reach(exitOnly, "missing") },
  parsed_coverage: { overall: ratio(parsed.length, sent.length), by_criterion: group(sent, "criterion"), by_language: group(sent, "language") },
  met_recall_among_parsed: !scored ? pending : { ...recall(parsed), bar: 0.9, evaluable: parsedExpectedMet >= 30, passed: parsedExpectedMet >= 30 ? recall(parsed).p >= 0.9 : null },
  met_recall_exit_code_only: !scored ? pending : recall(exitOnly),
  missing_recall: !scored ? pending : { parsed: missRecall(parsed), exit_code_only: missRecall(exitOnly) },
  verdicts: !scored ? pending : { parsed: mix(parsed), exit_code_only: mix(exitOnly) },
};
console.log(JSON.stringify(result, null, process.argv.includes("--json") ? 0 : 1));
