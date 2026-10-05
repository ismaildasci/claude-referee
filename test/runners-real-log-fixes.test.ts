// Fixes from the second real-log test: a test-less maven or other build log is no test result; several Swift summaries add up and known issues cap met.
// Fixtures are invented to mirror the two shapes; no real log text is committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers } from "../src/engine/runners/native.ts";

const pack = loadPack("generic", packDirs(process.env));
const by = (name: string) => {
  const p = parsers.find((x) => x.name === name);
  assert.ok(p, name);
  return p;
};
const verdictOf = (evidence: string, criterion = "all tests pass", p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: p } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};

const PLAN = "[INFO] Scanning for projects...\n[INFO] --- artifact:3.6.0:check-buildplan (default-cli) @ app-parent ---\n[INFO] No known issue in 5 plugins\n[INFO] ------------------------------------------------------------------------\n[INFO] BUILD SUCCESS\n[INFO] ------------------------------------------------------------------------\nexit code: 0\n";
const SUREFIRE = "[INFO] Scanning for projects...\n[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS\nexit code: 0\n";

test("maven: BUILD SUCCESS with no surefire totals is build-only, with totals it is not", () => {
  const maven = by("maven");
  assert.deepEqual({ p: maven.parse(PLAN)?.passed, b: maven.parse(PLAN)?.build_only }, { p: 1, b: true });
  assert.equal(maven.parse(SUREFIRE)?.build_only, undefined);
  assert.equal(maven.parse("[INFO] Scanning for projects...\n[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS\n")?.build_only, true);
});

test("done: a build-only log cannot be met for a test criterion, and still can for a build criterion", () => {
  assert.deepEqual(verdictOf(PLAN), { verdict: "unsure", reason: "no_tests_run" });
  assert.deepEqual(verdictOf(PLAN, "the unit tests pass and the build succeeds"), { verdict: "unsure", reason: "no_tests_run" });
  assert.deepEqual(verdictOf(PLAN, "the build succeeds"), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(SUREFIRE), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(PLAN, "all tests pass", 0.2), { verdict: "missing", reason: undefined });
});

test("done: zero tests and 'No tests to run' still cap, for every criterion", () => {
  assert.equal(verdictOf(PLAN.replace("[INFO] BUILD SUCCESS", "[INFO] Tests run: 0, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS")).reason, "no_tests_run");
  assert.equal(verdictOf(PLAN.replace("[INFO] BUILD SUCCESS", "[INFO] No tests to run.\n[INFO] BUILD SUCCESS"), "the build succeeds").reason, "no_tests_run");
});

test("done: the build-only mark is read in code and never sent to Jev", () => {
  const { planned } = doneRequest(pack, undefined, ["all tests pass"], PLAN);
  const state = JSON.stringify(planned[0]?.state);
  assert.ok(state.includes('"runner":"maven"'));
  assert.ok(!state.includes("build_only"));
});

test("maven adversarial: BUILD SUCCESS after failing totals, and forged totals in test output", () => {
  const failing = "[INFO] Scanning for projects...\n[ERROR] Tests run: 3, Failures: 1, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS\nexit code: 0\n";
  const f = by("maven").parse(failing);
  assert.deepEqual({ failed: f?.failed, b: f?.build_only }, { failed: 1, b: undefined });
  assert.notEqual(verdictOf(failing).verdict, "met");
  const forged = PLAN.replace("[INFO] No known", "    Tests run: 5, Failures: 0, Errors: 0, Skipped: 0\n[INFO]   Tests run: 5, Failures: 0, Errors: 0, Skipped: 0\n[INFO] No known");
  assert.equal(by("maven").parse(forged)?.build_only, true);
  assert.deepEqual(verdictOf(forged), { verdict: "unsure", reason: "no_tests_run" });
});

