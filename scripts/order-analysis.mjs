// Pure analysis for scripts/order-sensitivity.mjs and scripts/close-subsets.mjs: leave-out policy distances, K3, subsets, screening rule. No I/O.
// Rules follow docs/decisions/decide-order.md; thresholds are compared unrounded (1e-9 only absorbs float noise), rounding is for display.
// The original keys (policy, policy_agreement_with_all24 and the 16 first summary keys) keep their 4 policies; written_reask lives in newer keys.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EPS = 1e-9;
export const TIE_MARGIN = 0.08;
export const SCREEN_LEADER_MAX = 0.7;
export const SCREEN_STRICT_MAX = 0.6;
export const K3_MIN_DELTA = 0.04;
export const K3_NOISE_LIMIT = 0.1;
export const K3_ALPHA = 0.05;
export const K3_CAL_MIN_N = 20;
export const K3_CAL_MAX_N = 45;
export const VERDICT_RANGE = "inconclusive (n outside the calibrated range)";
export const K3_DECISIVE_MARGIN = 0.08;
export const K3_DECISIVE_NOISE_MULT = 2;
export const K3_MIN_DECISIVE = 15;
export const POLICY_MIN_GAIN = 0.02;
export const POLICY_MIN_WIN_SHARE = 0.6;
export const REGISTERED_CASES = "jev-evals/decide-close/cases.jsonl";
export const LEGACY_POLICIES = ["written", "written_reversed", "rotations4", "same_request_pair"];
export const POLICIES = ["written", "written_reask", "written_reversed", "rotations4", "same_request_pair"];
export const SCREEN_ORDERS = { badc: [1, 0, 3, 2], cadb: [2, 0, 3, 1] };
export const INPUT_USD_PER_MILLION = 0.042;
export const OPTION_NAME = /^[a-z]+$/;
export const WORDING = {
  helped: "the second order helped on close calls",
  averaging: "averaging two answers helped; not shown to be the order",
  none: "no verdict",
};

export const round = (x) => Number(x.toFixed(4));
export const clean = (x) => Number(x.toFixed(12));
export const ge = (x, y) => x >= y - EPS;
export const le = (x, y) => x <= y + EPS;
export const lt = (x, y) => x < y - EPS;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const isRegistered = ({ tieMargin, input, limitUsed }) =>
  Math.abs(tieMargin - TIE_MARGIN) < EPS && typeof input === "string" && resolve(input) === resolve(repoRoot, REGISTERED_CASES) && !limitUsed;
export const argmax = (p) => Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
export const mean = (ps, names) => Object.fromEntries(names.map((n) => [n, ps.reduce((s, p) => s + (p[n] ?? 0), 0) / ps.length]));
export const costUsd = (inputTokens) => Number(((inputTokens * INPUT_USD_PER_MILLION) / 1_000_000).toFixed(6));

export function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

export const average = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function percentileNearestRank(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.min(s.length, Math.max(1, Math.ceil((p * s.length) / 100 - EPS)));
  return s[rank - 1];
}

export function topMargin(vector) {
  const v = Object.values(vector).sort((a, b) => b - a);
  return v[0] - (v[1] ?? 0);
}

export const isTied = (margin, tieMargin = TIE_MARGIN) => margin < tieMargin - EPS;

export function maxAbsDistance(a, b, names) {
  return Math.max(...names.map((n) => Math.abs((a[n] ?? 0) - (b[n] ?? 0))));
}

