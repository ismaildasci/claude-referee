// Offline analysis of the option-order scale study (rules: docs/decisions/decide-order-scale.md): policies against leave-out and full-set references, clustered bootstrap, decision rule, slot, name and length checks.
// Usage: node scripts/decide-scale/analyze.mjs [--out jev-evals/decide-scale/results.json] [--md docs/measurements-decide-order-scale.md.part]; reads recorded-main.jsonl, recorded-rename.jsonl and the two older order reports.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SOURCES, WAVE2, key, loadCases, mulberry32, orderPlan, seedOf, shuffled } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const OUT = flag("--out", join(ROOT, "jev-evals/decide-scale/results.json"));
const MD = flag("--md", null);
const SETS = flag("--sets", "close,holdout,a,b").split(",");
const EPS = 1e-9;
const CLEAR_AT = 0.85;
const MARGIN = 0.1;
const TIE_MARGIN = 0.08;
const DRAWS = 200;
const BOOT = 2000;
const BOOT_SEED = 20261005;
const ge = (x, y) => x >= y - EPS;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r4 = (x) => (Number.isFinite(x) ? Number(x.toFixed(4)) : null);

const jsonl = (path) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
function loadRecorded(stage, files = [stage]) {
  const byCase = new Map();
  for (const r of files.flatMap((f) => jsonl(join(ROOT, `jev-evals/decide-scale/recorded-${f}.jsonl`)))) {
    if (!byCase.has(r.case)) byCase.set(r.case, new Map());
    byCase.get(r.case).set(key(r.order), r.p);
  }
  return byCase;
}

function meanOver(ans, keys, names) {
  const m = Object.fromEntries(names.map((n) => [n, 0]));
  for (const k of keys) for (const n of names) m[n] += (ans.get(k)?.[n] ?? 0) / keys.length;
  return m;
}
const argmaxOf = (p, names) => names.reduce((best, n) => (p[n] > p[best] + EPS ? n : best), names[0]);
function top2(p, names) {
  const v = names.map((n) => p[n]).sort((a, b) => b - a);
  return { p1: v[0], p2: v[1] ?? 0 };
}
const refVerdict = (p, names) => {
  const { p1, p2 } = top2(p, names);
  return ge(p1 - p2, MARGIN) ? (ge(p1, CLEAR_AT) ? "clear" : "weak") : "tie";
};
function polVerdict(p, names, orderLeaders, unanimous) {
  const disagree = unanimous && new Set(orderLeaders).size > 1;
  if (disagree) return "tie";
  return refVerdict(p, names);
}

const cases = loadCases([...SOURCES, ...WAVE2]).filter((c) => SETS.includes(c.src));
const main = loadRecorded("main", ["main", "wave2"]);
const rename = loadRecorded("rename");
const data = [];
for (const c of cases) {
  const ans = main.get(c.id);
  if (!ans) continue;
  const plan = orderPlan(c);
  const poolKeys = plan.pool.map(key);
  if (!poolKeys.every((k) => ans.has(k))) continue;
  const fixedKeys = [...new Set(plan.fixed.map(key))];
  if (plan.n >= 5 && !fixedKeys.every((k) => ans.has(k))) continue;
  const names = c.written;
  const ref = meanOver(ans, poolKeys, names);
  const { p1, p2 } = top2(ref, names);
  data.push({ c, id: c.id, src: c.src, n: plan.n, names, ans, poolKeys, fixedKeys, plan, ref, refLeader: argmaxOf(ref, names), margin: p1 - p2, nearTie: p1 - p2 < TIE_MARGIN - EPS, refV: refVerdict(ref, names) });
}

