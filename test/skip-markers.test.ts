// Skip markers beyond the parsed summary: shapes from two real dev logs rebuilt as synthetic fixtures, plus negatives that must not cap.
// Real log text is never committed; every line below is invented to mirror the shape.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { skipMarkers } from "../src/engine/runners/skips.ts";

const pack = loadPack("generic", packDirs(process.env));
const verdictOf = (evidence: string, criterion = "all tests pass") => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: 0.98 } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};

const NODE_TAIL = "1..2\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\nexit code: 0\n";
const NESTED = "# Subtest: a.js\nok 1 - a.js\n# symlink tests\n#   ok write works\n#   ~ delete is refused for another owner (skipped: needs privileges)\n# 2 passed, 0 failed, 1 skipped\n# Subtest: b.js\nok 2 - b.js\n";
const WORKSPACE = "Test Files  3 passed | 1 skipped (4)\n     Tests  40 passed | 5 skipped (45)\n\nTest Files  6 passed (6)\n     Tests  105 passed (105)\nexit code: 0\n";

test("node:test summary says 0 skipped but a nested script prints skips: capped", () => {
  const text = NESTED + NODE_TAIL;
  assert.equal(parseEvidence(text).runners[0]?.skipped, 0);
  assert.deepEqual(verdictOf(text), { verdict: "unsure", reason: "skipped_tests" });
});

test("vitest workspace: an earlier summary with skips, last summary clean: capped", () => {
  assert.equal(parseEvidence(WORKSPACE).runners[0]?.skipped, 0);
  assert.deepEqual(verdictOf(WORKSPACE), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf("Test Files  6 passed (6)\n     Tests  105 passed (105)\nexit code: 0\n"), { verdict: "met", reason: undefined });
});

test("markers by shape", () => {
  const hits = [
    "ok 3 - flaky thing # SKIP no network",
    "not ok 4 - later # TODO",
    "﹣ name (0.4ms) # SKIP",
    "✓ file.test.ts (49 tests | 1 skipped) 740ms",
    "tests/test_a.py::test_x SKIPPED (needs gpu) [ 50%]",
    "--- SKIP: TestThing (0.00s)",
    "test_a (mod.T.test_a) ... skipped 'no db'",
    "OK (skipped=2)",
    "  2 pending",
    "7699 examples, 0 failures, 2 pending",
    "Tests run: 5, Failures: 0, Errors: 0, Skipped: 2",
    "Skipped!  - Failed: 0, Passed: 5, Skipped: 2, Total: 7, Duration: 1 s",
    "test result: ok. 14 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 0.10s",
    "=== 2 passed, 3 skipped, 1 xfailed in 7.86s ===",
    "○ skipped needs a network",
    "  (PENDING: not yet written)",
    "1 skipped, 3 passed, 4 total",
  ];
  for (const line of hits) assert.equal(skipMarkers(line).length, 1, line);
});

test("test names, prose, zero counts and echoed commands never count", () => {
  const clean = [
    "✓ skips nothing when the list is empty 3ms",
    "ok 2 - skips nothing",
    "#   ✓ reports 2 skipped files in the summary",
    "✓ handles pending writes (4ms)",
    "# skipped 0",
    "# todo 0",
    "0 skipped, 12 passed",
    "Tests: 12 passed, 12 total, 0 skipped",
    "OK (skipped=0)",
    "test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out",
    "We skipped the slow path because it is slow.",
    "Skipping cache restore, no key found",
    "$ vitest run --skip-snapshot",
    "> jest --testPathIgnorePatterns skipped",
    "> Task :app:lint SKIPPED",
    "xfail and todo markers are described in the docs",
  ];
  for (const line of clean) assert.deepEqual(skipMarkers(line), [], line);
  assert.deepEqual(verdictOf(`✓ skips nothing 3ms\n# skipped 0\n# todo 0\n  0 pending\nTests  12 passed (12)\nexit code: 0\n`), { verdict: "met", reason: undefined });
});

test("a passing log that prints 0 skipped stays met", () => {
  assert.deepEqual(verdictOf("# tests 4\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\nexit code: 0\n"), { verdict: "met", reason: undefined });
});

test("a skip marker also caps an exit-code-only log", () => {
  assert.deepEqual(verdictOf("ok 1 - a\nok 2 - b # SKIP\nexit code: 0\n"), { verdict: "unsure", reason: "skipped_tests" });
});
