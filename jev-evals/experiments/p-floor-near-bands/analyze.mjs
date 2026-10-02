// Part A: offline floor/round/3-decimal what-if over recorded answers. Run from repo root; read-only.
import { readFileSync, writeFileSync } from "node:fs";
const R = "jev-evals/";
const TH = JSON.parse(readFileSync("plugins/claude-referee/packs/generic/thresholds.json", "utf8"));
const rows = (s) => readFileSync(R + s + "/recorded.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const dec = (v) => (String(v).split(".")[1] || "").length;
const schemes = {
  floor2: (r) => Math.floor(r * 100 + 1e-9) / 100,
  halfup2: (r) => Math.floor(r * 100 + 0.5 + 1e-9) / 100,
  round3: (r) => Math.round(r * 1000 + 1e-9) / 1000,
  floor3: (r) => Math.floor(r * 1000 + 1e-9) / 1000,
};
const bands = {}; // key "question.key" -> list of {v, suite, case, src}
const add = (q, k, v, meta) => ((bands[`${q}.${k}`] ??= []).push({ v, ...meta }));
for (const s of ["done-v2", "injection"]) for (const r of rows(s)) { const p = r.answers.c1?.noul; if (p != null) { add("done.met", "met", p, { s, c: r.case, kind: "single" }); add("done.met", "missing", p, { s, c: r.case, kind: "single" }); } }
let verifyMeans = 0;
for (const r of rows("verify-v2")) {
  const inj = r.answers.injection?.noul; if (inj != null) add("verify.injection", "flag", inj, { s: "verify-v2", c: r.case, kind: "single" });
  const ids = Object.keys(r.answers).filter((k) => /^claim:.+:a$/.test(k));
  for (const a of ids) { const b = a.slice(0, -1) + "b"; const pa = r.answers[a]?.probabilities, pb = r.answers[b]?.probabilities; if (!pa || !pb) continue;
    for (const rel of ["supports", "contradicts", "says_nothing"]) { const m = (pa[rel] + pb[rel]) / 2; if (rel === "supports") verifyMeans++; add("verify.relation", rel, m, { s: "verify-v2", c: r.case + ":" + a, kind: "mean2" }); } }
}
// 0.90 acceptance-bar reference: max class prob (noul: max(p,1-p)) of every answer, single only
const bar = [];
for (const s of ["done-v2", "injection", "verify-v2"]) for (const r of rows(s)) for (const [k, a] of Object.entries(r.answers)) {
  if (a.type === "noul") bar.push({ v: Math.max(a.noul, 1 - a.noul), s, c: r.case + ":" + k, kind: "single" });
  else if (a.type === "choice") bar.push({ v: Math.max(...Object.values(a.probabilities)), s, c: r.case + ":" + k, kind: "single" });
}
const out = { totals: { records: ["done-v2", "injection", "verify-v2"].reduce((n, s) => n + rows(s).length, 0), verify_claim_pairs: verifyMeans }, thresholds: {}, notrecorded: [] };
const geq = (q, k) => !(q === "done.met" && k === "missing");
for (const [q, ks] of Object.entries(TH)) for (const [k, t] of Object.entries(ks)) {
  const key = `${q}.${k}`; const list = bands[key];
  if (!list) { out.notrecorded.push(key); continue; }
  const dp = (v) => v; // raw
  const res = { t, n: list.length, over2dec: list.filter((x) => dec(x.v) > 2).length, single: list.filter((x) => x.kind === "single").length, mean2: list.filter((x) => x.kind === "mean2").length, flips: {}, near01: 0, near005: 0, exactlyAtBand: 0, near_list: [] };
  const eps = 1e-9;
  const pass = (v) => (geq(q, k) ? v >= t - eps : !(v < t - eps)); // for "missing": pass==not missing
  for (const [name, f] of Object.entries(schemes)) res.flips[name] = list.filter((x) => pass(x.v) !== pass(f(x.v))).length;
  for (const x of list) { if (x.v >= t - 0.01 - eps && x.v < t - eps) { res.near01++; res.near_list.push(`${x.s}/${x.c}=${+x.v.toFixed(4)}${x.kind === "mean2" ? "(mean)" : ""}`); } if (x.v >= t - 0.005 - eps && x.v < t - eps) res.near005++; if (Math.abs(x.v - t) < eps) res.exactlyAtBand++; }
  out.thresholds[key] = res;
}
// 0.90 bar
const t = 0.9, eps = 1e-9;
out.bar090 = { n: bar.length, over2dec: bar.filter((x) => dec(x.v) > 2).length, flips: Object.fromEntries(Object.entries(schemes).map(([n, f]) => [n, bar.filter((x) => (x.v >= t - eps) !== (f(x.v) >= t - eps)).length])), near01: bar.filter((x) => x.v >= t - 0.01 - eps && x.v < t - eps).length, near005: bar.filter((x) => x.v >= t - 0.005 - eps && x.v < t - eps).length };
// decimals histogram of means for display (what floor actually touches)
const means = Object.values(bands).flat().filter((x) => x.kind === "mean2");
out.mean2_values = { n: means.length, over2dec: means.filter((x) => dec(+x.v.toFixed(6)) > 2).length };
// Supplementary: decide-close & decide order files (24 orders + reask) for decide.best clear/margin and reask noise
const sup = {};
for (const f of ["decide/order-2026-09-30.json", "decide-close/order-2026-10-01.json"]) {
  const j = JSON.parse(readFileSync(R + f, "utf8"));
  const dd = Object.values(j.decisions);
  const reask = dd.map((d) => d.reask_max_delta).filter((x) => x != null).sort((a, b) => a - b);
  const pct = (a, q) => a[Math.max(0, Math.ceil(q * a.length) - 1)];
  // raw 2-order mean (written+reversed) for each decision: use the 24-order answers: pairs of order and its reverse
  const flips = { floor2: 0, halfup2: 0, round3: 0 }, near = { clear: 0, margin: 0 }; let pairs = 0, over2 = 0;
  for (const d of j.raw) {
    const byKey = new Map(d.orders.map((o) => [o.order.join(","), o.p]));
    for (const o of d.orders) { const rev = byKey.get([...o.order].reverse().join(",")); if (!rev) continue; // each unordered pair visited twice, fine
      const mean = Object.fromEntries(Object.keys(o.p).map((n) => [n, (o.p[n] + rev[n]) / 2]));
      const r = Object.entries(mean).sort((a, b) => b[1] - a[1]); const p1 = r[0][1], p2 = r[1][1]; pairs++;
      if (dec(+p1.toFixed(6)) > 2) over2++;
      const clearRaw = p1 >= 0.85 - eps, marRaw = p1 - p2 >= 0.1 - eps;
      for (const [n, f] of Object.entries(schemes)) { if (!(n in flips)) continue; const cd = clearRaw !== (f(p1) >= 0.85 - eps); const md = marRaw !== (f(p1) - f(p2) >= 0.1 - eps); if (cd || md) flips[n]++; }
      if (p1 >= 0.84 - eps && p1 < 0.85 - eps) near.clear++; if (p1 - p2 >= 0.09 - eps && p1 - p2 < 0.1 - eps) near.margin++;
    }
  }
  sup[f] = { decisions: dd.length, reask_max_delta: { n: reask.length, max: reask[reask.length - 1], p95: pct(reask, 0.95), median: reask[Math.floor(reask.length / 2)], gt001: reask.filter((x) => x > 0.01 + eps).length, ge004: reask.filter((x) => x >= 0.04 - eps).length }, written_reversed_pairs_all_orders: pairs, pairs_mean_over2dec: over2, flips_vs_raw_if_display_used: flips, near_clear_below001: near.clear, near_margin_below001: near.margin };
}
out.supplementary_decide = sup;
writeFileSync(new URL("partA.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
