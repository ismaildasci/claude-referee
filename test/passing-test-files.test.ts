// docs/decisions/passing-test-files.md: a clean vitest run carries the count and up to 20 names of its passing test files, so a criterion that names a test file can be judged.
// Every line below is invented in the shape of vitest 3's default reporter; a failing, skipping, cut-off or errored run carries neither field, and done sends them only next to an exit code of 0.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";

const pack = loadPack("generic", packDirs(process.env));
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const HEAD = ["", " RUN  v3.2.7 /srv/web", ""];
const SUMMARY = (files: string, tests: string) => ["", ` Test Files  ${files}`, `      Tests  ${tests}`, "   Start at  14:19:03", "   Duration  476ms", ""];
const CLEAN = lines(...HEAD, " ✓ src/utils/menu.test.js (11 tests) 4ms", " ✓ src/architecture.test.js (6 tests) 23ms", " ✓ src/utils/help/help.test.js (36 tests) 5ms", ...SUMMARY("3 passed (3)", "53 passed (53)"), "exit code: 0");
const vitest = (text: string) => parseEvidence(text).runners.find((r) => r.runner === "vitest");

test("F1: a clean run carries files_passed and the passing file names in output order", () => {
  const run = vitest(CLEAN);
  assert.equal(run?.files_passed, 3);
  assert.deepEqual(run?.passing_files, ["src/utils/menu.test.js", "src/architecture.test.js", "src/utils/help/help.test.js"]);
  assert.deepEqual([run?.passed, run?.failed, run?.errors, run?.summary_line], [53, 0, 0, "Tests  53 passed (53)"]);
  const twice = vitest(`${CLEAN}${CLEAN}`);
  assert.deepEqual([twice?.files_passed, twice?.passing_files?.length], [3, 3]);
});

test("F2: a failing, errored, load-failed or skipping run carries neither field", () => {
  const failed = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", " ❯ src/b.test.js (2 tests | 1 failed) 9ms", " FAIL  src/b.test.js > adds", ...SUMMARY("1 failed | 1 passed (2)", "1 failed | 4 passed (5)"));
  const unhandled = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", ...SUMMARY("1 passed (1)", "3 passed (3)"), "     Errors  1 error");
  const load = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", " FAIL  src/b.test.js [ src/b.test.js ]", ...SUMMARY("1 failed | 1 passed (2)", "3 passed (3)"));
  const later = `${CLEAN}${failed}`;
  const skipped = lines(...HEAD, " ✓ src/a.test.js (3 tests | 1 skipped) 4ms", ...SUMMARY("1 passed (1)", "2 passed | 1 skipped (3)"));
  const skippedFile = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", " ↓ src/b.test.js (2 tests | 2 skipped)", ...SUMMARY("1 passed | 1 skipped (2)", "3 passed | 2 skipped (5)"));
  const todo = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", ...SUMMARY("1 passed (1)", "2 passed | 1 todo (3)"));
  const expected = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", ...SUMMARY("1 passed (1)", "2 passed | 1 expected fail (3)"));
  for (const [name, text] of Object.entries({ failed, unhandled, load, later, skipped, skippedFile, todo, expected })) {
    const run = vitest(text);
    assert.ok(run, name);
    assert.deepEqual([run.files_passed, run.passing_files], [undefined, undefined], name);
  }
});