function policySets(d) {
  const n = d.n;
  const rot = d.plan.fixed.slice(0, n).map(key);
  const revrot = d.plan.fixed.slice(n).map(key);
  const fixed = {
    written: [[rot[0]]],
    wr: [[rot[0], revrot[0]]],
    rot3: [rot.slice(0, 3)],
    rot4: n >= 4 ? [rot.slice(0, 4)] : null,
    rot5: n >= 5 ? [rot.slice(0, 5)] : null,
    rot6: n >= 6 ? [rot.slice(0, 6)] : null,
    latin: [rot],
    latin_rev: [[...rot, ...revrot]],
  };
  const out = { ...fixed };
  for (const k of [1, 2, 3, 4, 6, 8, 12]) {
    const rng = mulberry32(seedOf(`decide-scale-draw:${d.id}:${k}`));
    out[`rand${k}`] = d.poolKeys.length >= k ? Array.from({ length: DRAWS }, () => shuffled(d.poolKeys, rng).slice(0, k)) : null;
  }
  return out;
}
export const POLICIES = ["written", "wr", "rot3", "rot4", "rot5", "rot6", "latin", "latin_rev", "rand1", "rand2", "rand3", "rand4", "rand6", "rand8", "rand12"];
const requestsOf = (name, n) => ({ written: 1, wr: 2, rot3: 3, rot4: 4, rot5: 5, rot6: 6, latin: n, latin_rev: 2 * n })[name] ?? Number(name.slice(4));

function oneSet(d, Q, mode, unanimous) {
  const inQ = new Set(Q);
  const pool = d.poolKeys;
  const refKeys = mode === "leave" ? pool.filter((k) => !inQ.has(k)) : pool;
  if (refKeys.length < 2) return null;
  const ref = mode === "leave" ? meanOver(d.ans, refKeys, d.names) : d.ref;
  const refLeader = argmaxOf(ref, d.names);
  const pol = meanOver(d.ans, Q, d.names);
  const leaders = Q.map((k) => argmaxOf(d.ans.get(k), d.names));
  const polLeader = argmaxOf(pol, d.names);
  const refV = refVerdict(ref, d.names);
  const v = polVerdict(pol, d.names, leaders, unanimous);
  return {
    agree: polLeader === refLeader ? 1 : 0,
    regret: ref[refLeader] - ref[polLeader],
    mae: avg(d.names.map((n) => Math.abs(pol[n] - ref[n]))),
    topErr: Math.abs(top2(pol, d.names).p1 - top2(ref, d.names).p1),
    vagree: v === refV ? 1 : 0,
    clear: v === "clear" ? 1 : 0,
    falseClear: v === "clear" && refV !== "clear" ? 1 : 0,
    missedClear: refV === "clear" && v !== "clear" ? 1 : 0,
    conf: `${v}>${refV}`,
  };
}
function evaluate(d, sets, mode, unanimous) {
  if (!sets) return null;
  const rows = sets.map((Q) => oneSet(d, Q, mode, unanimous));
  if (rows.some((r) => r === null)) return null;
  const mean = (f) => avg(rows.map((r) => r[f]));
  const conf = {};
  for (const r of rows) conf[r.conf] = (conf[r.conf] ?? 0) + 1 / rows.length;
  return { agree: mean("agree"), regret: mean("regret"), mae: mean("mae"), topErr: mean("topErr"), vagree: mean("vagree"), clear: mean("clear"), falseClear: mean("falseClear"), missedClear: mean("missedClear"), conf };
}

const results = {};
const setsByCase = data.map(policySets);
for (const mode of ["leave", "full"]) {
  for (const verdictVariant of ["unanimous", "mean"]) {
    const bucket = `${mode}_${verdictVariant}`;
    results[bucket] = {};
    for (const name of POLICIES) results[bucket][name] = data.map((d, i) => evaluate(d, setsByCase[i][name], mode, verdictVariant === "unanimous"));
  }
}