export function analyzeDecision(id, names, r, tieMargin = TIE_MARGIN) {
  const indexOf = (order) => r.orders.findIndex((o) => o.order.join() === order.join());
  const writtenIndex = indexOf(names);
  const reversedIndex = indexOf([...names].reverse());
  if (writtenIndex < 0 || reversedIndex < 0) throw new Error(`${id}: written or reversed order missing from the answers`);
  const written = r.orders[writtenIndex].p;
  const reversed = r.orders[reversedIndex].p;
  const all = mean(r.orders.map((o) => o.p), names);
  const leader = argmax(all);
  const spreadExact = Object.fromEntries(names.map((n) => {
    const vals = r.orders.map((o) => o.p[n] ?? 0);
    return [n, Math.max(...vals) - Math.min(...vals)];
  }));
  const spread = Object.fromEntries(names.map((n) => [n, round(spreadExact[n])]));
  const rotationIndexes = [...new Set([0, 1, 2, 3].map((k) => indexOf([...names.slice(k), ...names.slice(0, k)])))].sort((a, b) => a - b);
  const rotationPs = rotationIndexes.map((i) => r.orders[i].p);
  const slotResidual = [0, 1, 2, 3].map((slot) => r.orders.reduce((s, o) => s + ((o.p[o.order[slot]] ?? 0) - all[o.order[slot]]), 0) / r.orders.length);
  const reaskDelta = Math.max(...names.map((n) => Math.abs((r.reask[n] ?? 0) - (written[n] ?? 0))));
  const k3Reversed = Math.max(...names.map((n) => Math.abs((r.pair.reversed[n] ?? 0) - (reversed[n] ?? 0))));
  const k3Written = Math.max(...names.map((n) => Math.abs((r.pair.written[n] ?? 0) - (written[n] ?? 0))));
  const writtenReversedMean = mean([written, reversed], names);
  const pairMean = mean([r.pair.written, r.pair.reversed], names);
  const pairLeader = argmax(pairMean);
  const reaskMean = mean([written, r.reask], names);
  const margin = topMargin(all);
  const policyVectors = {
    written: mean([written], names),
    written_reask: reaskMean,
    written_reversed: writtenReversedMean,
    rotations4: mean(rotationPs, names),
    same_request_pair: pairMean,
  };
  const leftOut = {
    written: [writtenIndex],
    written_reask: [writtenIndex],
    written_reversed: [writtenIndex, reversedIndex],
    rotations4: rotationIndexes,
    same_request_pair: [writtenIndex, reversedIndex],
  };
  const leaveOutReference = (policy) => mean(r.orders.filter((_, i) => !leftOut[policy].includes(i)).map((o) => o.p), names);
  const distanceFull = Object.fromEntries(POLICIES.map((p) => [p, clean(maxAbsDistance(policyVectors[p], all, names))]));
  const distanceLeaveOut = Object.fromEntries(POLICIES.map((p) => [p, clean(maxAbsDistance(policyVectors[p], leaveOutReference(p), names))]));
  const policy = {
    written: argmax(written) === leader,
    written_reversed: argmax(writtenReversedMean) === leader,
    rotations4: argmax(mean(rotationPs, names)) === leader,
    same_request_pair: pairLeader === leader,
  };
  return {
    id,
    leader_all24: leader,
    p_leader_all24: round(all[leader]),
    max_spread: round(Math.max(...Object.values(spreadExact))),
    spread,
    distinct_argmax: new Set(r.orders.map((o) => argmax(o.p))).size,
    orders_leader_differs: r.orders.filter((o) => argmax(o.p) !== leader).length,
    policy,
    leader_match: { ...policy, written_reask: argmax(reaskMean) === leader },
    slot_residual: slotResidual.map(round),
    reask_max_delta: round(reaskDelta),
    k3_same_request_vs_separate: { reversed_max_delta: round(k3Reversed), written_max_delta: round(k3Written) },
    margin_all24: round(margin),
    tie: isTied(margin, tieMargin),
    distance_max_abs: Object.fromEntries(POLICIES.map((p) => [p, round(distanceFull[p])])),
    distance_leave_out: Object.fromEntries(POLICIES.map((p) => [p, round(distanceLeaveOut[p])])),
    pair_leader_matches_written_reversed: pairLeader === argmax(writtenReversedMean),
    exact: {
      max_spread: clean(Math.max(...Object.values(spreadExact))),
      reask_max_delta: clean(reaskDelta),
      k3_reversed_max_delta: clean(k3Reversed),
      k3_written_max_delta: clean(k3Written),
      margin_all24: clean(margin),
      pair_margin: clean(topMargin(pairMean)),
      written_reversed_margin: clean(topMargin(writtenReversedMean)),
      distance_full: distanceFull,
      distance_leave_out: distanceLeaveOut,
    },
  };
}

