// Case selection from recorded data only (fixed rule, run before any live request).
import { readFileSync, writeFileSync } from "node:fs";
const L = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const sel = {};
// B1: decide-close cases whose written+reversed mean (from the 24-order file, written order = first listed in cases) has top-2 margin closest to 0.10
const cases = L("jev-evals/decide-close/cases.jsonl");
const j = JSON.parse(readFileSync("jev-evals/decide-close/order-2026-10-01.json", "utf8"));
const sc = [];
for (const c of cases) {
  const d = j.raw.find((x) => x.id === c.id); const m = new Map(d.orders.map((o) => [o.order.join(","), o.p]));
  const w = m.get(c.options.map((o) => o.name).join(",")), r = m.get([...c.options].reverse().map((o) => o.name).join(","));
  const mean = c.options.map((o) => (w[o.name] + r[o.name]) / 2).sort((a, b) => b - a);
  sc.push({ id: c.id, margin: +(mean[0] - mean[1]).toFixed(4), p1: mean[0], dist: Math.abs(mean[0] - mean[1] - 0.1) });
}
sc.sort((a, b) => a.dist - b.dist || a.id.localeCompare(b.id)); sel.B1 = sc.slice(0, 6);
// B2: done dev cases with recorded p closest to 0.70 or 0.50 (min over the two), one per case
const rec = L("jev-evals/done-v2/recorded.jsonl").filter((r) => r.split === "dev");
sel.B2 = rec.map((r) => ({ case: r.case, p: r.answers.c1.noul, dist: Math.min(Math.abs(r.answers.c1.noul - 0.7), Math.abs(r.answers.c1.noul - 0.5)) })).sort((a, b) => a.dist - b.dist || a.case.localeCompare(b.case)).slice(0, 4);
// B3: verify dev claims whose mean supports closest to 0.8
const vr = L("jev-evals/verify-v2/recorded.jsonl").filter((r) => r.split === "dev");
const v = [];
for (const r of vr) for (const k of Object.keys(r.answers).filter((k) => /^claim:.+:a$/.test(k))) { const b = r.answers[k.slice(0, -1) + "b"]; const m = (r.answers[k].probabilities.supports + b.probabilities.supports) / 2; v.push({ case: r.case, claim: k, mean_supports: m, dist: Math.abs(m - 0.8) }); }
sel.B3 = v.sort((a, b) => a.dist - b.dist || a.case.localeCompare(b.case)).slice(0, 2);
writeFileSync(new URL("selection.json", import.meta.url), JSON.stringify(sel, null, 1)); console.log(JSON.stringify(sel));
