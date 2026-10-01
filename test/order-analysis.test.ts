// order-sensitivity analysis: tie rule, leave-out distances, policy gate, K3 (breach count, decisive rule, noise), registration, subsets, screening rule, CLI wiring against a local mock. No live API.

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  analyzeDecision,
  buildSubsets,
  evaluateK3,
  breachCutoff,
  isRegistered,
  isTied,
  K3_CAL_MAX_N,
  K3_CAL_MIN_N,
  K3_CUTOFFS,
  K3_MIN_DECISIVE,
  percentileNearestRank,
  permutations,
  preflight,
  screenKeep,
  screenOrder,
  selectKept,
  sideBySide,
  sourceClusters,
  subsetSummaries,
  summarize,
  validateCandidate,
  validateSubsets,
  REGISTERED_CASES,
  VERDICT_RANGE,
  WORDING,
  type Decision,
  type Probs,
  type RawDecision,
} from "../scripts/order-analysis.mjs";
import { DEFAULTS, calibrate, chooseCutoff, emit, emitLine, fingerprint, seededRandom, simulateCell, simulateDecisions, tailRate, verdictFailRate, type Cell } from "../scripts/k3-calibration.mjs";

const NAMES = ["a", "b", "c", "d"];
const META = { requests: 0, retries_429: 0, input_tokens: 0, cost_usd: 0 };

function raw(id: string, p: (order: string[]) => Probs, overrides: Partial<RawDecision> = {}): RawDecision {
  const orders = permutations(NAMES).map((order) => ({ order, p: p(order) }));
  const written = orders[0]!.p;
  return { id, orders, reask: written, pair: { written, reversed: orders.find((o) => o.order.join() === "d,c,b,a")!.p }, ...overrides };
}

const fixed = (p: Probs) => () => p;
const onlyAt = (special: Record<string, Probs>, rest: Probs) => (order: string[]): Probs => special[order.join()] ?? rest;

test("tie rule: top-2 margin of the all-orders mean below 0.08 is a tie", () => {
  assert.equal(isTied(0.07), true);
  assert.equal(isTied(0.08), false);
  assert.equal(isTied(0.58 - 0.5), false);
  assert.equal(isTied(0.07999), true);
  const tied = analyzeDecision("t", NAMES, raw("t", fixed({ a: 0.31, b: 0.28, c: 0.21, d: 0.2 })));
  assert.equal(tied.margin_all24, 0.03);
  assert.equal(tied.tie, true);
  const clear = analyzeDecision("c", NAMES, raw("c", fixed({ a: 0.5, b: 0.2, c: 0.2, d: 0.1 })));
  assert.equal(clear.tie, false);
  assert.equal(analyzeDecision("m", NAMES, raw("m", fixed({ a: 0.31, b: 0.28, c: 0.21, d: 0.2 })), 0.02).tie, false);
});

test("distance is the max over options of |policy vector - reference|, full-24 and leave-out", () => {
  const slot0 = (order: string[]): Probs => {
    const p: Probs = { a: 0.1, b: 0.1, c: 0.1, d: 0.1 };
    p[order[0]!] = 0.7;
    return p;
  };
  const d = analyzeDecision("s", NAMES, raw("s", slot0));
  assert.equal(d.distance_max_abs.written, 0.45);
  assert.equal(d.distance_max_abs.written_reversed, 0.15);
  assert.equal(d.distance_max_abs.rotations4, 0);
  assert.equal(d.distance_max_abs.same_request_pair, 0.15);
  assert.equal(d.tie, true);
});

const Y: Probs = { a: 0.4, b: 0.3, c: 0.2, d: 0.1 };
const W: Probs = { a: 0.7, b: 0.1, c: 0.1, d: 0.1 };
const V: Probs = { a: 0.5, b: 0.1, c: 0.3, d: 0.1 };

test("leave-out reference drops the orders a policy asked: written 1, reversed 2, rotations 4, pair the same 2", () => {
  const d = analyzeDecision("lo", NAMES, raw("lo", onlyAt({ "a,b,c,d": W, "d,c,b,a": V }, Y)));
  assert.equal(d.distance_max_abs.written_reversed, 0.1833);
  assert.equal(d.distance_leave_out.written_reversed, 0.2);
  assert.equal(d.distance_leave_out.same_request_pair, 0.2);
  assert.equal(d.distance_max_abs.written, 0.2833);
  assert.equal(d.distance_leave_out.written, 0.2957);
  assert.equal(d.distance_max_abs.rotations4, 0.0583);
  assert.equal(d.distance_leave_out.rotations4, 0.07);
  assert.equal(d.exact.distance_leave_out.written_reversed, 0.2);
});

test("same_request_pair keeps the written and reversed orders out of its reference although its draws are separate", () => {
  const separate = { written: { a: 0.6, b: 0.2, c: 0.1, d: 0.1 }, reversed: { a: 0.4, b: 0.2, c: 0.3, d: 0.1 } };
  const d = analyzeDecision("sr", NAMES, raw("sr", onlyAt({ "a,b,c,d": W, "d,c,b,a": V }, Y), { pair: separate }));
  assert.equal(d.distance_leave_out.same_request_pair, 0.1);
  assert.equal(d.distance_leave_out.written_reversed, 0.2);
  assert.equal(d.distance_max_abs.same_request_pair, 0.0833);
});

test("written_reask is the mean of the written and the re-ask answer, left-out reference excludes only the written order", () => {
  const reask = { a: 0.5, b: 0.3, c: 0.1, d: 0.1 };
  const d = analyzeDecision("wr", NAMES, raw("wr", onlyAt({ "a,b,c,d": W }, Y), { reask }));
  assert.equal(d.distance_leave_out.written_reask, 0.2);
  assert.equal(d.distance_leave_out.written, 0.3);
  assert.equal(d.distance_max_abs.written_reask, 0.1875);
  assert.equal(d.leader_match.written_reask, true);
  assert.equal("written_reask" in d.policy, false);
  const flipped = { a: 0.3, b: 0.5, c: 0.1, d: 0.1 };
  const miss = analyzeDecision("miss", NAMES, raw("miss", onlyAt({ "a,b,c,d": flipped }, Y), { reask: flipped }));
  assert.equal(miss.leader_match.written, false);
  assert.equal(miss.leader_match.written_reask, false);
  const rescued = analyzeDecision("rescued", NAMES, raw("rescued", onlyAt({ "a,b,c,d": flipped }, Y), { reask: { a: 0.9, b: 0.05, c: 0.03, d: 0.02 } }));
  assert.equal(rescued.leader_match.written, false);
  assert.equal(rescued.leader_match.written_reask, true);
});

test("leader agreement on non-tied decisions excludes tied ones and counts both", () => {
  const tiedFlip = raw("tied", (order) => (order[0] === "a" ? { a: 0.28, b: 0.27, c: 0.23, d: 0.22 } : { a: 0.27, b: 0.28, c: 0.23, d: 0.22 }));
  const clearWritten = raw("clear", fixed({ a: 0.6, b: 0.2, c: 0.1, d: 0.1 }));
  const wrongWritten = raw("wrong", (order) => (order.join() === "a,b,c,d" ? { a: 0.1, b: 0.6, c: 0.2, d: 0.1 } : { a: 0.6, b: 0.1, c: 0.2, d: 0.1 }));
  const ds = [tiedFlip, clearWritten, wrongWritten].map((r) => analyzeDecision(r.id, NAMES, r));
  assert.deepEqual(ds.map((d) => d.tie), [true, false, false]);
  const s = summarize(ds, META);
  assert.equal(s.tied_decisions, 1);
  assert.equal(s.non_tied_decisions, 2);
  assert.equal(s.policy_agreement_non_tied.written, 1);
  assert.equal(s.policy_agreement_non_tied.written_reask, 1);
  assert.equal(s.policy_agreement_non_tied.rotations4, 2);
  assert.equal(s.policy_distance_max_abs.written.max, 0.4792);
  assert.equal(s.policy_agreement_with_all24.written, 1);
  assert.equal(s.policy_agreement_with_all24.rotations4, 3);
  assert.deepEqual(Object.keys(s.policy_agreement_with_all24), ["written", "written_reversed", "rotations4", "same_request_pair"]);
});

