// docs/decisions/pest-runner-label.md: the jest parser labels Pest and Collision output pest (an "(N assertions)" summary or a Pest failure mark); counts and names are unchanged.
// Invented lines in the shape of real Pest 5.3 output; a Jest summary keeps the jest label.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEvidence } from "../src/engine/runners/index.ts";

const lines = (...l: string[]) => `${l.join("\n")}\n`;
const runners = (log: string) => parseEvidence(log).runners.map(({ runner, passed, failed, skipped, failing }) => ({ runner, passed, failed, skipped, failing }));

test("P1: passing, risky and failing Pest logs read as pest with their counts", () => {
  assert.deepEqual(runners(lines("", "   PASS  Tests\\Feature\\CartTest", "  ✓ it adds two items  0.01s", "", "  Tests:    8 passed (77 assertions)", "  Duration: 0.39s", "", "exit code: 0")), [{ runner: "pest", passed: 8, failed: 0, skipped: 0, failing: [] }]);
  assert.deepEqual(runners(lines("  Tests:    1 risky, 1 incomplete, 1 passed (1 assertion)", "exit code: 0")), [{ runner: "pest", passed: 1, failed: 0, skipped: 2, failing: [] }]);
  const cut = runners(lines("", "   FAIL  Tests\\Feature\\CartTest", "  ✓ it adds two items", "  ⨯ it applies a coupon  0.02s", "exit code: 0"));
  assert.deepEqual(cut, [{ runner: "pest", passed: 0, failed: 1, skipped: 0, failing: ["it applies a coupon"] }]);
});

test("P1: a Jest summary stays jest", () => {
  assert.deepEqual(runners(lines("Test Suites: 2 passed, 2 total", "Tests:       5 passed, 5 total", "exit code: 0")), [{ runner: "jest", passed: 5, failed: 0, skipped: 0, failing: [] }]);
  assert.equal(runners(lines(" FAIL  src/cart.test.js", "  ● cart › applies a coupon", "Tests:       1 failed, 4 passed, 5 total", "exit code: 1"))[0]?.runner, "jest");
});
