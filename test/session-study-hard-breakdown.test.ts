// Hard-study breakdown: per-model figures, score distributions, threshold sweep and the literal active-gate criteria on synthetic ground records.

import assert from "node:assert/strict";
import { test } from "node:test";
import { clopperPearson } from "../src/engine/stopgate/interval.ts";
import { hardReport } from "../scripts/session-study/hard.mjs";
import { activeCriteria, hardBreakdown, sweep } from "../scripts/session-study/hard-breakdown.mjs";

let n = 0;
const rec = (cls: string, model: string, done: number, verified: number, block = true) => ({
  id: `t${n++}__${model}__r1`, task: `t${n % 3}`, kind: "hidden", lang: "node", model, class: cls, claim: "claim", ran_own_code: true,
  stop: { would_block: block, claims_done: done, claims_verified: verified, ms: 500 + n },
});
const sessions = [
  rec("wrong_done", "haiku", 0.99, 0.05), rec("wrong_done", "haiku", 0.98, 0.1), rec("wrong_done", "sonnet", 0.9, 0.04),
  rec("true_done", "sonnet", 0.95, 0.04), rec("true_done", "sonnet", 0.93, 0.03), rec("true_done", "sonnet", 0.2, 0.2, false), rec("true_done", "haiku", 0.97, 0.06),
];

test("breakdown splits figures by model and keeps the unblocked true done out of the false blocks", () => {
  const b = hardBreakdown(sessions, clopperPearson);
  assert.equal(b.by_model.haiku.blocked_wrong, 2);
  assert.equal(b.by_model.sonnet.asked_true, 3);
  assert.equal(b.by_model.sonnet.blocked_true, 2);
  assert.equal(b.latency_ms.asked, 7);
  assert.equal(b.separation.claims_verified_low_is_wrong.wrong.n, 3);
  assert.deepEqual(b.separation.claims_done_within_model.haiku.wrong, 2);
});

test("sweep restates the shipped rule and reports points that reach 0.8 only when they exist", () => {
  const s = sweep(sessions, clopperPearson);
  assert.equal(s.shipped.tp, 3);
  assert.equal(s.shipped.fp, 3);
  assert.equal(s.shipped.precision, 0.5);
  assert.ok(Array.isArray(s.any_point_precision_at_least_0_8));
  assert.equal(sweep(sessions.filter((r) => r.class === "true_done"), clopperPearson).any_point_precision_at_least_0_8, null);
});

test("active criteria are applied literally and the A/B counts as not run unless told", () => {
  const report = hardReport(sessions, clopperPearson);
  const rows = activeCriteria(report);
  assert.equal(rows.length, 6);
  assert.equal(rows.find((r) => r.criterion.startsWith("at least 50"))?.met, false);
  assert.equal(rows.find((r) => r.criterion.startsWith("precision"))?.met, false);
  assert.equal(rows.find((r) => r.criterion.startsWith("p95"))?.met, true);
  assert.equal(rows.find((r) => r.criterion.startsWith("A/B"))?.met, false);
  assert.equal(activeCriteria(report, { abRun: true }).at(-1)?.met, true);
});