test("nearest-rank percentile and reask noise summary", () => {
  const xs = Array.from({ length: 20 }, (_, i) => (i + 1) / 100);
  assert.equal(percentileNearestRank(xs, 95), 0.19);
  assert.equal(percentileNearestRank([0.5], 95), 0.5);
  assert.equal(percentileNearestRank(Array.from({ length: 21 }, (_, i) => i), 95), 19);
  const ds = [0, 0.02, 0.04, 0.1].map((delta, i) => analyzeDecision(`r${i}`, NAMES, raw(`r${i}`, fixed({ a: 0.6, b: 0.2, c: 0.1, d: 0.1 }), { reask: { a: 0.6 - delta, b: 0.2 + delta, c: 0.1, d: 0.1 } })));
  const s = summarize(ds, META);
  assert.equal(s.reask_noise.mean, 0.04);
  assert.equal(s.reask_noise.p95, 0.1);
});

const BASE: Probs = { a: 0.6, b: 0.2, c: 0.1, d: 0.1 };
const shifted = (delta: number): Probs => ({ a: 0.6 - delta, b: 0.2 + delta, c: 0.1, d: 0.1 });
const patch = (d: Decision, exact: Partial<Decision["exact"]>): Decision => ({ ...d, exact: { ...d.exact, ...exact } });
const flipPair = (i: number) => (i === 0 ? { written: BASE, reversed: { a: 0.1, b: 0.7, c: 0.1, d: 0.1 } } : undefined);
const round4 = (x: number) => Number(x.toFixed(4));

interface K3Options {
  reversed?: number[];
  written?: number[];
  reask?: number | number[];
  pair?: (i: number) => RawDecision["pair"] | undefined;
}

function k3Set(n: number, o: K3Options = {}): Decision[] {
  return Array.from({ length: n }, (_, i) => {
    const reask = Array.isArray(o.reask) ? o.reask[i] ?? 0 : o.reask ?? 0;
    const pair = o.pair?.(i) ?? { written: shifted(o.written?.[i] ?? 0), reversed: shifted(o.reversed?.[i] ?? 0) };
    const r = raw(`k${i}`, fixed(BASE), { reask: shifted(reask), pair });
    return analyzeDecision(r.id, NAMES, r);
  });
}

const spreadDeltas = (n: number, bad: number, value: number) => Array.from({ length: n }, (_, i) => (i < bad ? value : 0));

test("K3 cutoff c(n) is a lookup of the calibrated table, null outside 20 to 45 and for non-integers", () => {
  assert.equal(breachCutoff(30), 10);
  assert.equal(breachCutoff(35), 10);
  assert.equal(breachCutoff(39), 11);
  assert.equal(breachCutoff(40), 13);
  assert.equal(breachCutoff(K3_CAL_MIN_N), 9);
  assert.equal(breachCutoff(K3_CAL_MAX_N), 13);
  for (const n of [19, 46, 0, -1, 39.5, Number.NaN]) assert.equal(breachCutoff(n), null);
  assert.equal(K3_CAL_MIN_N, 20);
  assert.equal(K3_CAL_MAX_N, 45);
});

test("embedded K3_CUTOFFS equals jev-evals/decide-close/k3-cutoffs.json and covers exactly 20 to 45", () => {
  const json = JSON.parse(readFileSync(join(repo, "jev-evals/decide-close/k3-cutoffs.json"), "utf8"));
  assert.deepEqual(K3_CUTOFFS, json.cutoffs);
  assert.deepEqual(Object.keys(K3_CUTOFFS).map(Number), Array.from({ length: K3_CAL_MAX_N - K3_CAL_MIN_N + 1 }, (_, i) => K3_CAL_MIN_N + i));
  assert.deepEqual(json.grid.n, [K3_CAL_MIN_N, K3_CAL_MAX_N]);
  assert.equal(json.analysis.file, "scripts/order-analysis.mjs");
  assert.deepEqual(json.analysis, fingerprint());
});

test("K3 breach condition passes at X = c(n) and fails at X = c(n) + 1, for n = 30, 39 and 40", () => {
  for (const [n, c] of [[30, 10], [39, 11], [40, 13]] as const) {
    const at = evaluateK3(k3Set(n, { reversed: spreadDeltas(n, c, 0.3) }));
    assert.equal(at.breach_condition.breaches, c);
    assert.equal(at.breach_condition.max_breaches_allowed, c);
    assert.equal(at.breach_condition.pass, true);
    assert.equal(at.verdict, "pass");
    assert.equal(at.k3_pass, true);
    const over = evaluateK3(k3Set(n, { reversed: spreadDeltas(n, c + 1, 0.3) }));
    assert.equal(over.breach_condition.breaches, c + 1);
    assert.equal(over.breach_condition.pass, false);
    assert.equal(over.verdict, "fail");
    assert.equal(over.k3_pass, false);
  }
  const k3 = evaluateK3(k3Set(39));
  assert.equal(k3.breach_condition.decisions, 39);
  assert.deepEqual(k3.breach_condition.calibrated_range, [20, 45]);
});

test("K3 outside the calibrated range is inconclusive, also when the set is noisy, and never passes or fails", () => {
  for (const n of [19, 46]) {
    const k3 = evaluateK3(k3Set(n, { reversed: spreadDeltas(n, n, 0.3) }));
    assert.equal(k3.verdict, VERDICT_RANGE);
    assert.equal(VERDICT_RANGE, "inconclusive (n outside the calibrated range)");
    assert.equal(k3.breach_condition.max_breaches_allowed, null);
    assert.equal(k3.breach_condition.pass, null);
    assert.equal(k3.breach_condition.breaches, n);
    assert.equal(k3.k3_pass, null);
  }
  const noisy = evaluateK3(k3Set(19, { reask: 0.15 }));
  assert.equal(noisy.noisy, true);
  assert.equal(noisy.verdict, VERDICT_RANGE);
  assert.equal(evaluateK3(k3Set(20, { reask: 0.15 })).verdict, "inconclusive (noise)");
});

