// Prints the markdown tables of docs/measurements-done-bar-split.md from summary.json (rescore.mjs) and classes.json (split.mjs).
// Usage: node report.mjs; numbers are never typed by hand.

import { readFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const old = read("docs/data/done-bar-split/summary.json");
const real = read("docs/data/done-v2-real/classes.json");
const pct = (x) => (x === null || x === undefined ? "n/a" : `${(x * 100).toFixed(1)}%`);
const rat = (r) => (r.n ? `${r.k} of ${r.n} (${pct(r.p)}; ${pct(r.lo)} to ${pct(r.hi)})` : "n/a (0)");
const out = [];

out.push("| Suite | Cases | R | E | U | Code-decided | Sent | Unusable |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const [s, v] of Object.entries(old.by_suite)) {
  const a = v.score;
  out.push(`| \`${s}\` | ${a.all.cases} | ${a.R.cases} | ${a.E.cases} | ${a.U.cases} | ${a.all.code_decided} | ${a.all.sent_cases} | ${v.unusable} |`);
}
const m = old.pooled_main.score;
out.push(`| h2 to h6 pooled | ${m.all.cases} | ${m.R.cases} | ${m.E.cases} | ${m.U.cases} | ${m.all.code_decided} | ${m.all.sent_cases} | 0 |`, "");

const table = (title, score) => {
  out.push(`**${title}**`, "", "| Class | Sent clusters | Expected met | Expected missing | Wrong met (upper 95% one-sided) | Missing found | Met found |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const c of ["R", "E", "U", "all"]) {
    const x = score[c];
    out.push(`| ${c === "all" ? "all" : c} | ${x.clusters} | ${x.expected_met} | ${x.expected_missing} | ${x.wrong_met.k} of ${x.wrong_met.n} (${pct(x.wrong_met.upper95_one_sided)}) | ${rat(x.missing_recall)} | ${rat(x.met_recall)} |`);
  }
  out.push("");
};
table("Hold-outs 2 to 6 pooled (post hoc, current caps and parsers, recorded answers)", m);
for (const [s, v] of Object.entries(old.by_suite)) table(`\`${s}\``, v.score);
out.push("**Raw `met` answers turned into `unsure` by code caps (pooled h2 to h6)**", "", "| Case | Class | Expected | Cap reason |", "| --- | --- | --- | --- |");
for (const c of old.capped_by_code) out.push(`| ${c.id} | ${c.cls} | ${c.expected} | ${c.reason ?? "unparsed (no recognised runner or exit code line)"} |`);
out.push("");
out.push(`Bar over the pooled main sets: ${JSON.stringify(old.pooled_main.bar)}`, "");

out.push(`**Real-log sample, ${real.jev_scored ? "code-level counts and Jev's recorded verdicts" : "code-level only (no Jev answers)"}**`, "", "| Part | Class | Cases | Code-decided | Sent | Expected met | Expected missing | Met reachable among expected met | Met reachable among expected missing |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const p of ["all", "dev", "holdout"]) {
  for (const c of ["R", "E", "U", "total"]) {
    const x = real[p][c];
    out.push(`| ${p} | ${c} | ${x.cases} | ${x.code_decided} | ${x.sent} | ${x.expected_met} | ${x.expected_missing} | ${x.met_reachable_expected_met} | ${x.met_reachable_expected_missing} |`);
  }
}
if (real.jev_scored) {
  out.push("", "| Part | Class | Sent | Wrong met | Met found | Missing found |", "| --- | --- | --- | --- | --- | --- |");
  for (const p of ["all", "dev", "holdout"]) {
    for (const c of ["R", "E", "U", "total"]) {
      const x = real[p][c];
      out.push(`| ${p} | ${c} | ${x.sent} | ${x.wrong_met} of ${x.expected_missing} | ${x.met_found} of ${x.expected_met} | ${x.missing_found} of ${x.expected_missing} |`);
    }
  }
}
console.log(out.join("\n"));
