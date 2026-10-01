// decideStop: the pack's stop.gate thresholds at their edges, and how a project can move them (only toward fewer blocks).

import assert from "node:assert/strict";
import { test } from "node:test";
import { decideStop } from "../src/hooks/stop.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";

const pack = loadPack("generic", packDirs({}).filter((d) => d.source === "bundled"));

function answers(done: number, verified: number, applies: number, blocked: number): Record<string, unknown> {
  return {
    claims_done: { type: "noul", noul: done },
    claims_verified: { type: "noul", noul: verified },
    verification_applies: { type: "noul", noul: applies },
    outcome: { type: "choice", probabilities: { complete: 1 - blocked, blocked } },
  };
}

const blocks = (a: Record<string, unknown>, thresholds?: Parameters<typeof decideStop>[2]) => decideStop(a, pack, thresholds)?.would_block;

test("the pack's stop.gate thresholds are 0.7, 0.5, 0.5 and 0.4", () => {
  assert.deepEqual(pack.thresholds["stop.gate"], { claims_done: 0.7, claims_verified: 0.5, verification_applies: 0.5, blocked: 0.4 });
});

test("would_block needs every condition, each at its edge", () => {
  assert.equal(blocks(answers(0.7, 0.3, 0.5, 0.1)), true);
  assert.equal(blocks(answers(0.69, 0.3, 0.5, 0.1)), false);
  assert.equal(blocks(answers(0.9, 0.49, 0.9, 0.1)), true);
  assert.equal(blocks(answers(0.9, 0.5, 0.9, 0.1)), false);
  assert.equal(blocks(answers(0.9, 0.3, 0.5, 0.1)), true);
  assert.equal(blocks(answers(0.9, 0.3, 0.49, 0.1)), false);
  assert.equal(blocks(answers(0.9, 0.3, 0.9, 0.39)), true);
  assert.equal(blocks(answers(0.9, 0.3, 0.9, 0.4)), false);
});

test("a missing probability for blocked counts as 0, and malformed answers give no decision", () => {
  const noBlocked = answers(0.9, 0.3, 0.9, 0);
  (noBlocked["outcome"] as { probabilities: Record<string, number> }).probabilities = { complete: 1 };
  assert.equal(blocks(noBlocked), true);
  assert.equal(decideStop(null, pack, undefined), null);
  assert.equal(decideStop({ ...answers(0.9, 0.3, 0.9, 0.1), claims_done: { type: "choice" } }, pack, undefined), null);
  assert.equal(decideStop({ ...answers(0.9, 0.3, 0.9, 0.1), outcome: { type: "noul", noul: 0.5 } }, pack, undefined), null);
});

test("a project can make the gate fire less, never more", () => {
  const stricterDone = { "stop.gate": { claims_done: 0.9 } };
  assert.equal(blocks(answers(0.8, 0.3, 0.9, 0.1), stricterDone), false);
  assert.equal(blocks(answers(0.95, 0.3, 0.9, 0.1), stricterDone), true);
  const looserDone = { "stop.gate": { claims_done: 0.5 } };
  assert.equal(blocks(answers(0.6, 0.3, 0.9, 0.1), looserDone), false);
  const stricterApplies = { "stop.gate": { verification_applies: 0.8 } };
  assert.equal(blocks(answers(0.9, 0.3, 0.6, 0.1), stricterApplies), false);
});

test("claims_verified and blocked are 'below' conditions: only a lower value is stricter", () => {
  const higherVerified = { "stop.gate": { claims_verified: 0.8 } };
  assert.equal(blocks(answers(0.9, 0.6, 0.9, 0.1), higherVerified), false);
  const lowerVerified = { "stop.gate": { claims_verified: 0.2 } };
  assert.equal(blocks(answers(0.9, 0.3, 0.9, 0.1), lowerVerified), false);
  assert.equal(blocks(answers(0.9, 0.1, 0.9, 0.1), lowerVerified), true);
  const higherBlocked = { "stop.gate": { blocked: 0.9 } };
  assert.equal(blocks(answers(0.9, 0.3, 0.9, 0.6), higherBlocked), false);
  const lowerBlocked = { "stop.gate": { blocked: 0.1 } };
  assert.equal(blocks(answers(0.9, 0.3, 0.9, 0.2), lowerBlocked), false);
});