test("K3 breach: either the reversed or the written delta over T breaches, and a decision counts once", () => {
  const written = evaluateK3(k3Set(20, { written: spreadDeltas(20, 10, 0.3) }));
  assert.equal(written.breach_condition.written_breaches, 10);
  assert.equal(written.breach_condition.reversed_breaches, 0);
  assert.equal(written.breach_condition.breaches, 10);
  assert.equal(written.verdict, "fail");
  const reversed = evaluateK3(k3Set(20, { reversed: spreadDeltas(20, 10, 0.3) }));
  assert.equal(reversed.breach_condition.breaches, 10);
  assert.equal(reversed.verdict, "fail");
  const both = evaluateK3(k3Set(20, { written: spreadDeltas(20, 10, 0.06), reversed: spreadDeltas(20, 10, 0.06) }));
  assert.equal(both.breach_condition.written_breaches, 10);
  assert.equal(both.breach_condition.reversed_breaches, 10);
  assert.equal(both.breach_condition.breaches, 10);
  assert.deepEqual(both.breach_condition.breach_ids.slice(0, 4), ["k0", "k1", "k2", "k3"]);
  assert.equal(both.verdict, "fail");
  const twice = evaluateK3(k3Set(20, { written: spreadDeltas(20, 9, 0.06), reversed: spreadDeltas(20, 9, 0.06) }));
  assert.equal(twice.breach_condition.breaches, 9);
  assert.equal(twice.verdict, "pass");
  const split = evaluateK3(k3Set(20, { written: [0, 0, 0, 0, 0, 0.06, 0.06, 0.06, 0.06, 0.06], reversed: [0.06, 0.06, 0.06, 0.06, 0.06, 0, 0, 0, 0, 0] }));
  assert.equal(split.breach_condition.breaches, 10);
  assert.equal(split.verdict, "fail");
  const splitNine = evaluateK3(k3Set(20, { written: [0, 0, 0, 0, 0, 0.06, 0.06, 0.06, 0.06], reversed: [0.06, 0.06, 0.06, 0.06, 0.06, 0, 0, 0, 0, 0] }));
  assert.equal(splitNine.breach_condition.breaches, 9);
  assert.equal(splitNine.verdict, "pass");
});

test("K3 passes when the breach count is within c(n) and decisive leaders match", () => {
  const k3 = evaluateK3(k3Set(20, { reversed: [0.01, 0.02, 0.03, 0.04, ...spreadDeltas(14, 0, 0), 0.3, 0.3] }));
  assert.equal(k3.leader_condition.status, "pass");
  assert.equal(k3.leader_condition.pass, true);
  assert.equal(k3.leader_condition.decisive_decisions, 20);
  assert.equal(k3.breach_condition.threshold, 0.04);
  assert.equal(k3.breach_condition.breaches, 2);
  assert.equal(k3.verdict, "pass");
  assert.equal(k3.basis, "breach count and leader condition");
  assert.equal(k3.k3_pass, true);
});

test("K3 fails when a decisive same-request leader differs and at least 15 decisions are decisive", () => {
  const k3 = evaluateK3(k3Set(20, { pair: flipPair }));
  assert.equal(k3.leader_condition.status, "fail");
  assert.equal(k3.leader_condition.pass, false);
  assert.deepEqual(k3.leader_condition.mismatch_ids, ["k0"]);
  assert.equal(k3.breach_condition.pass, true);
  assert.equal(k3.verdict, "fail");
  assert.equal(k3.k3_pass, false);
});

const tiedOutOf = (n: number, k: number, o: K3Options = {}) => k3Set(n, o).map((d, i) => (i < k ? patch(d, { margin_all24: 0.01 }) : d));

test("K3 leader condition is not assessable below 15 decisive decisions: 14 not assessable, 15 assessable", () => {
  assert.equal(K3_MIN_DECISIVE, 15);
  const fourteen = evaluateK3(tiedOutOf(20, 6, { pair: (i) => (i === 19 ? flipPair(0) : undefined) }));
  assert.equal(fourteen.leader_condition.decisive_decisions, 14);
  assert.equal(fourteen.leader_condition.status, "not assessable");
  assert.equal(fourteen.leader_condition.pass, null);
  assert.equal(fourteen.leader_condition.mismatches, 1);
  assert.equal(fourteen.basis, "breach count alone (leader condition not assessable)");
  assert.equal(fourteen.verdict, "pass");
  assert.equal(fourteen.k3_pass, true);
  const fifteen = evaluateK3(tiedOutOf(20, 5, { pair: (i) => (i === 19 ? flipPair(0) : undefined) }));
  assert.equal(fifteen.leader_condition.decisive_decisions, 15);
  assert.equal(fifteen.leader_condition.status, "fail");
  assert.equal(fifteen.verdict, "fail");
  assert.equal(evaluateK3(tiedOutOf(20, 5)).leader_condition.status, "pass");
  const k3 = evaluateK3(tiedOutOf(20, 6));
  assert.equal(k3.leader_condition.decisive_decisions, 14);
  assert.equal(k3.leader_condition.status, "not assessable");
  assert.deepEqual(k3.leader_condition.excluded.slice(0, 2), [{ id: "k0", reason: "all24_margin_below_0.08" }, { id: "k1", reason: "all24_margin_below_0.08" }]);
});

test("K3 rests on the breach count alone when the leader condition is not assessable, so a breach failure still fails", () => {
  const k3 = evaluateK3(tiedOutOf(20, 6, { reversed: spreadDeltas(20, 10, 0.3) }));
  assert.equal(k3.leader_condition.status, "not assessable");
  assert.equal(k3.breach_condition.max_breaches_allowed, 9);
  assert.equal(k3.breach_condition.breaches, 10);
  assert.equal(k3.breach_condition.pass, false);
  assert.equal(k3.verdict, "fail");
  assert.equal(k3.basis, "breach count alone (leader condition not assessable)");
});

test("K3 decisive rule: 24-order margin at least 0.08 and both policy margins at least max(0.08, 2 x re-ask p95), unrounded", () => {
  const ds = k3Set(26, { reask: 0.05 }).map((d, i) => {
    if (i === 0) return patch(d, { pair_margin: 0.0999 });
    if (i === 1) return patch(d, { pair_margin: 0.1 });
    if (i === 2) return patch(d, { written_reversed_margin: 0.0999 });
    if (i === 3) return patch(d, { written_reversed_margin: 0.1 });
    if (i === 4) return patch(d, { margin_all24: 0.0799 });
    if (i === 5) return patch(d, { margin_all24: 0.08 });
    return d;
  });
  const k3 = evaluateK3(ds);
  assert.equal(k3.breach_condition.reask_p95, 0.05);
  assert.equal(k3.leader_condition.decisive_margin, 0.1);
  assert.equal(k3.leader_condition.decisive_decisions, 23);
  assert.equal(k3.leader_condition.excluded_decisions, 3);
  assert.deepEqual(k3.leader_condition.excluded, [
    { id: "k0", reason: "pair_margin_below_decisive_margin" },
    { id: "k2", reason: "written_reversed_margin_below_decisive_margin" },
    { id: "k4", reason: "all24_margin_below_0.08" },
  ]);
  const low = k3Set(21, { reask: 0.02 }).map((d, i) => (i === 0 ? patch(d, { pair_margin: 0.0799 }) : i === 1 ? patch(d, { pair_margin: 0.08 }) : d));
  const k3Low = evaluateK3(low);
  assert.equal(k3Low.leader_condition.decisive_margin, 0.08);
  assert.deepEqual(k3Low.leader_condition.excluded, [{ id: "k0", reason: "pair_margin_below_decisive_margin" }]);
  const noise = k3Set(21, { reask: 0.04 }).map((d, i) => (i === 0 ? patch(d, { pair_margin: 0.0799 }) : d));
  assert.equal(evaluateK3(noise).leader_condition.decisive_margin, 0.08);
});

test("K3 excluded decisions with a leader mismatch are listed, not counted as mismatches", () => {
  const lowMargin = { a: 0.33998, b: 0.3, c: 0.18, d: 0.18002 };
  const pair = (i: number) => (i === 0 ? { written: { a: 0.29, b: 0.3, c: 0.21, d: 0.2 }, reversed: { a: 0.29, b: 0.3, c: 0.21, d: 0.2 } } : i === 1 ? { written: lowMargin, reversed: lowMargin } : undefined);
  const ds = k3Set(23, { reask: 0.04, pair }).map((d, i) => (i === 2 ? patch(d, { margin_all24: 0.03 }) : d));
  const k3 = evaluateK3(ds);
  assert.equal(ds[0]!.pair_leader_matches_written_reversed, false);
  assert.equal(k3.leader_condition.decisive_decisions, 20);
  assert.equal(k3.leader_condition.excluded_decisions, 3);
  assert.deepEqual(k3.leader_condition.excluded, [
    { id: "k0", reason: "pair_margin_below_decisive_margin" },
    { id: "k1", reason: "pair_margin_below_decisive_margin" },
    { id: "k2", reason: "all24_margin_below_0.08" },
  ]);
  assert.equal(k3.leader_condition.mismatches, 0);
  assert.equal(k3.leader_condition.status, "pass");
});