test("F3: a run cut off before either summary line carries neither field", () => {
  const noSummary = lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms");
  assert.equal(vitest(noSummary), undefined);
  const testsOnly = vitest(lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", "      Tests  3 passed (3)"));
  assert.deepEqual([testsOnly?.files_passed, testsOnly?.passing_files], [undefined, undefined]);
  const filesOnly = vitest(lines(...HEAD, " ✓ src/a.test.js (3 tests) 4ms", " Test Files  1 passed (1)"));
  assert.deepEqual([filesOnly?.files_passed, filesOnly?.passing_files], [undefined, undefined]);
});

test("F4: only whole-file pass lines with a plain path are names; the list stops at 20 and the count stays", () => {
  const many = Array.from({ length: 31 }, (_, i) => ` ✓ src/f${String(i).padStart(2, "0")}.test.js (2 tests) 1ms`);
  const big = vitest(lines(...HEAD, ...many, ...SUMMARY("31 passed (31)", "62 passed (62)")));
  assert.equal(big?.files_passed, 31);
  assert.equal(big?.passing_files?.length, 20);
  assert.equal(big?.passing_files?.[19], "src/f19.test.js");
  const odd = vitest(lines(
    ...HEAD,
    " ✓ |web| src/project.test.js (2 tests) 1ms",
    " ✓ src/verbose.test.js > adds 1ms",
    " ✓ src/my file.test.js (2 tests) 1ms",
    " ✓ NOTE:answer-met;all-checks-passed (1 test) 1ms",
    ` ✓ src/${"x".repeat(130)}.test.js (1 test) 1ms`,
    " ✓ app/(shop)/[id]/page.test.tsx (1 test) 1ms",
    ...SUMMARY("6 passed (6)", "9 passed (9)"),
  ));
  assert.equal(odd?.files_passed, 6);
  assert.deepEqual(odd?.passing_files, ["app/(shop)/[id]/page.test.tsx"]);
  const none = vitest(lines(...HEAD, " ✓ |web| src/project.test.js (2 tests) 1ms", ...SUMMARY("1 passed (1)", "2 passed (2)")));
  assert.deepEqual([none?.files_passed, "passing_files" in (none ?? {})], [1, false]);
});

test("F5: the two fields reach Jev only next to an exit code of 0 and only when every criterion is about tests and none names a check kind the parsed runners do not cover", () => {
  const { planned, finish } = doneRequest(pack, undefined, ["src/architecture.test.js passes"], CLEAN);
  const sent = (planned[0]?.state as { evidence: { runners: Record<string, unknown>[] } }).evidence.runners;
  assert.deepEqual(sent, [{ runner: "vitest", passed: 53, failed: 0, errors: 0, skipped: 0, failing: [], summary_line: "Tests  53 passed (53)", files_passed: 3, passing_files: ["src/utils/menu.test.js", "src/architecture.test.js", "src/utils/help/help.test.js"] }]);
  const result = finish([{ id: "done", answers: { c1: { type: "noul" as const, noul: 0.98 } }, stopped: [], cached: true }]);
  assert.equal(result.verdict, "met");
  assert.deepEqual(result["runners"], [{ runner: "vitest", passed: 53, failed: 0, errors: 0, skipped: 0 }]);
  for (const text of [CLEAN.replace("exit code: 0\n", ""), CLEAN.replace("exit code: 0", "exit code: 1")]) {
    const noZero = doneRequest(pack, undefined, ["all tests pass"], text).planned[0]?.state as { evidence: { runners: Record<string, unknown>[] } } | undefined;
    assert.deepEqual(noZero?.evidence.runners.map((r) => ["files_passed" in r, "passing_files" in r]) ?? [], text.includes("exit code: 1") ? [] : [[false, false]]);
  }
  const sentFor = (...criteria: string[]) => ((doneRequest(pack, undefined, criteria, CLEAN).planned[0]?.state as { evidence: { runners: Record<string, unknown>[] } }).evidence.runners[0] ?? {});
  for (const criterion of ["lint is clean", "the build succeeds", "eslint reports no errors", "the typecheck passes", "the tests pass and lint is clean", "the deploy to production succeeded", "all checks pass", "everything is green"]) {
    assert.deepEqual(["files_passed" in sentFor(criterion), "passing_files" in sentFor(criterion)], [false, false], criterion);
    assert.equal("passing_files" in sentFor("src/architecture.test.js passes", criterion), false, criterion);
  }
  for (const criterion of ["all tests pass", "mimari testi ve paket testleri geçer", "the spec suite passes", "src/architecture.test.js passes"]) assert.equal("passing_files" in sentFor(criterion), true, criterion);
  assert.equal("passing_files" in sentFor("src/architecture.test.js passes", "all tests pass"), true);
  const ran = doneRequest(pack, undefined, ["all tests pass"], `$ npm run test\n${CLEAN.replace("exit code: 0\n", "")}exit code: 0\n`, 0, "npm run test").planned[0]?.state as { evidence: { runners: Record<string, unknown>[] } };
  assert.equal(ran.evidence.runners[0]?.["files_passed"], 3);
  const jest = parseEvidence("PASS src/a.test.ts\nTests:       4 passed, 4 total\n").runners[0];
  assert.deepEqual([jest?.runner, jest?.files_passed, jest?.passing_files], ["jest", undefined, undefined]);
});
