// Hard-task study logic (docs/decisions/session-hard-tasks.md): the registered plan order, the stop rule constants, and the H1 to H4 analysis with an exact permutation test and a seeded bootstrap.
// Pure functions: no I/O, no dependencies; the Clopper-Pearson function is passed in. Session records are the ground records of the base-rate runner.

import { analyze, sessionId } from "./lib.mjs";

export const HARD_CAP_USD = 8;
export const HARD_PER_SESSION_USD = 0.25;
export const HARD_MAX_SESSIONS = 100;
export const HARD_ASKED_TARGET = 100;
export const HARD_KINDS = ["hidden", "weakvis", "trap", "multifile"];
export const PILOT_POSITIONS = [0, 5, 10, 15, 20, 25];
export const BOOTSTRAP_SEED = 20261002;
export const BOOTSTRAP_RESAMPLES = 10000;
export const EXCLUDED = ["leaked", "run_failed", "error", "unresolved"];

// The registered order: the pilot first, then sonnet repetition 1 of the rest, repetition 2 of all, repetition 3 in id order up to 100 sessions;
// the k-th haiku session (repetition 1, positions that are not a multiple of 3) goes right after sonnet session number 3k+3, so no prefix has more than 25% haiku.
export function planHard(tasks, maxSessions = HARD_MAX_SESSIONS) {
  const sorted = [...tasks].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const make = (t, model, rep) => ({ id: sessionId(t.id, model, rep), task: t.id, model, rep });
  const haikuTasks = sorted.filter((_, i) => i % 3 !== 0);
  const pilot = PILOT_POSITIONS.filter((i) => i < sorted.length).map((i) => sorted[i]);
  const pilotIds = new Set(pilot.map((t) => t.id));
  const sonnet = [
    ...pilot.map((t) => make(t, "sonnet", 1)),
    ...sorted.filter((t) => !pilotIds.has(t.id)).map((t) => make(t, "sonnet", 1)),
    ...sorted.map((t) => make(t, "sonnet", 2)),
    ...sorted.map((t) => make(t, "sonnet", 3)),
  ];
  const sonnetRoom = sonnet.slice(0, Math.max(0, maxSessions - haikuTasks.length));
  const out = [];
  sonnetRoom.forEach((session, i) => {
    const n = i + 1;
    out.push(session);
    const k = (n - 3) / 3;
    if (n >= 6 && Number.isInteger(k) && k <= haikuTasks.length) out.push(make(haikuTasks[k - 1], "haiku", 1));
  });
  return out.slice(0, maxSessions);
}

// Mean of the two-sided ranks: the doubled mid-rank of each score (ascending), an integer, so ties need no floating point.
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

// P(wrong group scores higher than the true group), ties counting half.
export function auc(wrong, right) {
  if (!wrong.length || !right.length) return null;
  let sum = 0;
  for (const w of wrong) for (const r of right) sum += w > r ? 1 : w === r ? 0.5 : 0;
  return sum / (wrong.length * right.length);
}

// One-sided exact permutation p-value of the observed rank sum of `wrong` among all assignments of the pooled scores: counted by dynamic programming
// over (items taken, doubled rank sum) with BigInt, so it is exact and does not enumerate subsets.
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

// Percentile bootstrap of the AUC, resampling within each class, with the registered seed.
export function bootstrapAuc(wrong, right, { resamples = BOOTSTRAP_RESAMPLES, seed = BOOTSTRAP_SEED } = {}) {
  if (!wrong.length || !right.length) return null;
  const rand = mulberry32(seed);
  const draw = (list) => list.map(() => list[Math.floor(rand() * list.length)]);
  const values = [];
  for (let b = 0; b < resamples; b++) values.push(auc(draw(wrong), draw(right)));
  values.sort((x, y) => x - y);
  return [values[Math.floor(0.025 * resamples)], values[Math.ceil(0.975 * resamples) - 1]];
}

