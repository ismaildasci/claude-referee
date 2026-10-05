// Real-log study step 4: merges labels (drops ambiguous, disagreeing and silent-met cases: met on output that is only a command echo and exit 0) and writes the local eval suite with evidence text.
// Usage: node assemble.mjs DIR SUITE_ROOT; writes SUITE_ROOT/SUITE/{suite.json,cases.jsonl} and DIR/assemble.json. Text stays local.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { kappa, silentOutput } from "./lib.mjs";

const [dir, root, suiteName = "done-v2-real"] = process.argv.slice(2);
if (!dir || !root) throw new Error("usage: assemble.mjs DIR SUITE_ROOT [SUITE]");
const rows = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const cases = rows(join(dir, "cases-screened.jsonl"));
const l1 = new Map(rows(join(dir, "labels1.jsonl")).map((r) => [r.id, r.label]));
const l2 = new Map(rows(join(dir, "labels2.jsonl")).map((r) => [r.id, r.label]));
const report = { screened: cases.length, failed_steps: 0, succeeded_steps: 0, unlabelled: [], ambiguous: [], silent_met: [], disagreed: [], kept: 0, expected: { met: 0, missing: 0 }, label2_n: l2.size, agreement: null, kappa: null };
const kept = [];
for (const c of cases) {
  if (c.failed) {
    report.failed_steps += 1;
    kept.push({ ...c, label1: null, label2: null, expected: "missing" });
    continue;
  }
  report.succeeded_steps += 1;
  const a = l1.get(c.id);
  const b = l2.get(c.id) ?? null;
  if (!a) report.unlabelled.push(c.id);
  else if (a === "met" && silentOutput(c.evidence)) report.silent_met.push({ id: c.id, l1: a, l2: b });
  else if (a === "ambiguous" || b === "ambiguous") report.ambiguous.push({ id: c.id, l1: a, l2: b });
  else if (b !== null && a !== b) report.disagreed.push({ id: c.id, l1: a, l2: b });
  else kept.push({ ...c, label1: a, label2: b, expected: a });
}
const sentIds = new Set(cases.filter((c) => !c.failed).map((c) => c.id));
const pairs = [...l2].filter(([id]) => l1.has(id) && sentIds.has(id)).map(([id, b]) => [l1.get(id), b]);
report.label2_n = [...l2.keys()].filter((id) => sentIds.has(id)).length;
report.agreement = pairs.length ? pairs.filter(([a, b]) => a === b).length / pairs.length : null;
report.kappa = kappa(pairs);
report.pairs = pairs.length;
report.kept = kept.length;
for (const c of kept) report.expected[c.expected] += 1;
const suite = join(root, suiteName);
mkdirSync(suite, { recursive: true });
writeFileSync(join(suite, "suite.json"), `${JSON.stringify({ command: "done", positive: "met", max_wrong_positive: 0, note: "Real GitHub Actions step logs, registered in docs/decisions/done-v2-real-logs.md; text is not committed." })}\n`);
writeFileSync(join(suite, "cases.jsonl"), `${kept.map((c) => JSON.stringify({ id: c.id, split: "holdout", group: c.purpose, variant: c.tool, criterion: c.criterion, expected: c.expected, evidence: c.evidence })).join("\n")}\n`);
writeFileSync(join(dir, "kept.jsonl"), `${kept.map((c) => JSON.stringify(c)).join("\n")}\n`);
writeFileSync(join(dir, "assemble.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, unlabelled: report.unlabelled.length, ambiguous: report.ambiguous.length, silent_met: report.silent_met.length, disagreed: report.disagreed.length }));
