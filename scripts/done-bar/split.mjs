// Splits the real-log sample into dev and a frozen hold-out by repository (seeded), ranks the parser backlog from dev only, counts classes per part.
// Usage: node split.mjs [TABLE.jsonl] [OUT_DIR]; reads hashes and facts only (no log text), writes split.json, backlog-dev.json, classes.json.
// When the table carries Jev's verdicts, classes.json also counts wrong met, met found and missing found per part and class.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLASSES, SEED, backlogOf, classOfTrust, holdoutHash, splitRepos } from "./lib.mjs";

const [file = "docs/data/done-v2-real/table.jsonl", out = "docs/data/done-v2-real"] = process.argv.slice(2);
const table = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const part = splitRepos(table.map((r) => ({ repo: r.repo, language: r.language })));
const rows = table.map((r) => ({ ...r, part: part.get(r.repo), cls: classOfTrust(r.trust) }));
const ids = (p) => rows.filter((r) => r.part === p).map((r) => r.id).sort();

const split = {
  rule: "docs/decisions/done-bar-split.md: per language bucket, repositories ordered by sha256(seed:repo), even positions dev, odd positions hold-out",
  seed: SEED,
  repos: Object.fromEntries([...part].sort(([a], [b]) => (a < b ? -1 : 1))),
  counts: { repos: { dev: [...part.values()].filter((p) => p === "dev").length, holdout: [...part.values()].filter((p) => p === "holdout").length }, cases: { dev: ids("dev").length, holdout: ids("holdout").length } },
  holdout_ids_sha256: holdoutHash(ids("holdout")),
  dev_ids: ids("dev"),
  holdout_ids: ids("holdout"),
};
writeFileSync(join(out, "split.json"), `${JSON.stringify(split, null, 1)}\n`);
writeFileSync(join(out, "backlog-dev.json"), `${JSON.stringify(backlogOf(rows.filter((r) => r.part === "dev")), null, 1)}\n`);

const scored = table.some((r) => !r.code_decided && typeof r.verdict === "string");
const sentWith = (rs, expected, verdict) => rs.filter((r) => !r.code_decided && r.expected === expected && (verdict === undefined || r.verdict === verdict)).length;
const cell = (rs) => ({
  cases: rs.length,
  code_decided: rs.filter((r) => r.code_decided).length,
  sent: rs.filter((r) => !r.code_decided).length,
  expected_met: sentWith(rs, "met"),
  expected_missing: sentWith(rs, "missing"),
  met_reachable_expected_met: rs.filter((r) => !r.code_decided && r.expected === "met" && r.met_reachable).length,
  met_reachable_expected_missing: rs.filter((r) => !r.code_decided && r.expected === "missing" && r.met_reachable).length,
  ...(scored ? { wrong_met: sentWith(rs, "missing", "met"), met_found: sentWith(rs, "met", "met"), missing_found: sentWith(rs, "missing", "missing") } : {}),
});
const classes = {
  note: scored
    ? "Jev's recorded verdicts are in the table: wrong_met, met_found and missing_found count sent cases (clusters are cases in this sample). met_reachable = the caps would allow met if the judge answered p=1."
    : "Code-level counts only: no Jev answers exist for this sample. met_reachable = the caps would allow met if the judge answered p=1.",
  jev_scored: scored,
};
for (const p of ["all", "dev", "holdout"]) {
  const rs = rows.filter((r) => p === "all" || r.part === p);
  classes[p] = { total: cell(rs), ...Object.fromEntries(CLASSES.map((c) => [c, cell(rs.filter((r) => r.cls === c))])) };
}
writeFileSync(join(out, "classes.json"), `${JSON.stringify(classes, null, 1)}\n`);
console.log(`repos dev ${split.counts.repos.dev} / holdout ${split.counts.repos.holdout}; cases dev ${split.counts.cases.dev} / holdout ${split.counts.cases.holdout}; holdout sha ${split.holdout_ids_sha256.slice(0, 12)}`);