test("K3 is inconclusive (noise) when the re-ask p95 is above 0.10, and still reports the numbers", () => {
  const exactly = evaluateK3(k3Set(20, { reask: 0.1, reversed: spreadDeltas(20, 20, 0.09) }));
  assert.equal(exactly.noisy, false);
  assert.equal(exactly.breach_condition.reask_p95, 0.1);
  assert.equal(exactly.breach_condition.threshold, 0.1);
  assert.equal(exactly.breach_condition.breaches, 0);
  assert.equal(exactly.verdict, "pass");
  const noisy = evaluateK3(k3Set(20, { reask: 0.10004 }));
  assert.equal(noisy.noisy, true);
  assert.equal(noisy.verdict, "inconclusive (noise)");
  assert.equal(noisy.k3_pass, null);
  assert.equal(noisy.breach_condition.pass, true);
  const noisyFail = evaluateK3(k3Set(20, { reask: 0.15, reversed: spreadDeltas(20, 20, 0.2) }));
  assert.equal(noisyFail.verdict, "inconclusive (noise)");
  assert.equal(noisyFail.breach_condition.threshold, 0.15);
  assert.equal(noisyFail.breach_condition.breaches, 20);
  assert.equal(noisyFail.breach_condition.pass, false);
  const s = summarize(k3Set(20, { reask: 0.15 }), META);
  assert.equal(s.k3.verdict, "inconclusive (noise)");
  assert.equal(s.k3_pass, null);
});

test("K3 threshold T is max(0.04, re-ask p95), unrounded, with no cap below the noise limit", () => {
  const floor = evaluateK3(k3Set(20, { reask: 0.01 }));
  assert.equal(floor.breach_condition.threshold, 0.04);
  const rises = evaluateK3(k3Set(20, { reask: 0.07, reversed: spreadDeltas(20, 20, 0.06) }));
  assert.equal(rises.breach_condition.threshold, 0.07);
  assert.equal(rises.breach_condition.breaches, 0);
  const above = evaluateK3(k3Set(20, { reask: 0.07, reversed: spreadDeltas(20, 20, 0.08) }));
  assert.equal(above.breach_condition.breaches, 20);
  assert.equal(above.verdict, "fail");
  const high = evaluateK3(k3Set(20, { reask: 0.1, reversed: spreadDeltas(20, 20, 0.11) }));
  assert.equal(high.breach_condition.threshold, 0.1);
  assert.equal(high.breach_condition.breaches, 20);
});

test("K3 compares unrounded values: a delta of 0.04004 breaches T = 0.04 while 0.04 does not", () => {
  const over = k3Set(20, { reversed: spreadDeltas(20, 20, 0.04004) });
  assert.equal(over[0]!.k3_same_request_vs_separate.reversed_max_delta, 0.04);
  assert.equal(over[0]!.exact.k3_reversed_max_delta, 0.04004);
  const failed = evaluateK3(over);
  assert.equal(failed.breach_condition.threshold, 0.04);
  assert.equal(failed.breach_condition.breaches, 20);
  assert.equal(failed.verdict, "fail");
  const exact = evaluateK3(k3Set(20, { reversed: spreadDeltas(20, 20, 0.04) }));
  assert.equal(exact.breach_condition.breaches, 0);
  assert.equal(exact.verdict, "pass");
  const rawP95 = evaluateK3(k3Set(20, { reask: 0.04004, reversed: spreadDeltas(20, 20, 0.04004) }));
  assert.equal(rawP95.breach_condition.breaches, 0);
  const aboveP95 = evaluateK3(k3Set(20, { reask: 0.04004, reversed: spreadDeltas(20, 20, 0.04006) }));
  assert.equal(aboveP95.breach_condition.breaches, 20);
});

test("spread counts use the unrounded value: 0.23996 rounds to 0.24 but does not count, 0.24 counts", () => {
  const spreadOf = (rest: number) => analyzeDecision("sp", NAMES, raw("sp", onlyAt({ "a,b,c,d": { a: 0.5, b: 0.2, c: 0.2, d: 0.1 } }, { a: rest, b: 0.2, c: 0.2, d: 0.1 })));
  const below = spreadOf(0.26004);
  assert.equal(below.max_spread, 0.24);
  assert.equal(below.exact.max_spread, 0.23996);
  assert.equal(summarize([below], META).decisions_spread_ge_0_24, 0);
  const at = spreadOf(0.26);
  assert.equal(summarize([at], META).decisions_spread_ge_0_24, 1);
  assert.equal(summarize([spreadOf(0.4), at, below], META).decisions_spread_ge_0_24, 1);
});

test("leave-out distance is the full-24 distance times 24/(24-k) for the policies that are means of their own k orders", () => {
  const d = analyzeDecision("id", NAMES, raw("id", onlyAt({ "a,b,c,d": W, "d,c,b,a": V }, Y)));
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  assert.equal(near(d.exact.distance_leave_out.written!, (d.exact.distance_full.written! * 24) / 23), true);
  assert.equal(near(d.exact.distance_leave_out.written_reversed!, (d.exact.distance_full.written_reversed! * 24) / 22), true);
  assert.equal(near(d.exact.distance_leave_out.rotations4!, (d.exact.distance_full.rotations4! * 24) / 20), true);
});

type Dist = { written: number; reask: number; reversed: number };
type Match = { written: boolean; reask: boolean; reversed: boolean };

function shape(id: string, leaveOut: Dist, match: Match, tie: boolean): Decision {
  const base = analyzeDecision(id, NAMES, raw(id, fixed(BASE)));
  return {
    ...base,
    tie,
    exact: { ...base.exact, distance_leave_out: { ...base.exact.distance_leave_out, written: leaveOut.written, written_reask: leaveOut.reask, written_reversed: leaveOut.reversed } },
    leader_match: { ...base.leader_match, written: match.written, written_reask: match.reask, written_reversed: match.reversed },
  };
}

const gate = (n: number, f: (i: number) => Dist, match: Match = { written: true, reask: true, reversed: true }, tied: (i: number) => boolean = () => false) =>
  summarize(Array.from({ length: n }, (_, i) => shape(`p${i}`, f(i), match, tied(i))), META).policy_comparison;
const flat = (written: number, reask: number, reversed: number) => () => ({ written, reask, reversed });

test("policy gate: written_reversed needs a mean gain of at least 0.02 and a strictly smaller distance in at least 60% of decisions", () => {
  const helped = gate(10, flat(0.3, 0.25, 0.1));
  assert.equal(helped.allowed_wording, WORDING.helped);
  assert.equal(helped.written_reversed_vs_written_reask.mean_leave_out_gain, 0.15);
  assert.equal(helped.written_reversed_vs_written_reask.decisions_strictly_smaller, 10);
  assert.equal(helped.written_reversed_vs_written_reask.win_share, 1);
  const half = gate(10, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 5 ? 0 : 0.25 }));
  assert.equal(half.written_reversed_vs_written_reask.mean_leave_out_gain, 0.075);
  assert.equal(half.written_reversed_vs_written_reask.decisions_strictly_smaller, 5);
  assert.equal(half.written_reversed_vs_written_reask.beats, false);
  const sixty = gate(10, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 6 ? 0 : 0.25 }));
  assert.equal(sixty.written_reversed_vs_written_reask.decisions_strictly_smaller, 6);
  assert.equal(sixty.written_reversed_vs_written_reask.win_share, 0.6);
  assert.equal(sixty.written_reversed_vs_written_reask.beats, true);
  assert.equal(sixty.allowed_wording, WORDING.helped);
  const fiftyNine = gate(17, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 10 ? 0 : 0.25 }));
  assert.equal(fiftyNine.written_reversed_vs_written_reask.win_share, 0.5882);
  assert.equal(fiftyNine.written_reversed_vs_written_reask.beats, false);
  const exactSixty = gate(15, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 9 ? 0 : 0.25 }));
  assert.equal(exactSixty.written_reversed_vs_written_reask.beats, true);
});

