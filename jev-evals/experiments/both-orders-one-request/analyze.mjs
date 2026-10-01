// Scores the one-request pilot against the criteria in DECISION_DRAFT.md. Usage: node analyze.mjs [raw.jsonl] [cli.jsonl] [out.json]  (cwd = repo root)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const S = "<scratchpad>/both-orders-one-request";
const [rawPath = `${S}/raw.jsonl`, cliPath = `${S}/cli.jsonl`, outPath = `${S}/results.json`] = process.argv.slice(2);
const lines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const cases = lines("jev-evals/decide-close/cases.jsonl");
const exist = JSON.parse(readFileSync("jev-evals/decide-close/order-2026-10-01.json", "utf8"));
const rawAll = lines(rawPath);
const raw = rawAll.filter((r) => r.round > 0);
const cli = new Map(lines(cliPath).map((r) => [r.id, r]));
const eqArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const argmax = (p) => Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
const margin = (p) => { const v = Object.values(p).sort((a, b) => b - a); return v[0] - v[1]; };
const mean2 = (w, r, names) => Object.fromEntries(names.map((n) => [n, ((w[n] ?? 0) + (r[n] ?? 0)) / 2]));
const gap = (w, r, names) => Math.max(...names.map((n) => Math.abs((w[n] ?? 0) - (r[n] ?? 0))));
const delta = (a, b, names) => Math.max(...names.map((n) => Math.abs(a[n] - b[n])));
const p95 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.ceil(0.95 * s.length) - 1]; };
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const verdict = (w, r, m) => { const dis = argmax(w) !== argmax(r); const ranked = Object.values(m).sort((a, b) => b - a); const p1 = ranked[0], mg = ranked[0] - ranked[1]; return !dis && p1 >= 0.85 && mg >= 0.1 ? "clear" : !dis && mg >= 0.1 ? "weak" : "tie"; };