function boot(idx, stat) {
  const rng = mulberry32(BOOT_SEED);
  const vals = [];
  for (let b = 0; b < BOOT; b++) {
    const s = Array.from({ length: idx.length }, () => idx[Math.floor(rng() * idx.length)]);
    const v = stat(s);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  if (vals.length < BOOT * 0.5) return { lo: null, hi: null };
  return { lo: r4(vals[Math.floor(0.025 * vals.length)]), hi: r4(vals[Math.min(vals.length - 1, Math.ceil(0.975 * vals.length) - 1)]) };
}
const meanStat = (arr, f) => (idx) => avg(idx.map((i) => arr[i][f]));
const ratioStat = (arr, num, den) => (idx) => {
  const d = idx.reduce((s, i) => s + arr[i][den], 0);
  return d > 0 ? idx.reduce((s, i) => s + arr[i][num], 0) / d : NaN;
};
function summarize(arr, idx, f, kind = "mean") {
  const ok = idx.filter((i) => arr[i]);
  if (ok.length === 0) return { n: 0, value: null, lo: null, hi: null };
  const stat = kind === "mean" ? meanStat(arr, f) : ratioStat(arr, f, "clear");
  const value = stat(ok);
  return { n: ok.length, value: r4(value), ...boot(ok, stat) };
}

const idxAll = data.map((_, i) => i);
const rule = idxAll.filter((i) => data[i].n >= 4);
const near = rule.filter((i) => data[i].nearTie);
const n3 = idxAll.filter((i) => data[i].n === 3);
const n3near = n3.filter((i) => data[i].nearTie);

function table(bucket, idx, nearIdx) {
  const rows = [];
  for (const name of POLICIES) {
    const arr = results[bucket][name];
    const ok = idx.filter((i) => arr[i]);
    if (ok.length === 0) continue;
    const okNear = nearIdx.filter((i) => arr[i]);
    const clearN = ok.reduce((s, i) => s + arr[i].clear, 0);
    const fc = summarize(arr, ok, "falseClear", "ratio");
    rows.push({
      policy: name,
      applicable: ok.length,
      requests_per_decision: r4(avg(ok.map((i) => requestsOf(name, data[i].n)))),
      agree: summarize(arr, ok, "agree"),
      agree_near: summarize(arr, okNear, "agree"),
      regret: summarize(arr, ok, "regret"),
      mae: summarize(arr, ok, "mae"),
      top_err: summarize(arr, ok, "topErr"),
      verdict_agree: summarize(arr, ok, "vagree"),
      clear_verdicts: r4(clearN),
      false_clear: { ...fc, k: r4(ok.reduce((s, i) => s + arr[i].falseClear, 0)), n: r4(clearN) },
      missed_clear: summarize(arr, ok, "missedClear"),
    });
  }
  return rows;
}

const tables = {};
for (const bucket of Object.keys(results)) {
  tables[bucket] = { rule: table(bucket, rule, near), n3: table(bucket, n3, n3near) };
}

function applyRule(rows) {
  const candidates = rows.filter((r) => r.applicable === rule.length && !["rot5", "rot6"].includes(r.policy));
  const best = Math.max(...candidates.map((r) => r.agree_near.value));
  const qualifies = candidates.filter((r) => r.agree_near.value >= best - 0.05 - EPS && (r.false_clear.n === 0 || r.false_clear.value <= 0.05 + EPS));
  qualifies.sort((a, b) => a.requests_per_decision - b.requests_per_decision || a.mae.value - b.mae.value);
  return { best_near_tie_agreement: best, qualifying: qualifies.map((r) => r.policy), recommended: qualifies[0]?.policy ?? null };
}
const ruleResult = {};
for (const bucket of Object.keys(results)) ruleResult[bucket] = applyRule(tables[bucket].rule);

function pairedVsWr(bucket) {
  const wr = results[bucket]["wr"];
  const out = {};
  for (const name of POLICIES) {
    const arr = results[bucket][name];
    if (name === "wr" || !arr) continue;
    const ok = near.filter((i) => arr[i] && wr[i]);
    if (ok.length === 0) continue;
    const stat = (idx) => avg(idx.map((i) => arr[i].agree - wr[i].agree));
    out[name] = { n_near: ok.length, diff_near_tie_agreement: r4(stat(ok)), ...boot(ok, stat) };
  }
  return out;
}
const vsWr = { leave_unanimous: pairedVsWr("leave_unanimous"), full_unanimous: pairedVsWr("full_unanimous") };

// slot effect: probability = option effect + slot effect, alternating means over the pool
function slotEffects(d) {
  const rows = d.poolKeys.map((k) => ({ k, order: k.split(","), p: d.ans.get(k) }));
  const a = Object.fromEntries(d.names.map((n) => [n, 0]));
  const b = Array(d.n).fill(0);
  for (let it = 0; it < 40; it++) {
    for (const n of d.names) {
      const v = rows.map((r) => r.p[n] - b[r.order.indexOf(n)]);
      a[n] = avg(v);
    }
    for (let s = 0; s < d.n; s++) b[s] = avg(d.names.flatMap((n) => rows.filter((r) => r.order[s] === n).map((r) => r.p[n] - a[n])));
    const m = avg(b);
    for (let s = 0; s < d.n; s++) b[s] -= m;
  }
  return b;
}
const slots = data.map(slotEffects);
function slotSummary(idx) {
  const first = idx.map((i) => slots[i][0]);
  const last = idx.map((i) => slots[i][data[i].n - 1]);
  const stat = (f) => (ix) => avg(ix.map((i) => f(i)));
  const f1 = stat((i) => slots[i][0]);
  const fl = stat((i) => slots[i][data[i].n - 1]);
  const fd = stat((i) => slots[i][0] - slots[i][data[i].n - 1]);
  return { n: idx.length, first: { value: r4(avg(first)), ...boot(idx, f1) }, last: { value: r4(avg(last)), ...boot(idx, fl) }, first_minus_last: { value: r4(avg(idx.map((i) => slots[i][0] - slots[i][data[i].n - 1]))), ...boot(idx, fd) } };
}
const slotResult = { all: slotSummary(idxAll) };
for (const n of [3, 4, 5, 6]) {
  const idx = idxAll.filter((i) => data[i].n === n);
  if (idx.length >= 3) slotResult[`n${n}`] = slotSummary(idx);
}

// written order as policy: first-listed gain against the pool without the written order; leader first-listed in the authored order
const writtenFirst = data.map((d) => {
  const w = key(d.names);
  const refKeys = d.poolKeys.filter((k) => k !== w);
  const ref = meanOver(d.ans, refKeys, d.names);
  return { gain: d.ans.get(w)[d.names[0]] - ref[d.names[0]], authoredFirstLeader: d.refLeader === d.c.authored[0] ? 1 : 0, expected: 1 / d.n };
});
const bySrc = {};
for (const src of ["close", "holdout", "a", "b", "c", "d"]) {
  const idx = idxAll.filter((i) => data[i].src === src);
  if (idx.length === 0) continue;
  bySrc[src] = {
    n: idx.length,
    first_listed_gain_written: { value: r4(avg(idx.map((i) => writtenFirst[i].gain))), ...boot(idx, (ix) => avg(ix.map((i) => writtenFirst[i].gain))) },
    leader_first_in_authored_order: r4(avg(idx.map((i) => writtenFirst[i].authoredFirstLeader))),
    expected_by_chance: r4(avg(idx.map((i) => writtenFirst[i].expected))),
    near_tie_share: r4(avg(idx.map((i) => (data[i].nearTie ? 1 : 0)))),
    reference_verdicts: Object.fromEntries(["clear", "weak", "tie"].map((v) => [v, idx.filter((i) => data[i].refV === v).length])),
    mean_margin: r4(avg(idx.map((i) => data[i].margin))),
  };
}
const writtenAll = { n: idxAll.length, first_listed_gain_written: { value: r4(avg(writtenFirst.map((x) => x.gain))), ...boot(idxAll, (ix) => avg(ix.map((i) => writtenFirst[i].gain))) } };

// length association
function ranks(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = Array(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let t = i; t <= j; t++) r[idx[t][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}
function spearman(x, y) {
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = avg(rx);
  const my = avg(ry);
  const num = rx.reduce((s, v, i) => s + (v - mx) * (ry[i] - my), 0);
  const den = Math.sqrt(rx.reduce((s, v) => s + (v - mx) ** 2, 0) * ry.reduce((s, v) => s + (v - my) ** 2, 0));
  return den > 0 ? num / den : NaN;
}
const lenCorr = data.map((d) => ({ text: spearman(d.names.map((n) => d.c.options[n].length), d.names.map((n) => d.ref[n])), name: spearman(d.names.map((n) => n.length), d.names.map((n) => d.ref[n])) }));
const longest = data.map((d) => {
  const L = d.names.map((n) => d.c.options[n].length);
  const mx = Math.max(...L);
  const tops = d.names.filter((_, i) => L[i] === mx);
  return { hit: tops.includes(d.refLeader) ? 1 / tops.length : 0, exp: 1 / d.n };
});
const lenBySrc = Object.fromEntries(["close", "holdout", "a", "b", "c", "d"].filter((src) => SETS.includes(src)).map((src) => {
  const idx = idxAll.filter((i) => data[i].src === src && Number.isFinite(lenCorr[i].text));
  return [src, { n: idx.length, text_length_spearman: { value: r4(avg(idx.map((i) => lenCorr[i].text))), ...boot(idx, (ix) => avg(ix.map((i) => lenCorr[i].text))) }, mean_option_chars: r4(avg(data.filter((d) => d.src === src).flatMap((d) => d.names.map((n) => d.c.options[n].length)))) }];
}));
const okLen = idxAll.filter((i) => Number.isFinite(lenCorr[i].text));
const okName = idxAll.filter((i) => Number.isFinite(lenCorr[i].name));
const lengthResult = {
  text_length_spearman: { n: okLen.length, value: r4(avg(okLen.map((i) => lenCorr[i].text))), ...boot(okLen, (ix) => avg(ix.map((i) => lenCorr[i].text))) },
  name_length_spearman: { n: okName.length, value: r4(avg(okName.map((i) => lenCorr[i].name))), ...boot(okName, (ix) => avg(ix.map((i) => lenCorr[i].name))) },
  by_source: lenBySrc,
  leader_is_longest_text: { value: r4(avg(longest.map((x) => x.hit))), expected: r4(avg(longest.map((x) => x.exp))), ...boot(idxAll, (ix) => avg(ix.map((i) => longest[i].hit))) },
};

// replicate noise floor (older 24-order runs) and rename arm
const old = new Map();
for (const [file, prefix] of [["jev-evals/decide-close/order-2026-10-01.json", "close"], ["jev-evals/decide/order-2026-09-30.json", "holdout"]]) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  for (const r of JSON.parse(readFileSync(path, "utf8")).raw) old.set(`${prefix}/${r.id}`, new Map(r.orders.map((o) => [o.order.join(","), o.p])));
}
function shiftBetween(d, ansA, ansB) {
  const keys = d.poolKeys;
  if (!keys.every((k) => ansA.has(k) && ansB.has(k))) return null;
  const a = meanOver(ansA, keys, d.names);
  const b = meanOver(ansB, keys, d.names);
  return { mae: avg(d.names.map((n) => Math.abs(a[n] - b[n]))), max: Math.max(...d.names.map((n) => Math.abs(a[n] - b[n]))), flip: argmaxOf(a, d.names) !== argmaxOf(b, d.names) ? 1 : 0 };
}
const floor = idxAll.map((i) => (old.has(data[i].id) ? shiftBetween(data[i], data[i].ans, old.get(data[i].id)) : null));
const floorIdx = idxAll.filter((i) => floor[i]);
const nameShift = idxAll.map((i) => {
  const d = data[i];
  const neutral = rename.get(d.id);
  if (!neutral) return null;

  return shiftBetween(d, d.ans, neutral);
});
const nameIdx = idxAll.filter((i) => nameShift[i]);
const nameCloseIdx = nameIdx.filter((i) => floor[i]);
const noiseResult = {
  floor_old_vs_new: { n: floorIdx.length, mae: { value: r4(avg(floorIdx.map((i) => floor[i].mae))), ...boot(floorIdx, (ix) => avg(ix.map((i) => floor[i].mae))) }, max_mean: r4(avg(floorIdx.map((i) => floor[i].max))), leader_flips: r4(floorIdx.reduce((s, i) => s + floor[i].flip, 0)) },
  rename_all: { n: nameIdx.length, mae: { value: r4(avg(nameIdx.map((i) => nameShift[i].mae))), ...boot(nameIdx, (ix) => avg(ix.map((i) => nameShift[i].mae))) }, max_mean: r4(avg(nameIdx.map((i) => nameShift[i].max))), leader_flips: r4(nameIdx.reduce((s, i) => s + nameShift[i].flip, 0)) },
  rename_vs_floor_same_decisions: {
    n: nameCloseIdx.length,
    rename_mae: r4(avg(nameCloseIdx.map((i) => nameShift[i].mae))),
    floor_mae: r4(avg(nameCloseIdx.map((i) => floor[i].mae))),
    diff: { value: r4(avg(nameCloseIdx.map((i) => nameShift[i].mae - floor[i].mae))), ...boot(nameCloseIdx, (ix) => avg(ix.map((i) => nameShift[i].mae - floor[i].mae))) },
    rename_flips: r4(nameCloseIdx.reduce((s, i) => s + nameShift[i].flip, 0)),
    floor_flips: r4(nameCloseIdx.reduce((s, i) => s + floor[i].flip, 0)),
  },
};

const receipts = ["main", "rename", "screen", "wave2"].flatMap((s) => (existsSync(join(ROOT, `jev-evals/decide-scale/receipts-${s}.json`)) ? JSON.parse(readFileSync(join(ROOT, `jev-evals/decide-scale/receipts-${s}.json`), "utf8")).map((r) => ({ stage: s, ...r })) : []));
const cost = { receipts: receipts.length, requests: receipts.reduce((s, r) => s + r.requests, 0), cached: receipts.reduce((s, r) => s + r.cached, 0), input_tokens: receipts.reduce((s, r) => s + r.input_tokens, 0), cost_usd: r4(receipts.reduce((s, r) => s + r.cost_usd, 0)), replaced: receipts.reduce((s, r) => s + (r.replaced ?? 0), 0), stopped: receipts.reduce((s, r) => s + (r.stopped ?? 0), 0) };

const marginBins = [[0, 0.04], [0.04, 0.08], [0.08, 0.2], [0.2, 1.01]];
const byMargin = marginBins.map(([lo, hi]) => {
  const idx = rule.filter((i) => data[i].margin >= lo - EPS && data[i].margin < hi - EPS);
  const row = { bin: `[${lo}, ${Math.min(hi, 1)})`, n: idx.length };
  for (const name of ["written", "wr", "rot3", "latin", "latin_rev", "rand4", "rand8"]) {
    const arr = results["leave_unanimous"][name];
    const ok = idx.filter((i) => arr[i]);
    row[name] = ok.length ? r4(avg(ok.map((i) => arr[i].agree))) : null;
  }
  return row;
});

const report = {
  date: new Date().toISOString(),
  sets: SETS,
  decisions: { total: data.length, by_n: Object.fromEntries([3, 4, 5, 6].map((n) => [n, data.filter((d) => d.n === n).length])), rule_set_n_ge_4: rule.length, near_ties_in_rule_set: near.length, n3: n3.length, n3_near: n3near.length, near_tie_share_all: r4(avg(data.map((d) => (d.nearTie ? 1 : 0)))) },
  tables,
  rule: ruleResult,
  paired_vs_wr_near_tie: vsWr,
  agreement_by_reference_margin: byMargin,
  slot_effect: slotResult,
  written_order: { all: writtenAll, by_source: bySrc },
  length: lengthResult,
  noise: noiseResult,
  cost,
};
writeFileSync(OUT, JSON.stringify(report, null, 1) + "\n");
console.log(`wrote ${OUT}: ${data.length} decisions (${rule.length} with n>=4, ${near.length} near-ties among them)`);
console.log(JSON.stringify({ rule: ruleResult, cost }, null, 1));
if (MD) console.log(`(markdown rendering is done by hand from ${OUT})`);