test("policy gate: ties count against written_reversed", () => {
  const tiesHalf = gate(10, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 5 ? 0 : 0.2 }));
  assert.equal(tiesHalf.written_reversed_vs_written_reask.decisions_strictly_smaller, 5);
  assert.equal(tiesHalf.written_reversed_vs_written_reask.mean_leave_out_gain, 0.1);
  assert.equal(tiesHalf.written_reversed_vs_written_reask.beats, false);
  const tiesSixty = gate(10, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 6 ? 0 : 0.2 }));
  assert.equal(tiesSixty.written_reversed_vs_written_reask.decisions_strictly_smaller, 6);
  assert.equal(tiesSixty.written_reversed_vs_written_reask.beats, true);
  const floatNoise = gate(10, (i) => ({ written: 0.3, reask: 0.2, reversed: 0.2 - (i < 6 ? 1e-12 : 0) }));
  assert.equal(floatNoise.written_reversed_vs_written_reask.decisions_strictly_smaller, 0);
});

test("policy gate: the mean gain margin is 0.02, unrounded, even when every decision is a win", () => {
  assert.equal(gate(10, flat(0.3, 0.105, 0.1)).written_reversed_vs_written_reask.beats, false);
  assert.equal(gate(10, flat(0.3, 0.12, 0.1)).written_reversed_vs_written_reask.mean_leave_out_gain, 0.02);
  assert.equal(gate(10, flat(0.3, 0.12, 0.1)).written_reversed_vs_written_reask.beats, true);
  assert.equal(gate(10, flat(0.3, 0.1199, 0.1)).written_reversed_vs_written_reask.beats, false);
  assert.equal(gate(10, flat(0.3, 0.1199, 0.1)).written_reversed_vs_written_reask.decisions_strictly_smaller, 10);
});

test("policy gate wording: helped when written_reask is beaten, averaging when only written is beaten, otherwise no verdict", () => {
  assert.equal(gate(10, flat(0.3, 0.25, 0.1)).allowed_wording, WORDING.helped);
  const averaging = gate(10, flat(0.3, 0.105, 0.1));
  assert.equal(averaging.written_reversed_vs_written.beats, true);
  assert.equal(averaging.written_reversed_vs_written_reask.beats, false);
  assert.equal(averaging.allowed_wording, WORDING.averaging);
  assert.equal(WORDING.averaging, "averaging two answers helped; not shown to be the order");
  const reaskOnly = gate(10, flat(0.11, 0.3, 0.1));
  assert.equal(reaskOnly.written_reversed_vs_written.beats, false);
  assert.equal(reaskOnly.written_reversed_vs_written_reask.beats, true);
  assert.equal(reaskOnly.allowed_wording, WORDING.helped);
  assert.equal(gate(10, flat(0.1, 0.1, 0.1)).allowed_wording, WORDING.none);
  assert.equal(WORDING.none, "no verdict");
});

test("policy gate ignores leader agreement: it is reported as descriptive and does not enter the gate", () => {
  const worseMatches = gate(10, flat(0.3, 0.25, 0.1), { written: true, reask: true, reversed: false });
  assert.equal(worseMatches.allowed_wording, WORDING.helped);
  assert.equal(worseMatches.written_reversed_vs_written_reask.extra_leader_matches_descriptive, -10);
  const betterMatches = gate(10, flat(0.1, 0.1, 0.1), { written: false, reask: false, reversed: true });
  assert.equal(betterMatches.written_reversed_vs_written_reask.extra_leader_matches_descriptive, 10);
  assert.equal(betterMatches.written_reversed_vs_written.beats, false);
  assert.equal(betterMatches.allowed_wording, WORDING.none);
  assert.match(betterMatches.leader_reference, /full-24 leader.*descriptive/);
});

test("policy gate share is over all decisions, tied ones included", () => {
  const withTies = gate(10, (i) => ({ written: 0.3, reask: 0.2, reversed: i < 6 ? 0 : 0.25 }), undefined, (i) => i < 3);
  assert.equal(withTies.written_reversed_vs_written_reask.decisions, 10);
  assert.equal(withTies.written_reversed_vs_written_reask.decisions_strictly_smaller, 6);
  assert.equal(withTies.written_reversed_vs_written_reask.beats, true);
});

test("registration needs margin 0.08, the registered cases file and no --limit", () => {
  const abs = resolve(fileURLToPath(new URL("..", import.meta.url)), REGISTERED_CASES);
  assert.equal(REGISTERED_CASES, "jev-evals/decide-close/cases.jsonl");
  assert.equal(isRegistered({ tieMargin: 0.08, input: REGISTERED_CASES, limitUsed: false }), true);
  assert.equal(isRegistered({ tieMargin: 0.08, input: abs, limitUsed: false }), true);
  assert.equal(isRegistered({ tieMargin: 0.08, input: REGISTERED_CASES, limitUsed: true }), false);
  assert.equal(isRegistered({ tieMargin: 0.05, input: REGISTERED_CASES, limitUsed: false }), false);
  assert.equal(isRegistered({ tieMargin: 0.1, input: REGISTERED_CASES, limitUsed: false }), false);
  assert.equal(isRegistered({ tieMargin: 0.08, input: "jev-evals/decide/cases.jsonl", limitUsed: false }), false);
  assert.equal(isRegistered({ tieMargin: 0.08, input: "cases.jsonl", limitUsed: false }), false);
  assert.equal(isRegistered({ tieMargin: 0.08, input: undefined, limitUsed: false }), false);
});

test("summary is marked registered only for a registered run at the 0.08 tie margin", () => {
  const ds = k3Set(20);
  assert.equal(summarize(ds, META).registered, false);
  assert.equal(summarize(ds, META, 0.08).registered, false);
  assert.equal(summarize(ds, META, 0.08, true).registered, true);
  assert.equal(summarize(ds, META, undefined, true).registered, true);
  assert.equal(summarize(ds, META, 0.05, true).registered, false);
  assert.equal(summarize(ds, META, 0.05, true).tie_margin, 0.05);
  assert.equal(summarize(ds, META, 0.1, true).registered, false);
});

test("subset summaries use their own re-ask p95 and refuse unknown ids", () => {
  const ds = [...k3Set(20, { reask: spreadDeltas(20, 0, 0) })].map((d, i) => (i < 5 ? { ...d, exact: { ...d.exact, reask_max_delta: 0.2 } } : d));
  const ids = ds.map((d) => d.id);
  const subsets = { full: ids, S1: ids.slice(0, 5), S2: ids.slice(5) };
  const s = subsetSummaries(ds, subsets);
  assert.deepEqual(Object.keys(s), ["S1", "S2"]);
  assert.equal(s.S1!.decisions, 5);
  assert.equal(s.S1!.reask_noise.p95, 0.2);
  assert.equal(s.S2!.decisions, 15);
  assert.equal(s.S2!.reask_noise.p95, 0);
  assert.throws(() => subsetSummaries(ds, { full: ids, S1: ["nope"] }), /not in the report/);
  assert.throws(() => subsetSummaries(ds, { full: ids.slice(1), S1: ids.slice(0, 2) }), /full set does not match/);
  const lines = sideBySide({ full: summarize(ds, META), ...s });
  assert.match(lines[0]!, /full\s+S1\s+S2/);
  assert.equal(lines.some((l) => l.startsWith("K3 verdict")), true);
});