const D = cases.map((c) => {
  const names = c.options.map((o) => o.name);
  const rev = [...names].reverse();
  const e = exist.raw.find((r) => r.id === c.id);
  const ew = e.orders.find((o) => eqArr(o.order, names)).p;
  const er = e.orders.find((o) => eqArr(o.order, rev)).p;
  const dec = exist.decisions.find((d) => d.id === c.id);
  const draw = (w, r) => ({ w, r, m: mean2(w, r, names), gap: gap(w, r, names), disagree: argmax(w) !== argmax(r) });
  const get = (arm, round) => { const x = raw.find((q) => q.id === c.id && q.arm === arm && q.round === round); return x ? { ...draw(x.written.probabilities, x.reversed.probabilities), rec: x } : null; };
  return { id: c.id, names, E: draw(ew, er), T1: get("two", 1), T2: get("two", 2), P: [1, 2, 3].map((r) => get("pair", r)), margin24: dec.exact.margin_all24, leader24: dec.leader_all24, CLI: cli.get(c.id) ?? null };
});
const complete = D.filter((d) => d.T1 && d.T2 && d.P.every(Boolean));
const out = { n_decisions: D.length, n_complete: complete.length };
if (complete.length < D.length) { out.warning = "incomplete data"; }
const X = complete;
const N = p95(X.map((d) => delta(d.T1.m, d.T2.m, d.names)));
const T = Math.max(0.04, N);
out.noise = { N_p95_T1_vs_T2: N, T, mean_T1_vs_T2: avg(X.map((d) => delta(d.T1.m, d.T2.m, d.names))), gate_inconclusive: N > 0.10 };
// A leader
const decisiveMargin = Math.max(0.08, 2 * N);
const dec = X.filter((d) => d.margin24 >= 0.08 && margin(d.P[0].m) >= decisiveMargin && margin(d.T1.m) >= decisiveMargin);
const A1diff = dec.filter((d) => argmax(d.P[0].m) !== argmax(d.T1.m)).map((d) => d.id);
const agree = (f, g) => X.filter((d) => argmax(f(d)) === argmax(g(d))).length;
out.A1 = { decisive: dec.length, assessable: dec.length >= 15, leader_differs: A1diff, pass: dec.length < 15 ? "not assessable" : A1diff.length === 0 };
out.A2 = { agree_P1_T1: agree((d) => d.P[0].m, (d) => d.T1.m), agree_T1_T2: agree((d) => d.T1.m, (d) => d.T2.m), agree_P1_E: agree((d) => d.P[0].m, (d) => d.E.m), agree_E_T1: agree((d) => d.E.m, (d) => d.T1.m), agree_P1_P2: agree((d) => d.P[0].m, (d) => d.P[1].m) };
out.A2.pass = out.A2.agree_P1_T1 >= out.A2.agree_T1_T2 - 3;
// B
const dP1T1 = X.map((d) => delta(d.P[0].m, d.T1.m, d.names));
const breaches = X.filter((d, i) => dP1T1[i] > T).map((d) => d.id);
out.B1 = { breaches: breaches.length, of: X.length, cutoff: 11, ids: breaches, pass: breaches.length <= 11 };
out.B2 = { mean_P1_vs_T1: avg(dP1T1), mean_T1_vs_T2: out.noise.mean_T1_vs_T2, diff: avg(dP1T1) - out.noise.mean_T1_vs_T2, p95_P1_vs_T1: p95(dP1T1), max_P1_vs_T1: Math.max(...dP1T1), pass: avg(dP1T1) - out.noise.mean_T1_vs_T2 <= 0.02 };
out.B_extra = { mean_P1_vs_P2: avg(X.map((d) => delta(d.P[0].m, d.P[1].m, d.names))), mean_P1_vs_E: avg(X.map((d) => delta(d.P[0].m, d.E.m, d.names))), mean_T1_vs_E: avg(X.map((d) => delta(d.T1.m, d.E.m, d.names))), mean_T2_vs_E: avg(X.map((d) => delta(d.T2.m, d.E.m, d.names))) };
// C
const Pbar = (d) => Object.fromEntries(d.names.map((n) => [n, avg(d.P.map((p) => p.m[n]))]));
const Tbar = (d) => Object.fromEntries(d.names.map((n) => [n, avg([d.E, d.T1, d.T2].map((p) => p.m[n]))]));
const s = X.map((d) => Pbar(d)[d.leader24] - Tbar(d)[d.leader24]);
const sd = Math.sqrt(avg(s.map((v) => (v - avg(s)) ** 2)) * s.length / (s.length - 1));
out.C1 = { mean_signed_shift_leader_p: avg(s), se: sd / Math.sqrt(s.length), pass: Math.abs(avg(s)) <= 0.03 };
const gP = avg(X.flatMap((d) => d.P.map((p) => p.gap))), gT = avg(X.flatMap((d) => [d.E, d.T1, d.T2].map((p) => p.gap)));
const rP = avg(X.flatMap((d) => d.P.map((p) => (p.disagree ? 1 : 0)))), rT = avg(X.flatMap((d) => [d.E, d.T1, d.T2].map((p) => (p.disagree ? 1 : 0))));
out.C2 = { mean_gap_pair: gP, mean_gap_two: gT, gap_diff_pair_minus_two: gP - gT, disagree_rate_pair: rP, disagree_rate_two: rT, rate_diff: rP - rT, pass: gP >= gT - 0.03 && rP >= rT - 0.10 };
// D
const vOf = (x) => verdict(x.w, x.r, x.m);
const vag = (f, g) => X.filter((d) => vOf(f(d)) === vOf(g(d))).length;
const falseClear = X.filter((d) => vOf(d.P[0]) === "clear" && ![d.E, d.T1, d.T2].some((x) => vOf(x) === "clear")).map((d) => d.id);
out.D = { verdict_agree_P1_T1: vag((d) => d.P[0], (d) => d.T1), verdict_agree_T1_T2: vag((d) => d.T1, (d) => d.T2), false_clear_ids: falseClear, counts: Object.fromEntries(["E", "T1", "T2", "P1", "P2", "P3"].map((k) => [k, X.reduce((a, d) => { const x = k[0] === "P" ? d.P[Number(k[1]) - 1] : d[k]; const v = vOf(x); a[v] = (a[v] ?? 0) + 1; return a; }, {})])) };
out.D.pass = out.D.verdict_agree_P1_T1 >= out.D.verdict_agree_T1_T2 - 4 && falseClear.length <= 2;
// G
out.G = { pair_records: raw.filter((r) => r.arm === "pair").length, note: "structure checked in stored form below" };
const gBad = raw.filter((r) => r.arm === "pair").filter((r) => { const names = cases.find((c) => c.id === r.id).options.map((o) => o.name).sort(); return [r.written, r.reversed].some((a) => !a || a.type !== "choice" || !a.probabilities || !eqArr(Object.keys(a.probabilities).sort(), names)); });
out.G.failures = gBad.length; out.G.pass = gBad.length === 0;
// V
if (cli.size) { const dv = X.filter((d) => d.CLI).map((d) => delta(d.CLI.m ?? d.CLI.p, d.T1.m, d.names)); out.V = { n: dv.length, breaches: dv.filter((v) => v > T).length, mean_CLI_vs_T1: avg(dv), cutoff: 11, pass: dv.filter((v) => v > T).length <= 11, cli_verdict_vs_P1_agree: X.filter((d) => d.CLI && d.CLI.verdict === vOf(d.P[0])).length, cli_verdict_vs_T1_agree: X.filter((d) => d.CLI && d.CLI.verdict === vOf(d.T1)).length, cli_lean_vs_P1_agree: X.filter((d) => d.CLI && d.CLI.lean === argmax(d.P[0].m)).length, cli_lean_vs_T1_agree: X.filter((d) => d.CLI && d.CLI.lean === argmax(d.T1.m)).length, cli_order_disagrees: X.filter((d) => d.CLI?.order_disagrees).length }; }
// tokens & latency (rounds 1,2)
const rr = (arm, round) => X.map((d) => (arm === "pair" ? d.P[round - 1] : round === 1 ? d.T1 : d.T2).rec);
const tokP = [1, 2].flatMap((r) => rr("pair", r).map((x) => x.tokens)), tokT = [1, 2].flatMap((r) => rr("two", r).map((x) => x.tokens));
out.tokens = { pair_total_r12: tokP.reduce((a, b) => a + b, 0), two_total_r12: tokT.reduce((a, b) => a + b, 0), saving_fraction: 1 - tokP.reduce((a, b) => a + b, 0) / tokT.reduce((a, b) => a + b, 0), mean_pair_per_decision: avg(tokP), mean_two_per_decision: avg(tokT), usd_at_0_042_per_M: { pair_per_decision: avg(tokP) * 0.042e-6, two_per_decision: avg(tokT) * 0.042e-6 } };
out.tokens.pass = out.tokens.saving_fraction >= 0.25;
const obs = [];
for (const r of [1, 2]) for (const d of X) { const p = d.P[r - 1].rec, t = (r === 1 ? d.T1 : d.T2).rec; obs.push({ id: d.id, r, p: p.wall_ms, t: t.wall_ms, clean: !p.retried && !t.retried }); }
const clean = obs.filter((o) => o.clean);
out.latency = { observations: obs.length, clean: clean.length, median_pair_ms: median(clean.map((o) => o.p)), median_two_ms: median(clean.map((o) => o.t)), mean_pair_ms: avg(clean.map((o) => o.p)), mean_two_ms: avg(clean.map((o) => o.t)), pair_faster_share: clean.filter((o) => o.p < o.t).length / clean.length, median_saving_ms: median(clean.map((o) => o.t - o.p)), p95_pair_ms: p95(clean.map((o) => o.p)), p95_two_ms: p95(clean.map((o) => o.t)) };
out.latency.claim_allowed = out.latency.pair_faster_share >= 0.6 && out.latency.median_saving_ms >= 150;
out.latency.regression = out.latency.median_pair_ms > 1.25 * out.latency.median_two_ms;
out.requests = { raw_records: raw.length, requests_in_raw_excl_warmup: raw.reduce((a, r) => a + r.requests, 0), requests_in_raw_incl_warmup: rawAll.reduce((a, r) => a + r.requests, 0), retried_records: raw.filter((r) => r.retried).length };
const validity = [out.A1.pass, out.A2.pass, out.B1.pass, out.B2.pass, out.C1.pass, out.C2.pass, out.D.pass, out.G.pass];
out.overall = { noise_gate_inconclusive: out.noise.gate_inconclusive, validity_all_pass_or_na: validity.every((v) => v === true || v === "not assessable"), failed: ["A1", "A2", "B1", "B2", "C1", "C2", "D", "G"].filter((k, i) => !(validity[i] === true || validity[i] === "not assessable")), tokens_benefit: out.tokens.pass };
out.per_decision = X.map((d, i) => ({ id: d.id, leader24: d.leader24, margin24: +d.margin24.toFixed(3), P1_lead: argmax(d.P[0].m), T1_lead: argmax(d.T1.m), T2_lead: argmax(d.T2.m), E_lead: argmax(d.E.m), d_P1_T1: +dP1T1[i].toFixed(3), d_T1_T2: +delta(d.T1.m, d.T2.m, d.names).toFixed(3), gapP: +avg(d.P.map((p) => p.gap)).toFixed(3), gapT: +avg([d.E, d.T1, d.T2].map((p) => p.gap)).toFixed(3) }));
writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
const { per_decision, ...summary } = out;
console.log(JSON.stringify(summary, null, 1));
