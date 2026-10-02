// Statistics of the A/B: exact Clopper-Pearson per arm, Newcombe interval and one-sided Fisher exact test for a difference, Holm correction,
// a seeded case-clustered bootstrap for cost per correct task, and the pilot's sample-size rule. No I/O; the formulas are the ones in bench/PREREG.md.

import { clopperPearson } from "../src/engine/stopgate/interval.ts";

export { clopperPearson };

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

export function wilson(k, n, z = 1.959963984540054) {
  if (n < 1) return { lower: 0, upper: 1 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lower: Math.max(0, (c - h) / d), upper: Math.min(1, (c + h) / d) };
}

// Newcombe's hybrid score interval (method 10) for p1 - p2.
export function newcombeDiff(k1, n1, k2, n2) {
  const p1 = k1 / n1;
  const p2 = k2 / n2;
  const a = wilson(k1, n1);
  const b = wilson(k2, n2);
  const diff = p1 - p2;
  return { diff, lower: diff - Math.sqrt((p1 - a.lower) ** 2 + (b.upper - p2) ** 2), upper: diff + Math.sqrt((a.upper - p1) ** 2 + (p2 - b.lower) ** 2) };
}

function logChoose(n, k) {
  let sum = 0;
  for (let i = 1; i <= k; i++) sum += Math.log((n - k + i) / i);
  return sum;
}

// P(X <= k1) when the k1 + k2 events fall at random into groups of n1 and n2: small when group 1 has fewer events than chance allows.
export function fisherLess(k1, n1, k2, n2) {
  const events = k1 + k2;
  const total = n1 + n2;
  if (events === 0) return 1;
  let sum = 0;
  for (let x = Math.max(0, events - n2); x <= Math.min(k1, events, n1); x++) sum += Math.exp(logChoose(n1, x) + logChoose(n2, events - x) - logChoose(total, events));
  return Math.min(1, sum);
}

// Holm step-down adjusted p values, same order as the input.
export function holm(ps) {
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const out = Array(ps.length).fill(1);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (ps.length - rank) * p));
    out[i] = running;
  });
  return out;
}

// Smallest number of events in group 2 (of n) for which 0 events in group 1 (of n) is significant at alpha, one-sided Fisher.
export function minEventsForZero(n, alpha = 0.05) {
  for (let e = 1; e <= n; e++) if (fisherLess(0, n, e, n) <= alpha) return e;
  return null;
}

// Pilot rule: the no-gate rate p0 seen in the pilot gives the smallest N per arm at which an arm with no wrong "done" would be
// significantly below no-gate; null when there is none up to nMax. A pilot with no events gives no N.
export function requiredN(p0, nMax, alpha = 0.05) {
  if (!(p0 > 0)) return null;
  for (let n = 2; n <= nMax; n++) if (fisherLess(0, n, Math.round(p0 * n), n) <= alpha) return n;
  return null;
}

function percentile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Cluster bootstrap over tasks: resample whole tasks (all arms together, so the pairing by task is kept) and recompute `statistic(rows)`.
// rows: [{ task, ... }]; statistic returns a number or null (null draws are dropped and counted).
export function clusterBootstrap(rows, statistic, { resamples = 10000, seed = 1 } = {}) {
  const tasks = [...new Set(rows.map((r) => r.task))];
  const byTask = Object.groupBy(rows, (r) => r.task);
  const rand = mulberry32(seed);
  const draws = [];
  let dropped = 0;
  for (let b = 0; b < resamples; b++) {
    const sample = [];
    for (let i = 0; i < tasks.length; i++) sample.push(...byTask[tasks[Math.floor(rand() * tasks.length)]]);
    const v = statistic(sample);
    if (v === null || !Number.isFinite(v)) dropped++;
    else draws.push(v);
  }
  draws.sort((a, b) => a - b);
  if (draws.length < resamples / 2) return { lower: null, upper: null, resamples, dropped };
  return { lower: percentile(draws, 0.025), upper: percentile(draws, 0.975), resamples, dropped };
}
