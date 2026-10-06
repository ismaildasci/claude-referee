// Exact binomial (Clopper-Pearson) interval and the done-gate threshold suggestion built on human labels only.
// No dependencies: the interval inverts the binomial tail sums by bisection; the suggestion can only raise claims_done, never loosen it.
// log C(n, k) does not depend on p, so each interval sums it once per k (same arithmetic as before, bit-identical) and reuses it across the bisection.

import type { StopRecord } from "./types.ts";

export const MIN_LABELS_PER_CLASS = 10;
export const PRECISION_TARGET = 0.8;

function logChoose(n: number, k: number): number {
  let sum = 0;
  for (let i = 1; i <= k; i++) sum += Math.log((n - k + i) / i);
  return sum;
}

function cdf(n: number, x: number, p: number, logC: Float64Array): number {
  if (p <= 0) return 1;
  if (p >= 1) return x >= n ? 1 : 0;
  const lp = Math.log(p);
  const lq = Math.log1p(-p);
  let sum = 0;
  for (let k = 0; k <= x; k++) sum += Math.exp((logC[k] ?? 0) + k * lp + (n - k) * lq);
  return Math.min(1, sum);
}

function bisect(f: (p: number) => number, target: number, increasing: boolean): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target === increasing) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Two-sided interval for x successes in n trials; confidence 0.95 unless given.
export function clopperPearson(x: number, n: number, confidence = 0.95): { readonly lower: number; readonly upper: number } {
  if (!Number.isInteger(x) || !Number.isInteger(n) || n < 1 || x < 0 || x > n || !(confidence > 0 && confidence < 1)) throw new RangeError("clopperPearson needs integers 0 <= x <= n, n >= 1");
  const alpha = (1 - confidence) / 2;
  const logC = new Float64Array(x + 1);
  for (let k = 1; k <= x; k++) logC[k] = logChoose(n, k);
  const lower = x === 0 ? 0 : bisect((p) => 1 - cdf(n, x - 1, p, logC), alpha, true);
  const upper = x === n ? 1 : bisect((p) => cdf(n, x, p, logC), alpha, false);
  return { lower, upper };
}

export interface ThresholdSuggestion {
  readonly available: boolean;
  readonly need: { readonly right: number; readonly wrong: number };
  readonly have: { readonly right: number; readonly wrong: number };
  readonly question: "stop.gate";
  readonly key: "claims_done";
  readonly current: number;
  readonly suggested: number | null;
  readonly reason?: "too_few_labels" | "already_meets_target" | "raise_claims_done" | "no_threshold_reaches_target";
  readonly kept?: { readonly labelled: number; readonly right: number; readonly precision: number; readonly precision_ci95: readonly [number, number] };
  readonly overall?: { readonly precision: number; readonly precision_ci95: readonly [number, number]; readonly false_block_rate_ci95: readonly [number, number] };
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
const pair = (x: number, n: number): [number, number] => {
  const ci = clopperPearson(x, n);
  return [round(ci.lower), round(ci.upper)];
};

// Human labels on would_block stops only; the weak next-message suggestion is never an input.
export function suggestThreshold(records: readonly StopRecord[], current: number): ThresholdSuggestion {
  const labelled = records.filter((r) => r.decision?.would_block === true && (r.label === "right" || r.label === "wrong"));
  const right = labelled.filter((r) => r.label === "right").length;
  const wrong = labelled.length - right;
  const base = { need: { right: MIN_LABELS_PER_CLASS, wrong: MIN_LABELS_PER_CLASS }, have: { right, wrong }, question: "stop.gate" as const, key: "claims_done" as const, current };
  if (right < MIN_LABELS_PER_CLASS || wrong < MIN_LABELS_PER_CLASS) return { ...base, available: false, suggested: null, reason: "too_few_labels" };
  const overall = { precision: round(right / labelled.length), precision_ci95: pair(right, labelled.length), false_block_rate_ci95: pair(wrong, labelled.length) };
  const keptAt = (t: number) => {
    const kept = labelled.filter((r) => (r.decision?.claims_done ?? 0) >= t);
    const k = kept.filter((r) => r.label === "right").length;
    return { n: kept.length, k };
  };
  const meets = (t: number): boolean => {
    const { n, k } = keptAt(t);
    return n >= MIN_LABELS_PER_CLASS && clopperPearson(k, n).lower >= PRECISION_TARGET;
  };
  const summary = (t: number) => {
    const { n, k } = keptAt(t);
    return { labelled: n, right: k, precision: round(k / n), precision_ci95: pair(k, n) };
  };
  if (meets(current)) return { ...base, available: true, suggested: current, reason: "already_meets_target", kept: summary(current), overall };
  const candidates = [...new Set(labelled.map((r) => Math.floor((r.decision?.claims_done ?? 0) * 1000) / 1000))].filter((t) => t > current && t <= 1).sort((a, b) => a - b);
  for (const t of candidates) if (meets(t)) return { ...base, available: true, suggested: t, reason: "raise_claims_done", kept: summary(t), overall };
  return { ...base, available: true, suggested: null, reason: "no_threshold_reaches_target", overall };
}