export const K3_CUTOFFS = { 20: 9, 21: 9, 22: 9, 23: 9, 24: 9, 25: 10, 26: 10, 27: 10, 28: 10, 29: 10, 30: 10, 31: 10, 32: 10, 33: 10, 34: 10, 35: 10, 36: 10, 37: 11, 38: 11, 39: 11, 40: 13, 41: 13, 42: 13, 43: 13, 44: 13, 45: 13 };

export const breachCutoff = (n) => (Number.isInteger(n) && n >= K3_CAL_MIN_N && n <= K3_CAL_MAX_N ? K3_CUTOFFS[n] ?? null : null);

export function evaluateK3(perDecision) {
  const n = perDecision.length;
  const reaskP95 = percentileNearestRank(perDecision.map((d) => d.exact.reask_max_delta), 95);
  const threshold = Math.max(K3_MIN_DELTA, reaskP95);
  const noisy = !le(reaskP95, K3_NOISE_LIMIT);
  const decisiveMargin = Math.max(K3_DECISIVE_MARGIN, K3_DECISIVE_NOISE_MULT * reaskP95);
  const excludedBy = (d) => {
    if (!ge(d.exact.margin_all24, K3_DECISIVE_MARGIN)) return "all24_margin_below_0.08";
    if (!ge(d.exact.pair_margin, decisiveMargin)) return "pair_margin_below_decisive_margin";
    if (!ge(d.exact.written_reversed_margin, decisiveMargin)) return "written_reversed_margin_below_decisive_margin";
    return null;
  };
  const decisive = perDecision.filter((d) => excludedBy(d) === null);
  const excluded = perDecision.filter((d) => excludedBy(d) !== null);
  const mismatches = decisive.filter((d) => !d.pair_leader_matches_written_reversed).map((d) => d.id);
  const assessable = decisive.length >= K3_MIN_DECISIVE;
  const leaderStatus = !assessable ? "not assessable" : mismatches.length === 0 ? "pass" : "fail";
  const breaches = perDecision.filter((d) => !le(d.exact.k3_reversed_max_delta, threshold) || !le(d.exact.k3_written_max_delta, threshold));
  const allowed = breachCutoff(n);
  const breachPass = allowed === null ? null : breaches.length <= allowed;
  const verdict = allowed === null ? VERDICT_RANGE : noisy ? "inconclusive (noise)" : breachPass && leaderStatus !== "fail" ? "pass" : "fail";
  return {
    verdict,
    basis: assessable ? "breach count and leader condition" : "breach count alone (leader condition not assessable)",
    noisy,
    leader_condition: {
      status: leaderStatus,
      decisive_decisions: decisive.length,
      min_decisive: K3_MIN_DECISIVE,
      decisive_margin: round(decisiveMargin),
      excluded_decisions: excluded.length,
      excluded: excluded.map((d) => ({ id: d.id, reason: excludedBy(d) })),
      mismatches: mismatches.length,
      mismatch_ids: mismatches,
      pass: assessable ? mismatches.length === 0 : null,
    },
    breach_condition: {
      threshold: round(threshold),
      reask_p95: round(reaskP95),
      noise_limit: K3_NOISE_LIMIT,
      decisions: n,
      breaches: breaches.length,
      breach_ids: breaches.map((d) => d.id),
      reversed_breaches: perDecision.filter((d) => !le(d.exact.k3_reversed_max_delta, threshold)).length,
      written_breaches: perDecision.filter((d) => !le(d.exact.k3_written_max_delta, threshold)).length,
      max_breaches_allowed: allowed,
      calibrated_range: [K3_CAL_MIN_N, K3_CAL_MAX_N],
      pass: breachPass,
    },
    k3_pass: verdict === "pass" ? true : verdict === "fail" ? false : null,
  };
}