test("subsets file is validated against the case ids before any request", () => {
  const ids = ["c1", "c2", "c3"];
  assert.doesNotThrow(() => validateSubsets({ full: ids, S1: ["c1"], S2: ["c2", "c3"] }, ids));
  assert.throws(() => validateSubsets({ full: ids, S1: ["c1"] }, ids.slice(0, 2)), /full set does not match/);
  assert.throws(() => validateSubsets({ S1: ["zz"] }, ids), /not in the report: zz/);
  assert.throws(() => validateSubsets({ full: ids, S1: [] }, ids), /empty/);
});

test("screen keep rule needs both leaders below 0.70, compared unrounded", () => {
  const low = { a: 0.4, b: 0.3, c: 0.2, d: 0.1 };
  const high = { a: 0.8, b: 0.1, c: 0.05, d: 0.05 };
  const edge = { a: 0.7, b: 0.1, c: 0.1, d: 0.1 };
  assert.equal(screenKeep(low, low), true);
  assert.equal(screenKeep(low, high), false);
  assert.equal(screenKeep(high, low), false);
  assert.equal(screenKeep(edge, low), false);
  assert.equal(screenKeep({ a: 0.69, b: 0.31 }, low), true);
  assert.equal(screenKeep({ a: 0.69999, b: 0.30001 }, low), true);
  assert.equal(screenKeep({ a: 0.70001, b: 0.29999 }, low), false);
});

test("screen orders index the written options as badc and cadb", () => {
  const opts = ["a", "b", "c", "d"];
  assert.deepEqual(screenOrder(opts, "badc"), ["b", "a", "d", "c"]);
  assert.deepEqual(screenOrder(opts, "cadb"), ["c", "a", "d", "b"]);
});

test("candidate validation enforces option names matching /^[a-z]+$/ and exactly 4 distinct options", () => {
  const ok = { id: "x", decision: "d", context: "c", options: ["a", "b", "c", "d"].map((name) => ({ name, text: `t ${name}` })) };
  const named = (name: string) => ({ ...ok, options: [{ name, text: "t" }, ...ok.options.slice(1)] });
  assert.equal(validateCandidate(ok), null);
  assert.equal(validateCandidate(named("redis")), null);
  assert.match(validateCandidate({ ...ok, options: ok.options.slice(0, 3) })!, /3 options/);
  assert.match(validateCandidate({ ...ok, options: [...ok.options, { name: "e", text: "t" }] })!, /5 options/);
  for (const bad of ["12", "a1", "A", "Redis", "a-b", "a_b", "a b", "", "é"]) assert.match(validateCandidate(named(bad))!, /does not match \/\^\[a-z\]\+\$\//, `name ${JSON.stringify(bad)}`);
  assert.match(validateCandidate({ ...ok, options: [{ name: "b", text: "t" }, ...ok.options.slice(1)] })!, /duplicate/);
});

test("selection skips duplicates, refuses invalid, and caps total lines in file order", () => {
  const ok = (id: string) => ({ id, decision: "d", context: "c", options: ["a", "b", "c", "d"].map((name) => ({ name, text: "t" })) });
  const pre = preflight([ok("old"), ok("n1"), { id: "bad", options: [] }, ok("n2"), ok("n1"), ok("n3"), ok("n4")], ["old"]);
  assert.deepEqual(pre.map((p) => p.status), ["duplicate", "pending", "refused", "pending", "duplicate", "pending", "pending"]);
  const entries = pre.map((p, i) => ({ status: p.status, keep: p.status === "pending" ? i !== 3 : null }));
  assert.deepEqual(selectKept(entries, 3, 5), ["duplicate", "kept", "refused", "rejected", "duplicate", "kept", "capped"]);
  assert.deepEqual(selectKept(entries, 5, 5), ["duplicate", "capped", "refused", "rejected", "duplicate", "capped", "capped"]);
});

const opts = ["a", "b", "c", "d"].map((name) => ({ name, text: `t ${name}` }));
const kase = (id: string, derived_from?: string) => ({ id, decision: "d", context: "c", options: opts, ...(derived_from ? { derived_from } : {}) });
const seen = (id: string, p1: number, p2: number, outcome = "kept") => ({ id, outcome, p1: { p_leader: p1 }, p2: { p_leader: p2 } });

test("subsets: S1 needs both screening leaders below 0.60, S2 keeps the first case per source", () => {
  const cases = [kase("c1", "x"), kase("c2", "x"), kase("c3"), kase("c4", "y"), kase("c5", "y"), kase("c6"), kase("y")];
  const r1 = { candidates: [seen("c1", 0.55, 0.5), seen("c2", 0.59, 0.6), seen("c3", 0.45, 0.59), seen("gone", 0.1, 0.1), seen("c4", 0.9, 0.9, "rejected"), { id: null, outcome: "refused" }] };
  const r2 = { candidates: [seen("c4", 0.3, 0.65), seen("c5", 0.5, 0.5), seen("c6", 0.59, 0.59), seen("y", 0.5, 0.5), seen("c7", 0.1, 0.1, "capped")] };
  const s = buildSubsets(cases, [r1, r2]);
  assert.deepEqual(s.full, ["c1", "c2", "c3", "c4", "c5", "c6", "y"]);
  assert.deepEqual(s.S1, ["c1", "c3", "c5", "c6", "y"]);
  assert.deepEqual(s.S2, ["c1", "c3", "c4", "c6", "y"]);
  assert.deepEqual(buildSubsets(cases, [r1, r2]), s);
  assert.throws(() => buildSubsets([...cases, kase("c8")], [r1, r2]), /no kept screening record for c8/);
  assert.throws(() => buildSubsets(cases, [r1, r1, r2]), /more than one/);
  assert.throws(() => buildSubsets([kase("c1"), kase("c1")], [r1]), /duplicate case ids/);
});

const repo = fileURLToPath(new URL("..", import.meta.url));
const script = join(repo, "scripts/order-sensitivity.mjs");
const realCases = (): { id: string; options: { name: string }[] }[] => readFileSync(join(repo, REGISTERED_CASES), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const scratch = () => mkdtempSync(join(tmpdir(), "order-cli-"));

async function withMock<T>(fn: (base: string, requests: () => number) => Promise<T>): Promise<T> {
  let count = 0;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      count++;
      const answers: Record<string, unknown> = {};
      for (const [key, q] of Object.entries<{ criteria: Record<string, string> }>(JSON.parse(body).questions)) {
        const names = Object.keys(q.criteria).sort();
        answers[key] = { probabilities: Object.fromEntries(names.map((n, i) => [n, [0.4, 0.3, 0.2, 0.1][i] ?? 0])) };
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ answers, usage: { input_tokens: 10 } }));
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, () => count);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
}

function runCli(args: string[], base: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: repo, env: { PATH: process.env.PATH ?? "", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: base, TYPESAFE_API_KEY: "test-key" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", fail);
    child.on("close", (code) => done({ code, stdout, stderr }));
  });
}

const readReport = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const caseLine = (id: string, names = ["a", "b", "c", "d"]) => JSON.stringify({ id, decision: "d", context: "c", options: names.map((name) => ({ name, text: `t ${name}` })) });

