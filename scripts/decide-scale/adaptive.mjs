// Gate 1 of docs/decisions/decide-balanced-near-ties.md: replays the policy "adaptive" (wr, plus latin_rev with the mean-only verdict when wr is a tie) on the order study's recorded answers.
// Same data, filter, references and metrics as analyze.mjs; also re-derives wr and latin_rev so the replay can be checked against the published study numbers.
// Usage: node scripts/decide-scale/adaptive.mjs [--out jev-evals/decide-scale/results-adaptive.json]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SOURCES, WAVE2, key, loadCases, mulberry32, orderPlan } from "./lib.mjs";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : join(ROOT, "jev-evals/decide-scale/results-adaptive.json");
const EPS = 1e-9;
const CLEAR_AT = 0.85;
const MARGIN = 0.1;
const TIE_MARGIN = 0.08;
const BOOT = 2000;
const BOOT_SEED = 20261005;
const ge = (x, y) => x >= y - EPS;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r4 = (x) => (Number.isFinite(x) ? Number(x.toFixed(4)) : null);
const jsonl = (path) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

function loadRecorded(files) {
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
const polVerdict = (p, names, leaders, unanimous) => (unanimous && new Set(leaders).size > 1 ? "tie" : refVerdict(p, names));

const cases = loadCases([...SOURCES, ...WAVE2]);
const main = loadRecorded(["main", "wave2"]);
const rep = loadRecorded(["rep"]);
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
  const ans2 = rep.get(c.id) && poolKeys.every((k) => rep.get(c.id).has(k)) ? rep.get(c.id) : null;
  data.push({ id: c.id, src: c.src, n: plan.n, names, ans, ans2, poolKeys, plan, nearTie: p1 - p2 < TIE_MARGIN - EPS });
}

function orders(d) {
  const rot = d.plan.fixed.slice(0, d.n).map(key);
  const revrot = d.plan.fixed.slice(d.n).map(key);
  return { wr: [rot[0], revrot[0]], latin_rev: [...rot, ...revrot] };
}
function adaptiveChoice(d) {
  const { wr, latin_rev } = orders(d);
  const m = meanOver(d.ans, wr, d.names);
  const leaders = wr.map((k) => argmaxOf(d.ans.get(k), d.names));
  const tie = polVerdict(m, d.names, leaders, true) === "tie";
  return d.n >= 3 && tie ? { Q: latin_rev, unanimous: false, triggered: true } : { Q: wr, unanimous: true, triggered: false };
}
const POLICIES = {
  wr: (d) => ({ Q: orders(d).wr, unanimous: true, triggered: false }),
  latin_rev_unanimous: (d) => ({ Q: orders(d).latin_rev, unanimous: true, triggered: false }),
  latin_rev_mean: (d) => ({ Q: orders(d).latin_rev, unanimous: false, triggered: false }),
  adaptive: adaptiveChoice,
};

function oneRow(d, choice, mode) {
  const { Q, unanimous } = choice;
  const inQ = new Set(Q);
  const refKeys = mode === "leave" ? d.poolKeys.filter((k) => !inQ.has(k)) : d.poolKeys;
  if (refKeys.length < 2) return null;
  const ref = mode === "leave" ? meanOver(d.ans, refKeys, d.names) : mode === "rep" ? meanOver(d.ans2, d.poolKeys, d.names) : meanOver(d.ans, d.poolKeys, d.names);
  const refLeader = argmaxOf(ref, d.names);
  const pol = meanOver(d.ans, Q, d.names);
  const leaders = Q.map((k) => argmaxOf(d.ans.get(k), d.names));
  const v = polVerdict(pol, d.names, leaders, unanimous);
  const refV = refVerdict(ref, d.names);
  return { agree: argmaxOf(pol, d.names) === refLeader ? 1 : 0, vagree: v === refV ? 1 : 0, clear: v === "clear" ? 1 : 0, falseClear: v === "clear" && refV !== "clear" ? 1 : 0, requests: Q.length, triggered: choice.triggered ? 1 : 0 };
}

function boot(idx, stat) {
  const rng = mulberry32(BOOT_SEED);
  const vals = [];
  for (let b = 0; b < BOOT; b++) {
    const v = stat(Array.from({ length: idx.length }, () => idx[Math.floor(rng() * idx.length)]));
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  return vals.length < BOOT * 0.5 ? [null, null] : [r4(vals[Math.floor(0.025 * vals.length)]), r4(vals[Math.min(vals.length - 1, Math.ceil(0.975 * vals.length) - 1)])];
}
const meanOf = (rows, f) => (idx) => avg(idx.map((i) => rows[i][f]));
function summary(rows, idx, nearIdx) {
  const clears = idx.reduce((s, i) => s + rows[i].clear, 0);
  const falseClears = idx.reduce((s, i) => s + rows[i].falseClear, 0);
  return {
    decisions: idx.length,
    near_ties: nearIdx.length,
    agree: r4(meanOf(rows, "agree")(idx)),
    agree_ci: boot(idx, meanOf(rows, "agree")),
    agree_near: r4(meanOf(rows, "agree")(nearIdx)),
    agree_near_ci: boot(nearIdx, meanOf(rows, "agree")),
    verdict_agree: r4(meanOf(rows, "vagree")(idx)),
    clear_verdicts: clears,
    false_clear_of_clear: clears ? r4(falseClears / clears) : 0,
    false_clear_of_all: r4(falseClears / idx.length),
    requests_per_decision: r4(meanOf(rows, "requests")(idx)),
    trigger_rate: r4(meanOf(rows, "triggered")(idx)),
  };
}

const out = { decisions: data.length, by_n: Object.fromEntries([3, 4, 5, 6].map((n) => [n, data.filter((d) => d.n === n).length])), references: {} };
const groups = { rule: data.flatMap((d, i) => (d.n >= 4 ? [i] : [])), n3: data.flatMap((d, i) => (d.n === 3 ? [i] : [])) };
for (const mode of ["leave", "full", "rep"]) {
  out.references[mode] = {};
  for (const [g, idx] of Object.entries(groups)) {
    out.references[mode][g] = {};
    for (const [name, choose] of Object.entries(POLICIES)) {
      const rows = data.map((d) => oneRow(d, choose(d), mode));
      const ok = idx.filter((i) => rows[i]);
      out.references[mode][g][name] = summary(rows, ok, ok.filter((i) => data[i].nearTie));
    }
  }
}
const pass = {};
for (const mode of ["leave", "full", "rep"]) {
  const a = out.references[mode].rule.adaptive;
  const w = out.references[mode].rule.wr;
  pass[mode] = {
    near_tie_gain: a.agree_near >= w.agree_near + 0.15 - EPS,
    no_overall_loss: a.agree >= w.agree - 0.01 - EPS,
    false_clear: a.false_clear_of_clear <= 0.05 + EPS,
    verdict_agreement: a.verdict_agree >= w.verdict_agree - 0.02 - EPS,
  };
}
out.gate1 = { pass, passed: Object.values(pass).every((p) => Object.values(p).every(Boolean)) };
out.false_clear_ids = Object.fromEntries(["wr", "adaptive"].map((name) => [name, data.flatMap((d) => (d.n >= 4 && oneRow(d, POLICIES[name](d), "full")?.falseClear ? [d.id] : []))]));
out.gate2_candidates = data.filter((d) => d.n >= 4 && adaptiveChoice(d).triggered).slice(0, 8).map((d) => d.id);
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify({ gate1: out.gate1, gate2_candidates: out.gate2_candidates }, null, 1));