function policyComparison(perDecision) {
  const n = perDecision.length;
  const nonTied = perDecision.filter((d) => !d.tie);
  const meanLeaveOut = (p) => average(perDecision.map((d) => d.exact.distance_leave_out[p]));
  const matches = (p) => nonTied.filter((d) => d.leader_match[p]).length;
  const against = (other) => {
    const gain = meanLeaveOut(other) - meanLeaveOut("written_reversed");
    const wins = perDecision.filter((d) => lt(d.exact.distance_leave_out.written_reversed, d.exact.distance_leave_out[other])).length;
    return {
      mean_leave_out_gain: round(gain),
      decisions_strictly_smaller: wins,
      decisions: n,
      win_share: n ? round(wins / n) : 0,
      beats: n > 0 && ge(gain, POLICY_MIN_GAIN) && ge(wins, POLICY_MIN_WIN_SHARE * n),
      extra_leader_matches_descriptive: matches("written_reversed") - matches(other),
    };
  };
  const vsWritten = against("written");
  const vsReask = against("written_reask");
  const wording = vsReask.beats ? WORDING.helped : vsWritten.beats ? WORDING.averaging : WORDING.none;
  return {
    written_reversed_vs_written: vsWritten,
    written_reversed_vs_written_reask: vsReask,
    leader_reference: "full-24 leader; contains each policy's own draws, so descriptive only and not part of the gate",
    allowed_wording: wording,
  };
}

export function summarize(perDecision, meta, tieMargin = TIE_MARGIN, registeredRun = false) {
  const n = perDecision.length;
  const count = (f) => perDecision.filter(f).length;
  const spreads = perDecision.map((d) => d.max_spread);
  const allSlot = perDecision.flatMap((d) => d.slot_residual.map(Math.abs));
  const nonTied = perDecision.filter((d) => !d.tie);
  const reask = perDecision.map((d) => d.reask_max_delta);
  const reaskExact = perDecision.map((d) => d.exact.reask_max_delta);
  const k3 = evaluateK3(perDecision);
  const stats = (field) => Object.fromEntries(POLICIES.map((p) => {
    const ds = perDecision.map((d) => d.exact[field][p]);
    return [p, { mean: round(average(ds)), median: round(median(ds)), max: round(Math.max(...ds)) }];
  }));
  return {
    decisions: n,
    requests: meta.requests,
    retries_429: meta.retries_429,
    input_tokens: meta.input_tokens,
    cost_usd: meta.cost_usd,
    max_spread_mean: round(average(spreads)),
    max_spread_max: round(Math.max(...spreads)),
    decisions_spread_ge_0_24: count((d) => ge(d.exact.max_spread, 0.24)),
    decisions_with_leader_change_across_orders: count((d) => d.orders_leader_differs > 0),
    policy_agreement_with_all24: Object.fromEntries(LEGACY_POLICIES.map((p) => [p, count((d) => d.policy[p])])),
    slot_bias_abs_mean: round(average(allSlot)),
    slot_bias_abs_max: round(Math.max(...allSlot)),
    reask_max_delta: round(Math.max(...reask)),
    k3_reversed_max_delta: round(Math.max(...perDecision.map((d) => d.k3_same_request_vs_separate.reversed_max_delta))),
    k3_reversed_mean_delta: round(average(perDecision.map((d) => d.k3_same_request_vs_separate.reversed_max_delta))),
    k3_written_max_delta: round(Math.max(...perDecision.map((d) => d.k3_same_request_vs_separate.written_max_delta))),
    registered: registeredRun === true && Math.abs(tieMargin - TIE_MARGIN) < EPS,
    tie_margin: tieMargin,
    tied_decisions: n - nonTied.length,
    non_tied_decisions: nonTied.length,
    policy_agreement_non_tied: Object.fromEntries(POLICIES.map((p) => [p, nonTied.filter((d) => d.leader_match[p]).length])),
    policy_distance_leave_out: stats("distance_leave_out"),
    policy_distance_max_abs: stats("distance_full"),
    policy_comparison: policyComparison(perDecision),
    reask_noise: { mean: round(average(reaskExact)), p95: round(percentileNearestRank(reaskExact, 95)) },
    k3: { verdict: k3.verdict, basis: k3.basis, leader_condition: k3.leader_condition, breach_condition: k3.breach_condition },
    k3_pass: k3.k3_pass,
  };
}