test("CLI full run: default input is the registered cases file, registered is true and every report path field is a basename", async () => {
  const dir = scratch();
  try {
    await withMock(async (base, requests) => {
      const out = join(dir, "deep", "order-test.json");
      const run = await runCli(["--subsets", "jev-evals/decide-close/subsets.json", "--out", out], base);
      assert.equal(run.code, 0, run.stderr);
      const report = readReport(out);
      assert.equal(requests(), realCases().length * 26);
      assert.equal(report.input, "cases.jsonl");
      assert.equal(report.summary.registered, true);
      assert.equal(report.summary.decisions, realCases().length);
      assert.deepEqual(Object.keys(report.subsets), ["S1", "S2"]);
      assert.equal(report.subsets.S1.registered, true);
      assert.equal(report.subsets.S2.registered, true);
      assert.equal(readFileSync(out, "utf8").includes(dir), false);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI full run: a margin other than 0.08 on the registered input is not registered", async () => {
  const dir = scratch();
  try {
    await withMock(async (base) => {
      const out = join(dir, "margin.json");
      const run = await runCli(["--margin", "0.05", "--out", out], base);
      assert.equal(run.code, 0, run.stderr);
      assert.equal(readReport(out).summary.registered, false);
      assert.equal(readReport(out).summary.tie_margin, 0.05);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI full run: --limit on the registered input is not registered, and neither is another cases file", async () => {
  const dir = scratch();
  try {
    await withMock(async (base, requests) => {
      const limited = join(dir, "limited.json");
      const run = await runCli(["--limit", "1", "--out", limited], base);
      assert.equal(run.code, 0, run.stderr);
      assert.equal(readReport(limited).summary.decisions, 1);
      assert.equal(readReport(limited).summary.registered, false);
      assert.equal(readReport(limited).input, "cases.jsonl");
      assert.equal(requests(), 26);
      const nested = join(dir, "nested", "deeper");
      mkdirSync(nested, { recursive: true });
      writeFileSync(join(nested, "mine.jsonl"), caseLine("only") + "\n");
      const other = join(dir, "other.json");
      const second = await runCli(["--in", join(nested, "mine.jsonl"), "--out", other], base);
      assert.equal(second.code, 0, second.stderr);
      const report = readReport(other);
      assert.equal(report.input, "mine.jsonl");
      assert.equal(report.summary.registered, false);
      assert.equal(readFileSync(other, "utf8").includes(dir), false);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI full run validates every case before any request: bad option names and wrong option counts stop the run", async () => {
  const dir = scratch();
  try {
    await withMock(async (base, requests) => {
      const file = join(dir, "bad.jsonl");
      writeFileSync(file, [caseLine("good"), caseLine("upper", ["Redis", "b", "c", "d"]), caseLine("three", ["a", "b", "c"])].join("\n") + "\n");
      const out = join(dir, "bad-out.json");
      const run = await runCli(["--in", file, "--out", out], base);
      assert.equal(run.code, 2);
      assert.match(run.stderr, /invalid case upper: option name "Redis" does not match/);
      assert.match(run.stderr, /invalid case three: 3 options, exactly 4 required/);
      assert.doesNotMatch(run.stderr, /invalid case good/);
      assert.equal(requests(), 0);
      assert.throws(() => readFileSync(out), /ENOENT/);
      const limited = await runCli(["--in", file, "--limit", "1", "--out", out], base);
      assert.equal(limited.code, 2);
      assert.match(limited.stderr, /invalid case upper/);
      assert.equal(requests(), 0);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function analyzeFixture(dir: string, ids: { id: string; names: string[] }[], summary: Record<string, unknown>) {
  const folder = join(dir, "sub");
  mkdirSync(folder, { recursive: true });
  const rawRows = ids.map(({ id, names }) => {
    const p = Object.fromEntries(names.map((n, i) => [n, [0.4, 0.3, 0.2, 0.1][i] ?? 0]));
    return { id, orders: permutations(names).map((order) => ({ order, p })), reask: p, pair: { written: p, reversed: p } };
  });
  writeFileSync(join(folder, "cases.jsonl"), ids.map(({ id, names }) => caseLine(id, names)).join("\n") + "\n");
  writeFileSync(join(folder, "report.json"), JSON.stringify({ model: "m", input: "some/where/else/cases.jsonl", method: "x", summary: { requests: 1, retries_429: 0, input_tokens: 1, cost_usd: 0, ...summary }, raw: rawRows }));
  return join(folder, "report.json");
}

test("CLI --analyze writes basenames for input and analyzed_from and finds the cases file next to the report", async () => {
  const dir = scratch();
  try {
    const report = analyzeFixture(dir, [{ id: "one", names: ["a", "b", "c", "d"] }], {});
    const out = join(dir, "out", "analyzed.json");
    const run = await runCli(["--analyze", report, "--out", out], "http://127.0.0.1:1");
    assert.equal(run.code, 0, run.stderr);
    const written = readReport(out);
    assert.equal(written.input, "cases.jsonl");
    assert.equal(written.analyzed_from, "report.json");
    assert.equal(written.summary.registered, false);
    assert.equal(readFileSync(out, "utf8").includes(dir), false);
    const missing = await runCli(["--analyze", join(dir, "sub", "report.json"), "--cases", join(dir, "nope.jsonl")], "http://127.0.0.1:1");
    assert.notEqual(missing.code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI --analyze keeps registered only for a registered report, the registered cases file and margin 0.08", async () => {
  const dir = scratch();
  try {
    const ids = realCases().map((c) => ({ id: c.id, names: c.options.map((o) => o.name) }));
    const registeredReport = analyzeFixture(dir, ids, { registered: true });
    const analyze = async (extra: string[], reportPath = registeredReport) => {
      const out = join(dir, `a-${extra.length}-${Math.random().toString(36).slice(2)}.json`);
      const run = await runCli(["--analyze", reportPath, "--out", out, ...extra], "http://127.0.0.1:1");
      assert.equal(run.code, 0, run.stderr);
      return readReport(out).summary.registered;
    };
    assert.equal(await analyze(["--cases", REGISTERED_CASES]), true);
    assert.equal(await analyze(["--cases", REGISTERED_CASES, "--margin", "0.05"]), false);
    assert.equal(await analyze([]), false);
    const unregistered = analyzeFixture(join(dir, "u"), ids, { registered: false });
    assert.equal(await analyze(["--cases", REGISTERED_CASES], unregistered), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("source clusters count the cases that share a derived_from with at least one other case", () => {
  const cases = [kase("c1", "x"), kase("c2", "x"), kase("c3"), kase("c4", "y"), kase("c5", "z"), kase("c6", "z"), kase("c7", "z")];
  assert.deepEqual(sourceClusters(cases), { cases: 7, multi_case_sources: 2, cases_in_multi_case_sources: 5, sources: [{ source: "x", cases: 2 }, { source: "z", cases: 3 }] });
  assert.equal(sourceClusters([kase("c1"), kase("c2", "y")]).multi_case_sources, 0);
});

const calibration = join(repo, "scripts/k3-calibration.mjs");
const runCalibration = (args: string[]) => execFileSync(process.execPath, [calibration, ...args], { cwd: repo, encoding: "utf8" });
const cellOf = (conclusive: number, hist: number[], leaderFailHist = hist.map(() => 0)): Cell => ({ sigma: 0.02, alpha: 3, byN: new Map([[5, { conclusive, hist, leaderFailHist }]]) });

test("calibration cutoff: smallest c whose tail is at most 0.05 in every cell, 0.05 itself allowed, empty cells skipped", () => {
  const a = cellOf(100, [90, 5, 3, 1, 1, 0]);
  const b = cellOf(100, [80, 10, 6, 3, 1, 0]);
  assert.equal(tailRate(a.byN.get(5)!, 0), 0.1);
  assert.equal(tailRate(a.byN.get(5)!, 1), 0.05);
  assert.equal(chooseCutoff([a], 5), 1);
  assert.equal(chooseCutoff([b], 5), 2);
  assert.equal(chooseCutoff([a, b], 5), 2);
  assert.equal(chooseCutoff([a, b, cellOf(0, [0, 0, 0, 0, 0, 0])], 5), 2);
  assert.equal(chooseCutoff([cellOf(100, [0, 0, 0, 0, 0, 100])], 5), 5);
  assert.equal(tailRate(cellOf(0, [0, 0, 0, 0, 0, 0]).byN.get(5)!, 0), 0);
});

test("calibration verdict fail rate adds leader-condition failures whose breach count is within the cutoff", () => {
  const cell = cellOf(100, [90, 5, 3, 1, 1, 0], [2, 1, 0, 0, 2, 0]).byN.get(5)!;
  assert.equal(verdictFailRate(cell, 1), 0.08);
  assert.equal(verdictFailRate(cell, 3), 0.04);
});

test("calibration script is deterministic for a fixed small grid and writes only to --out", () => {
  const dir = scratch();
  try {
    const args = ["--n-min", "20", "--n-max", "22", "--trials", "8", "--sigmas", "0.02,0.03", "--alphas", "3", "--seed", "5"];
    const first = runCalibration([...args, "--out", join(dir, "one.json")]);
    const second = runCalibration([...args, "--out", join(dir, "two.json")]);
    assert.equal(first, second);
    assert.equal(readFileSync(join(dir, "one.json"), "utf8"), readFileSync(join(dir, "two.json"), "utf8"));
    const json = JSON.parse(readFileSync(join(dir, "one.json"), "utf8"));
    assert.equal(json.seed, 5);
    assert.equal(json.trials_per_cell, 8);
    assert.deepEqual(json.grid, { n: [20, 22], sigma: [0.02, 0.03], alpha: [3], leader_max: 0.6 });
    assert.deepEqual(Object.keys(json.cutoffs), ["20", "21", "22"]);
    assert.deepEqual(json.analysis, fingerprint());
    assert.deepEqual(json, calibrate({ seed: 5, trials: 8, nMin: 20, nMax: 22, sigmas: [0.02, 0.03], alphas: [3] }));
    const other = JSON.parse(runCalibrationTo(dir, "three.json", [...args.slice(0, -1), "6"]));
    assert.notDeepEqual(other.cells, json.cells);
    assert.equal(DEFAULTS.trials, 2000);
    assert.deepEqual([DEFAULTS.nMin, DEFAULTS.nMax, DEFAULTS.seed], [20, 45, 20261001]);
    assert.deepEqual([DEFAULTS.sigmas, DEFAULTS.alphas], [[0.01, 0.02, 0.03], [1.5, 3, 8]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function runCalibrationTo(dir: string, name: string, args: string[]): string {
  runCalibration([...args, "--out", join(dir, name)]);
  return readFileSync(join(dir, name), "utf8");
}

test("calibration: low noise needs a small cutoff, the power mode is deterministic, a shift of 0.1 always fails and shift 0 never does", () => {
  const dir = scratch();
  try {
    const zero = JSON.parse(runCalibrationTo(dir, "zero.json", ["--n-min", "20", "--n-max", "20", "--trials", "10", "--sigmas", "0.01", "--alphas", "3"]));
    assert.equal(zero.worst_case_breach_tail["20"] <= 0.05, true);
    assert.equal(zero.cutoffs["20"] < 5, true);
    const args = ["--power", "--n", "20", "--trials", "10", "--sigmas", "0.01", "--alphas", "3", "--shifts", "0,0.1"];
    const a = runCalibrationTo(dir, "p1.json", args);
    const b = runCalibrationTo(dir, "p2.json", args);
    assert.equal(a, b);
    const power = JSON.parse(a);
    assert.equal(power.n, 20);
    assert.equal(power.cutoff_used, K3_CUTOFFS[20]);
    assert.deepEqual(power.rows.map((r: { shift: number; fail_given_conclusive: number }) => [r.shift, r.fail_given_conclusive]), [[0, 0], [0.1, 1]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("calibration --emit rewrites only the K3_CUTOFFS line and the result reads back through breachCutoff", async () => {
  const dir = scratch();
  try {
    const target = join(dir, "order-analysis.mjs");
    copyFileSync(join(repo, "scripts/order-analysis.mjs"), target);
    const table = Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String(20 + i), i]));
    writeFileSync(join(dir, "table.json"), JSON.stringify({ cutoffs: table }));
    const line = runCalibration(["--emit", "--in", join(dir, "table.json"), "--target", target]).trim();
    assert.equal(line, emitLine(table));
    const emitted = readFileSync(target, "utf8");
    assert.equal(emitted.split("\n").filter((l) => l.startsWith("export const K3_CUTOFFS")).length, 1);
    assert.deepEqual(fingerprint(target), fingerprint());
    const mod = await import(pathToFileURL(target).href);
    assert.equal(mod.breachCutoff(20), 0);
    assert.equal(mod.breachCutoff(45), 25);
    assert.equal(mod.breachCutoff(46), null);
    assert.equal(emit(join(dir, "table.json"), target), line);
    writeFileSync(join(dir, "none.mjs"), "export const x = 1;\n");
    assert.throws(() => emit(join(dir, "table.json"), join(dir, "none.mjs")), /exactly one K3_CUTOFFS line/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("simulated decisions keep the true leader below 0.6 and put the shift on both same-request answers", () => {
  const plain = simulateDecisions(seededRandom(11), 300, 0.01, 1.5);
  assert.equal(Math.max(...plain.map((d) => d.p_leader_all24)) < 0.62, true);
  assert.equal(Math.max(...plain.map((d) => d.exact.k3_written_max_delta)) < 0.08, true);
  assert.equal(Math.max(...plain.map((d) => d.exact.k3_reversed_max_delta)) < 0.08, true);
  const shifted = simulateDecisions(seededRandom(11), 50, 0.01, 1.5, 0.1);
  assert.equal(Math.min(...shifted.map((d) => d.exact.k3_written_max_delta)) > 0.05, true);
  assert.equal(Math.min(...shifted.map((d) => d.exact.k3_reversed_max_delta)) > 0.05, true);
  assert.deepEqual(simulateDecisions(seededRandom(11), 3, 0.02, 3), simulateDecisions(seededRandom(11), 3, 0.02, 3));
});

test("simulated re-ask noise matches the order-answer noise, and a large shift makes the leader condition fail in the cell histogram", () => {
  const ds = simulateDecisions(seededRandom(12), 300, 0.01, 3);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const ratio = mean(ds.map((d) => d.exact.reask_max_delta)) / mean(ds.map((d) => d.exact.k3_written_max_delta));
  assert.equal(ratio > 0.85 && ratio < 1.2, true);
  const base = { seed: 3, sigma: 0.01, alpha: 3, trials: 20, nMin: 30, nMax: 30 };
  const quiet = simulateCell(base).get(30)!;
  assert.equal(quiet.conclusive, 20);
  assert.equal(quiet.leaderFailHist.reduce((a, b) => a + b, 0), 0);
  const loud = simulateCell({ ...base, shift: 0.3 }).get(30)!;
  assert.equal(loud.hist[30], 20);
  assert.equal((loud.leaderFailHist[30] ?? 0) > 0, true);
  assert.equal(loud.leaderFailHist.reduce((a, b) => a + b, 0), loud.leaderFailHist[30]);
});