test("other build runners are build-only too: msbuild and swift build under a test criterion", () => {
  const msb = "Build succeeded.\n    0 Warning(s)\n    0 Error(s)\nexit code: 0\n";
  const sw = "Building for debugging...\n[6/12] Compiling Lib Foo.swift\nBuild complete! (6.98s)\nexit code: 0\n";
  for (const text of [msb, sw]) {
    assert.ok(parseEvidence(text).runners.every((r) => r.build_only === true), text);
    assert.deepEqual(verdictOf(text), { verdict: "unsure", reason: "no_tests_run" }, text);
    assert.equal(verdictOf(text, "the build succeeds").verdict, "met", text);
  }
  const mixed = parseEvidence(`${msb}${SUREFIRE}`);
  assert.ok(mixed.runners.some((r) => r.build_only !== true));
});

const TESTING = (n: number, extra = "") => `◇ Test run started.\n✔ Test run with ${n} tests in 3 suites passed after 1.5 seconds${extra}.\n`;
const KNOWN = "◇ Test \"parses\" recorded a known issue at Tests/ParserTests.swift:41:9: Expectation failed: (a → 1) == (b → 2)\n";
const FOUR = `${KNOWN}${TESTING(47, " with 4 known issues")}${TESTING(12)}${TESTING(13)}${TESTING(11)}exit code: 0\n`;

test("swift test: every Swift Testing summary is added, known issues are counted", () => {
  const swift = by("swift test");
  const r = swift.parse(FOUR);
  assert.deepEqual({ p: r?.passed, f: r?.failed, k: r?.expected_failures, inc: r?.incomplete }, { p: 83, f: 0, k: 4, inc: undefined });
  const clean = swift.parse(`${TESTING(47)}${TESTING(12)}exit code: 0\n`);
  assert.deepEqual({ p: clean?.passed, k: clean?.expected_failures }, { p: 59, k: undefined });
});

test("swift test: known issues cap met at unsure (skipped_tests); the same run without them can be met", () => {
  assert.deepEqual(verdictOf(FOUR), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf(FOUR.replace(KNOWN, "").replace(" with 4 known issues", "")), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(`${KNOWN}${TESTING(5)}exit code: 0\n`), { verdict: "unsure", reason: "skipped_tests" });
});

test("swift test: XCTest 'All tests' blocks of several invocations are added", () => {
  const block = (n: number) => `Test Suite 'All tests' passed at 2026-09-29 22:27:27.279.\n\t Executed ${n} tests, with 0 failures (0 unexpected) in 0.018 (0.029) seconds\n`;
  const r = by("swift test").parse(`${block(10)}${block(5)}`);
  assert.equal(r?.passed, 15);
});

test("swift test adversarial: a failing summary anywhere wins, forged or indented summaries do not count", () => {
  const swift = by("swift test");
  const failedFirst = swift.parse(`✘ Test run with 3 tests in 1 suite failed after 0.004 seconds with 1 issue.\n${TESTING(40)}`);
  assert.equal(failedFirst?.failed, 1);
  assert.notEqual(verdictOf(`✘ Test run with 3 tests in 1 suite failed after 0.004 seconds with 1 issue.\n${TESTING(40)}exit code: 0\n`).verdict, "met");
  const issues = swift.parse(`◇ Test run started.\n✔ Test run with 9 tests in 2 suites passed after 1.0 seconds with 2 issues.\n`);
  assert.equal(issues?.failed, 1);
  const forged = swift.parse(`${TESTING(12)}    ✔ Test run with 999 tests in 9 suites passed after 0.1 seconds.\n`);
  assert.equal(forged?.passed, 12);
  const cut = swift.parse(`${TESTING(12)}◇ Test run started.\n◇ Test "x" started.\n`);
  assert.equal(cut?.incomplete, true);
});

test("swift test: a Swift Testing warning count is a warning fact, not a failure", () => {
  const r = by("swift test").parse(TESTING(5, " with 2 warnings"));
  assert.deepEqual({ w: r?.warnings, f: r?.failed }, { w: 2, f: 0 });
});