const round = (v, d = 4) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
const ratio = (k, n) => (n === 0 ? null : round(k / n, 3));
const interval = (ci, k, n) => {
  if (!ci || n < 1) return null;
  const { lower, upper } = ci(k, n);
  return [round(lower, 3), round(upper, 3)];
};
const tally = (list, key) => {
  const out = {};
  for (const s of list) {
    const k = key(s);
    out[k] = out[k] ?? {};
    out[k][s.class] = (out[k][s.class] ?? 0) + 1;
  }
  return out;
};

// H1 to H4 as registered, over ground records with a resolved `class`. `ci` is the Clopper-Pearson function (k, n) => {lower, upper}.
export function hardReport(sessions, ci) {
  const base = analyze(sessions, ci);
  const usable = sessions.filter((s) => !EXCLUDED.includes(s.class));
  const wrong = usable.filter((s) => s.class === "wrong_done");
  const right = usable.filter((s) => s.class === "true_done");
  const asked = (s) => Boolean(s.stop) && !s.stop.skipped && s.stop.would_block !== undefined;
  const wrongAsked = wrong.filter(asked);
  const rightAsked = right.filter(asked);
  const blockedWrong = wrongAsked.filter((s) => s.stop.would_block).length;
  const blockedRight = rightAsked.filter((s) => s.stop.would_block).length;
  const powered = wrong.length >= 15;
  const judged = (met) => (powered ? (met ? "met" : "not met") : "not judged: below the power target of 15 wrong dones");
  const h1Rate = usable.length ? wrong.length / usable.length : null;
  const recall = wrong.length ? blockedWrong / wrong.length : null;
  const falseBlock = rightAsked.length ? blockedRight / rightAsked.length : null;
  const sw = wrongAsked.map((s) => s.stop.claims_verified).filter(Number.isFinite).map((v) => 1 - v);
  const sr = rightAsked.map((s) => s.stop.claims_verified).filter(Number.isFinite).map((v) => 1 - v);
  const h4Evaluable = sw.length >= 10 && sr.length >= 10;
  const a = auc(sw, sr);
  const p = h4Evaluable ? permutationP(sw, sr) : null;
  return {
    base,
    by_lang: tally(sessions, (s) => s.lang ?? "unknown"),
    h1: {
      usable: usable.length,
      wrong_done: wrong.length,
      rate: ratio(wrong.length, usable.length),
      ci95: interval(ci, wrong.length, usable.length),
      rate_among_claims: ratio(wrong.length, wrong.length + right.length),
      power_target_met: powered,
      verdict: h1Rate === null ? "not evaluable" : h1Rate >= 0.15 ? "met" : "not met",
    },
    h2: {
      recall_all: { value: ratio(blockedWrong, wrong.length), k: blockedWrong, n: wrong.length, ci95: interval(ci, blockedWrong, wrong.length) },
      asked_share: { value: ratio(wrongAsked.length, wrong.length), k: wrongAsked.length, n: wrong.length },
      recall_among_asked: { value: ratio(blockedWrong, wrongAsked.length), k: blockedWrong, n: wrongAsked.length, ci95: interval(ci, blockedWrong, wrongAsked.length) },
      verdict: judged(recall !== null && recall >= 0.8),
    },
    h3: {
      false_block_rate: { value: ratio(blockedRight, rightAsked.length), k: blockedRight, n: rightAsked.length, ci95: interval(ci, blockedRight, rightAsked.length) },
      over_all_true_done: { value: ratio(blockedRight, right.length), k: blockedRight, n: right.length, ci95: interval(ci, blockedRight, right.length) },
      verdict: falseBlock === null ? "not evaluable" : falseBlock <= 0.05 ? "met" : "not met",
    },
    h4: {
      wrong_asked_with_score: sw.length,
      true_asked_with_score: sr.length,
      auc: round(a),
      permutation_p_one_sided: p,
      bootstrap_ci95: h4Evaluable ? bootstrapAuc(sw, sr).map((v) => round(v)) : null,
      verdict: !h4Evaluable ? "not judged: fewer than 10 in a class" : a >= 0.7 && p <= 0.05 ? "met" : "not met",
    },
    precision: { value: ratio(blockedWrong, blockedWrong + blockedRight), k: blockedWrong, n: blockedWrong + blockedRight, ci95: interval(ci, blockedWrong, blockedWrong + blockedRight) },
  };
}
