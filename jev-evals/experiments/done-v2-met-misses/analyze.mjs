// Offline: per-case verdict from latest matching recording; lists expected=met cases not met.
import { readFileSync } from "node:fs";
const R = "<repo>";
const { parseEvidence } = await import(R + "/src/engine/runners/index.ts");
const { doneEvidence } = await import(R + "/src/cli/commands/done.ts");
const cases = readFileSync(R + "/jev-evals/done-v2/cases.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const recs = readFileSync(R + "/jev-evals/done-v2/recorded.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const rows = [];
for (const c of cases) {
  const rs = recs.filter((r) => r.case === c.id);
  const last = rs[rs.length - 1];
  const p = last?.answers?.c1?.noul;
  const parsed = parseEvidence(doneEvidence(c.evidence));
  const verdict0 = p >= 0.7 ? "met" : p < 0.5 ? "missing" : "unsure";
  const verdict = verdict0 === "met" && (parsed.trust === "unparsed" || parsed.conflict) ? "unsure" : verdict0;
  rows.push({ id: c.id, split: c.split, exp: c.expected, p, nrec: rs.length, allp: rs.map((r) => r.answers.c1.noul), trust: parsed.trust, conflict: parsed.conflict, exit: parsed.exit_code, runners: parsed.runners.map((r) => `${r.runner}:${r.passed}/${r.failed}/${r.errors}/${r.skipped}`), verdict, variant: c.variant });
}
import { writeFileSync } from "node:fs";
writeFileSync(process.argv[2] + "/rows.json", JSON.stringify(rows, null, 1));
for (const r of rows.filter((r) => r.exp === "met" && r.verdict !== "met")) console.log(JSON.stringify(r));
console.log("--- unsure/other non-met expected");
for (const r of rows.filter((r) => r.exp !== "met" && r.verdict !== "missing")) console.log(r.id, r.exp, r.verdict, r.p, r.trust);
const tot = (s) => { const m = rows.filter((r) => r.split === s); const E = m.filter((r) => r.exp === "met"); return `${s}: met expected ${E.length}, found ${E.filter((r) => r.verdict === "met").length}; wrong met ${m.filter((r) => r.exp !== "met" && r.verdict === "met").length}`; };
console.log(tot("dev"), tot("holdout"));