const NO_META = { requests: null, retries_429: null, input_tokens: null, cost_usd: null };

export function validateSubsets(subsets, ids) {
  const known = new Set(ids);
  if (Array.isArray(subsets.full)) {
    const same = subsets.full.length === known.size && subsets.full.every((id) => known.has(id));
    if (!same) throw new Error("subsets file: the full set does not match the decisions in the report");
  }
  for (const [name, list] of Object.entries(subsets)) {
    if (name === "full" || !Array.isArray(list)) continue;
    const missing = list.filter((id) => !known.has(id));
    if (missing.length) throw new Error(`subset ${name} has ids not in the report: ${missing.join(", ")}`);
    if (!list.length) throw new Error(`subset ${name} is empty`);
  }
}

export function subsetSummaries(perDecision, subsets, tieMargin = TIE_MARGIN, registeredRun = false) {
  const byId = new Map(perDecision.map((d) => [d.id, d]));
  validateSubsets(subsets, [...byId.keys()]);
  return Object.fromEntries(Object.entries(subsets).filter(([name, ids]) => name !== "full" && Array.isArray(ids)).map(([name, ids]) => [name, summarize(ids.map((id) => byId.get(id)), NO_META, tieMargin, registeredRun)]));
}

export function sideBySide(sets) {
  const names = Object.keys(sets);
  const cell = (f) => names.map((name) => String(f(sets[name])));
  const rows = [
    ["set", names],
    ["decisions", cell((s) => s.decisions)],
    ["tied (excluded from leader agreement)", cell((s) => s.tied_decisions)],
    ["registered", cell((s) => s.registered)],
    ["re-ask noise mean", cell((s) => s.reask_noise.mean)],
    ["re-ask noise p95", cell((s) => s.reask_noise.p95)],
    ...POLICIES.map((p) => [`leave-out distance mean, ${p}`, cell((s) => s.policy_distance_leave_out[p].mean)]),
    ...POLICIES.map((p) => [`full-24 distance mean, ${p}`, cell((s) => s.policy_distance_max_abs[p].mean)]),
    ...POLICIES.map((p) => [`leader matches, ${p}`, cell((s) => `${s.policy_agreement_non_tied[p]}/${s.non_tied_decisions}`)]),
    ["written_reversed vs written_reask: gain / strictly smaller", cell((s) => `${s.policy_comparison.written_reversed_vs_written_reask.mean_leave_out_gain} / ${s.policy_comparison.written_reversed_vs_written_reask.decisions_strictly_smaller}/${s.policy_comparison.written_reversed_vs_written_reask.decisions}`)],
    ["written_reversed vs written_reask: extra leader matches (descriptive)", cell((s) => s.policy_comparison.written_reversed_vs_written_reask.extra_leader_matches_descriptive)],
    ["allowed policy wording", cell((s) => s.policy_comparison.allowed_wording)],
    ["K3 decisive (leader condition: status)", cell((s) => `${s.k3.leader_condition.decisive_decisions} (${s.k3.leader_condition.status})`)],
    ["K3 breaches / allowed (threshold T)", cell((s) => `${s.k3.breach_condition.breaches}/${s.k3.breach_condition.max_breaches_allowed ?? "n/a"} (${s.k3.breach_condition.threshold})`)],
    ["K3 verdict", cell((s) => s.k3.verdict)],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  const widths = names.map((_, i) => Math.max(...rows.map(([, cells]) => cells[i].length)));
  return rows.map(([label, cells]) => `${label.padEnd(width)}  ${cells.map((c, i) => c.padEnd(widths[i])).join("  ")}`.trimEnd());
}

export function buildSubsets(cases, reports) {
  const ids = cases.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate case ids");
  const screened = new Map();
  for (const report of reports) {
    for (const c of report.candidates ?? []) {
      if (c.outcome !== "kept") continue;
      if (screened.has(c.id)) throw new Error(`${c.id} was kept in more than one screening report`);
      screened.set(c.id, c);
    }
  }
  const strict = (c) => {
    const s = screened.get(c.id);
    if (!s) throw new Error(`no kept screening record for ${c.id}`);
    return s.p1.p_leader < SCREEN_STRICT_MAX - EPS && s.p2.p_leader < SCREEN_STRICT_MAX - EPS;
  };
  const seen = new Set();
  const oneEach = cases.filter((c) => {
    const group = c.derived_from ? `source:${c.derived_from}` : `case:${c.id}`;
    if (seen.has(group)) return false;
    seen.add(group);
    return true;
  });
  return {
    rules: {
      S1: `strict closeness: leader probability below ${SCREEN_STRICT_MAX} in both screening orders (badc and cadb)`,
      S2: "one per source: cases grouped by derived_from (a case without derived_from is its own group); the first case of each group in file order",
    },
    full: ids,
    S1: cases.filter(strict).map((c) => c.id),
    S2: oneEach.map((c) => c.id),
  };
}

export function sourceClusters(cases) {
  const groups = new Map();
  for (const c of cases) if (c.derived_from) groups.set(c.derived_from, [...(groups.get(c.derived_from) ?? []), c.id]);
  const multi = [...groups].filter(([, ids]) => ids.length > 1);
  return {
    cases: cases.length,
    multi_case_sources: multi.length,
    cases_in_multi_case_sources: multi.reduce((sum, [, ids]) => sum + ids.length, 0),
    sources: multi.map(([source, ids]) => ({ source, cases: ids.length })),
  };
}

export function validateCandidate(c) {
  if (!c || typeof c !== "object" || typeof c.id !== "string" || !c.id) return "missing id";
  if (typeof c.decision !== "string" || typeof c.context !== "string") return "missing decision or context";
  if (!Array.isArray(c.options)) return "options is not an array";
  if (c.options.length !== 4) return `${c.options.length} options, exactly 4 required`;
  if (c.options.some((o) => typeof o?.name !== "string" || typeof o?.text !== "string")) return "option without a string name and text";
  const names = c.options.map((o) => o.name);
  const bad = names.find((x) => !OPTION_NAME.test(x));
  if (bad !== undefined) return `option name ${JSON.stringify(bad)} does not match ${OPTION_NAME} (JS reorders integer-like object keys)`;
  if (new Set(names).size !== names.length) return "duplicate option names";
  return null;
}

export const screenOrder = (options, key) => SCREEN_ORDERS[key].map((i) => options[i]);

export function leaderOf(p) {
  const leader = argmax(p);
  return { leader, p: p[leader] };
}

export const screenKeep = (p1, p2, leaderMax = SCREEN_LEADER_MAX) => leaderOf(p1).p < leaderMax - EPS && leaderOf(p2).p < leaderMax - EPS;

export function preflight(cands, existingIds) {
  const seen = new Set(existingIds);
  return cands.map((c) => {
    const reason = validateCandidate(c);
    if (reason) return { status: "refused", reason };
    if (seen.has(c.id)) return { status: "duplicate", reason: "id already in the cases file or earlier in the candidates" };
    seen.add(c.id);
    return { status: "pending" };
  });
}

export function selectKept(entries, existingCount, max) {
  let count = existingCount;
  return entries.map((e) => {
    if (e.status === "refused" || e.status === "duplicate") return e.status;
    if (!e.keep) return "rejected";
    if (count >= max) return "capped";
    count++;
    return "kept";
  });
}
