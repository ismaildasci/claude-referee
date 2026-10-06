// Author option names against neutral names, scored against the decide-best labels (docs/decisions/decide-neutral-names.md).
// Replays the shipped adaptive rule (as adaptive.mjs) and the 24-order mean on four runs of S1. Usage: node scripts/decide-scale/naming.mjs [--out FILE]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, SOURCES, key, loadCases, orderPlan } from "./lib.mjs";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : join(ROOT, "jev-evals/decide-scale/results-naming.json");
const EPS = 1e-9;
const CLEAR_AT = 0.85;
const MARGIN = 0.1;
const ge = (x, y) => x >= y - EPS;
const jsonl = (path) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

function loadRun(file) {
  const byCase = new Map();
  for (const r of jsonl(join(ROOT, `jev-evals/decide-scale/recorded-${file}.jsonl`))) {
    if (!r.case.startsWith("close/")) continue;
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
function verdictOf(p, names, leaders, unanimous) {
  if (unanimous && new Set(leaders).size > 1) return "tie";
  const v = names.map((n) => p[n]).sort((a, b) => b - a);
  return ge(v[0] - (v[1] ?? 0), MARGIN) ? (ge(v[0], CLEAR_AT) ? "clear" : "weak") : "tie";
}

// The shipped rule: written + reversed; on a two-order tie with 3 to 6 options, the n rotations and their reverses, mean-only verdict.
export { loadRun, meanOver, argmaxOf };

export function adaptive(ans, plan, names) {
  const rot = plan.fixed.slice(0, plan.n).map(key);
  const revrot = plan.fixed.slice(plan.n).map(key);
  const wr = [rot[0], revrot[0]];
  const m = meanOver(ans, wr, names);
  const leaders = wr.map((k) => argmaxOf(ans.get(k), names));
  const tie = verdictOf(m, names, leaders, true) === "tie";
  const Q = plan.n >= 3 && tie ? [...rot, ...revrot] : wr;
  const p = meanOver(ans, Q, names);
  return { leader: argmaxOf(p, names), verdict: verdictOf(p, names, Q.map((k) => argmaxOf(ans.get(k), names)), Q.length === 2), triggered: Q.length > 2, requests: Q.length };
}

function signTest(pos, neg) {
  const n = pos + neg;
  if (n === 0) return 1;
  const k = Math.min(pos, neg);
  let tail = 0;
  for (let i = 0; i <= k; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
    tail += c / 2 ** n;
  }
  return Math.min(1, 2 * tail);
}

export function main() {
  const labels = new Map(jsonl(join(ROOT, "jev-evals/decide-best/cases.jsonl")).map((c) => [`close/${c.id}`, c.expected]));
  const cases = loadCases(SOURCES).filter((c) => c.src === "close");
  const runs = { author: ["main", "rep"], neutral: ["rename", "rename-rep"] };
  const loaded = Object.fromEntries(Object.values(runs).flat().map((f) => [f, loadRun(f)]));
  const rows = [];
  for (const c of cases) {
    const plan = orderPlan(c);
    const poolKeys = plan.pool.map(key);
    const label = labels.get(c.id);
    if (label === undefined) throw new Error(`no label for ${c.id}`);
    const row = { id: c.id, label, runs: {} };
    for (const f of Object.values(runs).flat()) {
      const ans = loaded[f].get(c.id);
      if (!ans || !poolKeys.every((k) => ans.has(k))) throw new Error(`${f}: incomplete orders for ${c.id}`);
      const a = adaptive(ans, plan, c.written);
      const mean = argmaxOf(meanOver(ans, poolKeys, c.written), c.written);
      row.runs[f] = { adaptive: a.leader, verdict: a.verdict, triggered: a.triggered, mean24: mean };
    }
    rows.push(row);
  }

  function compare(policy) {
    const hit = (r, f) => (r.runs[f][policy] === r.label ? 1 : 0);
    const per = rows.map((r) => {
      const a = (hit(r, "main") + hit(r, "rep")) / 2;
      const n = (hit(r, "rename") + hit(r, "rename-rep")) / 2;
      return { id: r.id, author: a, neutral: n, diff: n - a };
    });
    const pos = per.filter((p) => p.diff > 0).length;
    const neg = per.filter((p) => p.diff < 0).length;
    const author = per.reduce((s, p) => s + p.author, 0);
    const neutral = per.reduce((s, p) => s + p.neutral, 0);
    const floor = (x, y) => rows.filter((r) => hit(r, x) !== hit(r, y)).length;
    const rule = neutral - author >= 4 && signTest(pos, neg) <= 0.05 ? "neutral" : author - neutral >= 4 && signTest(pos, neg) <= 0.05 ? "author" : "neither";
    return {
      counts: Object.fromEntries(Object.values(runs).flat().map((f) => [f, rows.reduce((s, r) => s + hit(r, f), 0)])),
      run_averaged: { author, neutral },
      neutral_better: pos,
      author_better: neg,
      sign_test_p: Number(signTest(pos, neg).toFixed(4)),
      floor: { author_runs_differ: floor("main", "rep"), neutral_runs_differ: floor("rename", "rename-rep") },
      leader_changes: { author_runs: rows.filter((r) => r.runs.main[policy] !== r.runs.rep[policy]).length, neutral_runs: rows.filter((r) => r.runs.rename[policy] !== r.runs["rename-rep"][policy]).length, main_vs_rename: rows.filter((r) => r.runs.main[policy] !== r.runs.rename[policy]).length },
      outcome: rule,
      by_decision: per.filter((p) => p.diff !== 0).map((p) => `${p.id} ${p.diff > 0 ? "+" : ""}${p.diff}`),
    };
  }

  const verdicts = Object.fromEntries(Object.values(runs).flat().map((f) => [f, rows.reduce((m, r) => ((m[r.runs[f].verdict] = (m[r.runs[f].verdict] ?? 0) + 1), m), {})]));
  const triggered = Object.fromEntries(Object.values(runs).flat().map((f) => [f, rows.filter((r) => r.runs[f].triggered).length]));
  const report = { decisions: rows.length, model: "jev-1.13.0", primary_adaptive: compare("adaptive"), secondary_mean24: compare("mean24"), verdicts, triggered, rows };
  writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ primary: { ...report.primary_adaptive, by_decision: undefined }, secondary: { ...report.secondary_mean24, by_decision: undefined }, verdicts, triggered }, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
