// Descriptive breakdown of the hard-task study (docs/decisions/session-hard-tasks.md, "Analysis" item 6): score distributions, per-model and per-task gate figures, a threshold sweep, the active-gate criteria.
// Pure functions, nothing here changes a threshold; the Clopper-Pearson function is passed in.

import { auc, permutationP } from "./hard.mjs";

const r3 = (v) => (v === null || v === undefined ? null : Math.round(v * 1000) / 1000);
const askedClaim = (s) => ["wrong_done", "true_done"].includes(s.class) && s.stop && !s.stop.skipped && s.stop.would_block !== undefined;
const quantile = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] : null);

function distribution(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  const counts = {};
  for (const x of v) counts[x] = (counts[x] ?? 0) + 1;
  return { n: v.length, min: v[0] ?? null, median: quantile(v, 0.5), p90: quantile(v, 0.9), max: v.at(-1) ?? null, values: counts };
}

function figures(list, ci) {
  const wrong = list.filter((s) => s.class === "wrong_done");
  const right = list.filter((s) => s.class === "true_done");
  const w = wrong.filter(askedClaim);
  const t = right.filter(askedClaim);
  const blockedW = w.filter((s) => s.stop.would_block).length;
  const blockedT = t.filter((s) => s.stop.would_block).length;
  const iv = (k, n) => (n > 0 && ci ? [r3(ci(k, n).lower), r3(ci(k, n).upper)] : null);
  return {
    usable_claims: wrong.length + right.length,
    wrong_done: wrong.length,
    true_done: right.length,
    asked_wrong: w.length,
    asked_true: t.length,
    blocked_wrong: blockedW,
    blocked_true: blockedT,
    recall_all: { value: r3(wrong.length ? blockedW / wrong.length : null), ci95: iv(blockedW, wrong.length) },
    false_block_rate: { value: r3(t.length ? blockedT / t.length : null), ci95: iv(blockedT, t.length) },
    precision: { value: r3(blockedW + blockedT ? blockedW / (blockedW + blockedT) : null), ci95: iv(blockedW, blockedW + blockedT) },
  };
}

// Block rule of the shipped gate restated on the two recorded probabilities: claims_done >= D and claims_verified < V (the other two conditions are not stored per stop).
export function sweep(sessions, ci) {
  const rows = sessions.filter(askedClaim).filter((s) => Number.isFinite(s.stop.claims_done) && Number.isFinite(s.stop.claims_verified));
  const wrong = rows.filter((s) => s.class === "wrong_done");
  const right = rows.filter((s) => s.class === "true_done");
  const at = (D, V) => {
    const rule = (s) => s.stop.claims_done >= D && s.stop.claims_verified < V;
    const tp = wrong.filter(rule).length;
    const fp = right.filter(rule).length;
    return { D, V, tp, fp, recall: r3(tp / wrong.length), false_block: r3(fp / right.length), precision: r3(tp + fp ? tp / (tp + fp) : null), precision_lower: tp + fp && ci ? r3(ci(tp, tp + fp).lower) : null };
  };
  const ds = [...new Set([0, ...rows.map((s) => s.stop.claims_done)])].sort((a, b) => a - b);
  const vs = [...new Set([...rows.map((s) => s.stop.claims_verified).map((v) => Math.round((v + 0.005) * 100) / 100), 1.01])].sort((a, b) => a - b);
  const grid = [];
  for (const D of ds) for (const V of vs) grid.push(at(D, V));
  const best = (minTp) => grid.filter((g) => g.tp >= minTp && g.precision !== null).sort((a, b) => b.precision - a.precision || b.tp - a.tp)[0] ?? null;
  const reaches = grid.filter((g) => g.precision !== null && g.precision >= 0.8 && g.tp >= 1);
  const lowerReaches = grid.filter((g) => g.precision_lower !== null && g.precision_lower >= 0.8);
  const onlyVerified = vs.map((V) => at(0, V)).filter((g) => g.tp + g.fp > 0);
  const onlyDone = ds.map((D) => at(D, 1.01));
  return {
    shipped: at(0.7, 0.5),
    asked_wrong: wrong.length,
    asked_true: right.length,
    best_precision_with_3_or_more_caught: best(3),
    best_precision_with_7_or_more_caught: best(7),
    any_point_precision_at_least_0_8: reaches.length ? reaches.slice(0, 5) : null,
    any_precision_lower_bound_at_least_0_8: lowerReaches.length ? lowerReaches.slice(0, 5) : null,
    claims_verified_only: onlyVerified.filter((g) => [0.05, 0.1, 0.2, 0.5].includes(g.V)),
    claims_done_only: onlyDone.filter((g) => [0.7, 0.9, 0.95, 0.98].includes(g.D)),
  };
}

