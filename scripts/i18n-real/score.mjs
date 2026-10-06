// Step 6 of the i18n real-code hold-out: the registered bar and the reported breakdowns, from cases.jsonl and recorded.jsonl alone.
// Usage: node score.mjs SUITE_DIR. Bands as the pack: yes at 0.90 or more, no at 0.10 or less, review between.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clopperPearson, upperOneSided } from "../real-ci/lib.mjs";

const SUITE = process.argv[2];
if (!SUITE) throw new Error("usage: node score.mjs SUITE_DIR");
const jsonl = (file) => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cases = jsonl(join(SUITE, "cases.jsonl"));
const answers = new Map(jsonl(join(SUITE, "recorded.jsonl")).map((r) => [r.case, r.answers["string.translatable"].noul]));
const verdict = (p) => (p >= 0.9 ? "yes" : p <= 0.1 ? "no" : "review");
const rows = cases.map((c) => {
  const p = answers.get(c.id);
  if (p === undefined) throw new Error(`no recorded answer for ${c.id}`);
  return { ...c, p, verdict: verdict(p) };
});

function tally(list) {
  const yes = list.filter((r) => r.expected === "yes");
  const no = list.filter((r) => r.expected === "no");
  const wrongYes = no.filter((r) => r.verdict === "yes");
  const wrongNo = yes.filter((r) => r.verdict === "no");
  const definite = list.filter((r) => r.verdict !== "review").length;
  return {
    n: list.length,
    expected_yes: yes.length,
    expected_no: no.length,
    verdicts: { yes: list.filter((r) => r.verdict === "yes").length, review: list.filter((r) => r.verdict === "review").length, no: list.filter((r) => r.verdict === "no").length },
    wrong_yes: wrongYes.length,
    wrong_yes_upper95: upperOneSided(wrongYes.length, no.length),
    wrong_no: wrongNo.length,
    wrong_no_upper95: upperOneSided(wrongNo.length, yes.length),
    yes_found: yes.filter((r) => r.verdict === "yes").length,
    no_found: no.filter((r) => r.verdict === "no").length,
    coverage: list.length ? Number((definite / list.length).toFixed(3)) : null,
    coverage_ci95: clopperPearson(definite, list.length),
    wrong_ids: [...wrongYes, ...wrongNo].map((r) => `${r.id} (${r.expected}, p ${r.p})`),
  };
}

const by = (key) => Object.fromEntries([...new Set(rows.map((r) => r[key]))].sort().map((v) => [v, tally(rows.filter((r) => r[key] === v))]));
const all = tally(rows);
const report = {
  bar: { wrong_yes: all.wrong_yes, wrong_no: all.wrong_no, held: all.wrong_yes === 0 && all.wrong_no === 0 },
  all,
  without_flagged_o: tally(rows.filter((r) => !(r.origin === "O" && r.contains_removed_value))),
  by_origin: by("origin"),
  by_framework: by("framework"),
  by_repo: by("repo"),
  by_kind: by("kind"),
  p_range: {
    yes_expected_lowest: Math.min(...rows.filter((r) => r.expected === "yes").map((r) => r.p)),
    no_expected_highest: Math.max(...rows.filter((r) => r.expected === "no").map((r) => r.p)),
  },
};
console.log(JSON.stringify(report, null, 1));
