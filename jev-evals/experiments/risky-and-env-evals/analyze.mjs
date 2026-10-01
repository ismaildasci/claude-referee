// Produces results/results.json and prints compact tables. No API calls.
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { metrics, load, probs } from "./score.mjs";
const E = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(E, "results"), { recursive: true });
const variants = ["risky-base", "risky-v1", "risky-rc", "env-base", "env-v1", "env-ec"];
const ck = (v) => (v.endsWith("-rc") ? "rc" : v.endsWith("-ec") ? "ec" : null);
const out = {};
const brief = (m) => ({ n: m.n, pos: m.positives, neg: m.negatives, yes: m.yes, no: m.no, review: m.review, wp: m.wrong_positive, wn: m.wrong_negative, cov: m.coverage, prec: m.precision, rec: m.recall, wp_ids: m.wrong_positive_ids, wn_ids: m.wrong_negative_ids, review_ids: m.review_ids, ...(m.mean_of_orders ? { mean_orders: { yes: m.mean_of_orders.yes, no: m.mean_of_orders.no, wp: m.mean_of_orders.wrong_positive, wn: m.mean_of_orders.wrong_negative, cov: m.mean_of_orders.coverage }, order_disagreements: m.order_disagreements } : {}) });
for (const v of variants) {
  out[v] = {};
  for (const s of ["dev", "holdout", "stress", "all"]) out[v][s] = metrics(v, s, 0.9, ck(v));
}
// sweep on all, bands 0.8/0.95
const bands = {};
for (const v of variants) { bands[v] = {}; for (const b of [0.8, 0.9, 0.95]) { const m = metrics(v, "all", b, ck(v)); bands[v][b] = { yes: m.yes, no: m.no, review: m.review, wp: m.wrong_positive, wn: m.wrong_negative, cov: m.coverage }; } }
// noise
const noise = {};
for (const [base, nz] of [["risky-base", "risky-base.noise"], ["env-base", "env-base.noise"]]) {
  const a = Object.fromEntries(readFileSync(join(E, "recorded", base + ".jsonl"), "utf8").trim().split("\n").map(JSON.parse).map((r) => [r.case, r]));
  const b = readFileSync(join(E, "recorded", nz + ".jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const d = b.map((r) => ({ id: r.case, p1: probs(base, a[r.case])[0], p2: probs(base, r)[0] })).map((x) => ({ ...x, d: Math.abs(x.p1 - x.p2) }));
  noise[base] = { n: d.length, mean_abs: +(d.reduce((s, x) => s + x.d, 0) / d.length).toFixed(3), max_abs: +Math.max(...d.map((x) => x.d)).toFixed(2), band_flips: d.filter((x) => { const c = (p) => (p >= 0.9 ? "y" : p <= 0.1 ? "n" : "r"); return c(x.p1) !== c(x.p2); }).map((x) => x.id), pairs: d.map((x) => `${x.id}:${x.p1}/${x.p2}`) };
}
// pooled base dev+holdout already as split=all minus stress
const pooled = {};
for (const v of variants) {
  const m = { ...metrics(v, "dev", 0.9, ck(v)) }; const h = metrics(v, "holdout", 0.9, ck(v));
  pooled[v] = { n: m.n + h.n, negatives: m.negatives + h.negatives, wp: m.wrong_positive + h.wrong_positive, wn: m.wrong_negative + h.wrong_negative, yes: m.yes + h.yes, no: m.no + h.no, review: m.review + h.review, cov: +((m.yes + m.no + h.yes + h.no) / (m.n + h.n)).toFixed(3) };
}
// p distribution summary (min p of positives, max p of negatives) on all splits (incl stress)
const sep = {};
for (const v of variants) { const { rows } = metrics(v, "all", 0.9, ck(v)); const pm = (r) => r.ps.reduce((s, p) => s + p, 0) / r.ps.length; sep[v] = { min_p_pos: +Math.min(...rows.filter((r) => r.pos).map(pm)).toFixed(2), max_p_neg: +Math.max(...rows.filter((r) => !r.pos).map(pm)).toFixed(2), rows: rows.map((r) => `${r.id}${r.pos ? "+" : "-"}:${r.ps.join("/")}`) }; }
// near-miss vs plain
const nm = {};
for (const v of variants) { const { rows } = metrics(v, "all", 0.9, ck(v)); const cases = load(v).cases; const g = { near: { n: 0, decided: 0, wrong: 0 }, plain: { n: 0, decided: 0, wrong: 0 } }; for (const r of rows) { const k = cases[r.id].near_miss ? "near" : "plain"; g[k].n++; if (r.v !== "review") g[k].decided++; if ((r.v === "yes" && !r.pos) || (r.v === "no" && r.pos)) g[k].wrong++; } nm[v] = g; }
const summary = Object.fromEntries(variants.map((v) => [v, Object.fromEntries(["dev", "holdout", "stress"].map((s) => [s, brief(out[v][s])]))]));
const bycat = {}; for (const v of ["risky-base", "risky-v1", "risky-rc"]) bycat[v] = out[v].all.by_category;
writeFileSync(join(E, "results", "results.json"), JSON.stringify({ summary, bands, noise, pooled, separation: sep, near_miss: nm, by_category: bycat, calib: Object.fromEntries(variants.map((v) => [v, out[v].all.calibration_bins])) }, null, 1));
for (const v of variants) for (const s of ["dev", "holdout", "stress"]) { const b = summary[v][s]; console.log(v.padEnd(11), s.padEnd(8), `n${b.n} yes${b.yes} no${b.no} rev${b.review} wp${b.wp} wn${b.wn} cov${b.cov} prec${b.prec} rec${b.rec}`, b.wp_ids.length ? "WP:" + b.wp_ids : "", b.wn_ids.length ? "WN:" + b.wn_ids : "", b.mean_orders ? `meanorders yes${b.mean_orders.yes} no${b.mean_orders.no} wp${b.mean_orders.wp} wn${b.mean_orders.wn} dis${b.order_disagreements}` : ""); }
console.log("POOLED dev+holdout", JSON.stringify(pooled));
console.log("NOISE", JSON.stringify(Object.fromEntries(Object.entries(noise).map(([k, x]) => [k, { n: x.n, mean: x.mean_abs, max: x.max_abs, flips: x.band_flips }]))));
console.log("BANDS", JSON.stringify(bands));
console.log("SEP", JSON.stringify(Object.fromEntries(Object.entries(sep).map(([k, x]) => [k, [x.min_p_pos, x.max_p_neg]]))));
console.log("NEAR", JSON.stringify(nm));
