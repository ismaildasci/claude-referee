// Statistics of the stop-state study (docs/decisions/stop-state-design.md): AUC, exact permutation p, task-clustered bootstrap, dev threshold and tally with exact intervals.
// Pure functions; scores are oriented "higher = more likely wrong done" and rows look like {task, cls, score}.

import { clopperPearson } from "../../src/engine/stopgate/interval.ts";

export const SEED = 20261005;
export const RESAMPLES = 10000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function auc(wrong, right) {
  if (!wrong.length || !right.length) return null;
  let sum = 0;
  for (const w of wrong) for (const r of right) sum += w > r ? 1 : w === r ? 0.5 : 0;
  return sum / (wrong.length * right.length);
}

function doubledMidranks(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let m = i; m <= j; m++) out[order[m][1]] = i + j + 2;
    i = j + 1;
  }
  return out;
}

export function permutationP(wrong, right) {
  const n1 = wrong.length;
  const all = [...wrong, ...right];
  const n = all.length;
  if (!n1 || !right.length) return null;
  const ranks = doubledMidranks(all);
  const observed = ranks.slice(0, n1).reduce((a, b) => a + b, 0);
  const maxSum = ranks.reduce((a, b) => a + b, 0);
  const dp = Array.from({ length: n1 + 1 }, () => new Array(maxSum + 1).fill(0n));
  dp[0][0] = 1n;
  for (let i = 0; i < n; i++) {
    const r = ranks[i];
    for (let j = Math.min(i + 1, n1); j >= 1; j--) {
      const from = dp[j - 1];
      const to = dp[j];
      for (let s = maxSum; s >= r; s--) if (from[s - r] !== 0n) to[s] += from[s - r];
    }
  }
  let total = 0n;
  let atLeast = 0n;
  for (let s = 0; s <= maxSum; s++) {
    total += dp[n1][s];
    if (s >= observed) atLeast += dp[n1][s];
  }
  return Number((atLeast * 1_000_000_000_000n) / total) / 1e12;
}

const split = (rows) => ({ wrong: rows.filter((r) => r.cls === "wrong_done").map((r) => r.score), right: rows.filter((r) => r.cls === "true_done").map((r) => r.score) });

export function rowsAuc(rows) {
  const { wrong, right } = split(rows);
  return auc(wrong, right);
}

// Percentile interval of the AUC; "task" resamples whole tasks with replacement, "session" resamples sessions. Resamples missing a class are discarded and counted.
export function bootstrap(rows, unit, { resamples = RESAMPLES, seed = SEED } = {}) {
  const rand = mulberry32(seed);
  const tasks = [...new Set(rows.map((r) => r.task))].sort();
  const byTask = new Map(tasks.map((t) => [t, rows.filter((r) => r.task === t)]));
  const values = [];
  let discarded = 0;
  for (let b = 0; b < resamples; b++) {
    let sample;
    if (unit === "task") sample = Array.from({ length: tasks.length }, () => byTask.get(tasks[Math.floor(rand() * tasks.length)])).flat();
    else sample = rows.map(() => rows[Math.floor(rand() * rows.length)]);
    const a = rowsAuc(sample);
    if (a === null) discarded++;
    else values.push(a);
  }
  values.sort((x, y) => x - y);
  if (!values.length) return { ci95: null, discarded };
  return { ci95: [values[Math.floor(0.025 * values.length)], values[Math.ceil(0.975 * values.length) - 1]], discarded };
}

// Highest t whose recall of wrong done (score >= t) is at least `minRecall`; null when there is no wrong done.
export function devThreshold(rows, minRecall = 0.8) {
  const wrong = rows.filter((r) => r.cls === "wrong_done").map((r) => r.score);
  if (!wrong.length) return null;
  const candidates = [...new Set(wrong)].sort((a, b) => b - a);
  for (const t of candidates) if (wrong.filter((s) => s >= t).length / wrong.length >= minRecall) return t;
  return candidates[candidates.length - 1];
}

const r3 = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
export const frac = (k, n) => {
  if (!n) return { k, n, value: null, ci95: null };
  const { lower, upper } = clopperPearson(k, n);
  return { k, n, value: r3(k / n), ci95: [r3(lower), r3(upper)] };
};

export function tally(rows, t) {
  const wrong = rows.filter((r) => r.cls === "wrong_done");
  const right = rows.filter((r) => r.cls === "true_done");
  return { threshold: t, recall: frac(wrong.filter((r) => r.score >= t).length, wrong.length), false_block: frac(right.filter((r) => r.score >= t).length, right.length) };
}

export function summarizeRows(rows, { withBootstrap = true } = {}) {
  const { wrong, right } = split(rows);
  const a = auc(wrong, right);
  const out = { wrong: wrong.length, true: right.length, tasks: new Set(rows.map((r) => r.task)).size, auc: r3(a), perm_p: wrong.length && right.length ? permutationP(wrong, right) : null };
  if (withBootstrap && a !== null) {
    const t = bootstrap(rows, "task");
    const s = bootstrap(rows, "session");
    out.boot_task_ci95 = t.ci95?.map(r3) ?? null;
    out.boot_task_discarded = t.discarded;
    out.boot_session_ci95 = s.ci95?.map(r3) ?? null;
  }
  return out;
}