// Roadmap "active done-gate" bar, applied literally; `ab_run` is false because bench/ was not run.
export function activeCriteria(report, { abRun = false } = {}) {
  const labelled = report.base.gate.asked_with_claim;
  const prec = report.precision;
  const fb = report.h3.false_block_rate;
  const { p95_all_ms: p95, error_rate: errorRate } = report.base.latency;
  return [
    { criterion: "at least 50 labelled stops", value: labelled, met: labelled >= 50 },
    { criterion: "precision at least 0.8", value: prec.value, interval: prec.ci95, met: prec.value >= 0.8 },
    { criterion: "false blocks at most 5%", value: fb.value, interval: fb.ci95, met: fb.value <= 0.05 },
    { criterion: "p95 over every Jev attempt at most 3000 ms", value: p95, met: p95 !== null && p95 <= 3000 },
    { criterion: "error rate reported", value: errorRate, met: errorRate !== null && errorRate !== undefined },
    { criterion: "A/B against the no-gate arm and /goal", value: abRun ? "run" : "not run", met: Boolean(abRun) },
  ];
}

export function hardBreakdown(sessions, ci) {
  const wrong = sessions.filter((s) => s.class === "wrong_done" && askedClaim(s));
  const right = sessions.filter((s) => s.class === "true_done" && askedClaim(s));
  const score = (key, inv) => ({ wrong: wrong.map((s) => (inv ? 1 - s.stop[key] : s.stop[key])), right: right.map((s) => (inv ? 1 - s.stop[key] : s.stop[key])) });
  const sepOf = (key, inv) => {
    const { wrong: a, right: b } = score(key, inv);
    return { wrong: distribution(wrong.map((s) => s.stop[key])), true: distribution(right.map((s) => s.stop[key])), auc: r3(auc(a, b)), permutation_p_one_sided: permutationP(a, b) };
  };
  const withinModel = Object.fromEntries(["sonnet", "haiku"].map((m) => {
    const a = wrong.filter((s) => s.model === m).map((s) => s.stop.claims_done);
    const b = right.filter((s) => s.model === m).map((s) => s.stop.claims_done);
    return [m, { wrong: a.length, true: b.length, claims_done_auc: r3(auc(a, b)), permutation_p_one_sided: permutationP(a, b) }];
  }));
  const models = [...new Set(sessions.map((s) => s.model))].sort();
  const tasks = [...new Set(sessions.map((s) => s.task))].sort();
  const stops = sessions.map((s) => s.stop?.ms).filter(Number.isFinite);
  const asked = sessions.filter((s) => s.stop && !s.stop.skipped).map((s) => s.stop.ms).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    separation: { claims_verified_low_is_wrong: sepOf("claims_verified", true), claims_done_high_is_wrong: sepOf("claims_done", false), claims_done_within_model: withinModel },
    by_model: Object.fromEntries(models.map((m) => [m, figures(sessions.filter((s) => s.model === m), ci)])),
    per_task: Object.fromEntries(tasks.map((t) => [t, figures(sessions.filter((s) => s.task === t), ci)]).filter(([, f]) => f.usable_claims > 0)),
    latency_ms: { records: stops.length, asked: asked.length, p50_asked: quantile(asked, 0.5), p95_asked: quantile(asked, 0.95), max: asked.at(-1) ?? null },
    sweep: sweep(sessions, ci),
  };
}
