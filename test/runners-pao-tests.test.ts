// docs/decisions/pao-test-json.md: Pest, PHPUnit and Paratest agent-format JSON (laravel/pao) read as test runner facts.
// Every object below is invented in pao 1.1.5's key order; no real path, name or message is committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";

const pack = loadPack("generic", packDirs(process.env));
const verdictOf = (evidence: string, criterion = "all tests pass", p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: p } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const runners = (evidence: string) => parseEvidence(evidence).runners;
const EXIT = "exit code: 0\n";

const PASS = '{"tool":"pest","result":"passed","tests":12,"passed":12,"assertions":30,"duration_ms":410}';
const FAIL = String.raw`{"tool":"pest","result":"failed","tests":5,"passed":3,"assertions":9,"duration_ms":220,"failed":2,"failures":[{"test":"Tests\\Feature\\CartTest::it applies a coupon","file":"tests/Feature/CartTest.php","line":14,"message":"Failed asserting that 9 is identical to 8."},{"test":"Tests\\Unit\\SlugTest::it strips punctuation","file":"tests/Unit/SlugTest.php","line":9,"message":"boom","trace":["tests/Unit/SlugTest.php:9"]}]}`;
const ERRORED = String.raw`{"tool":"phpunit","result":"failed","tests":3,"passed":2,"assertions":4,"duration_ms":90,"errors":1,"error_details":[{"test":"Tests\\Unit\\MailTest::testSend","file":"tests/Unit/MailTest.php","line":20,"message":"RuntimeException: smtp down"}]}`;
const SKIPS = '{"tool":"paratest","result":"passed","tests":6,"passed":5,"assertions":5,"duration_ms":80,"skipped":1,"incomplete":1,"risky":1}';
const WARNED = '{"tool":"pest","result":"passed","tests":4,"passed":4,"assertions":8,"duration_ms":50,"deprecations":1,"deprecation_details":[{"file":"app/Legacy.php","line":3,"message":"old call"}]}';
const NO_TESTS = '{"tool":"pest","result":"passed","tests":0,"passed":0,"assertions":0,"duration_ms":3,"raw":["No tests found."]}';
const EMPTY_FAILED = '{"tool":"pest","result":"failed","tests":0,"passed":0,"assertions":0,"duration_ms":2,"raw":["No tests found."]}';

test("Q1: passed, failed, errored and skipped objects give test runner facts with counts and failing names only", () => {
  assert.deepEqual(runners(PASS + "\n" + EXIT), [{ runner: "pest", passed: 12, failed: 0, errors: 0, skipped: 0, failing: [], summary_line: "pest passed 12 of 12 tests (agent JSON)" }]);
  const failed = runners(FAIL + "\n" + "exit code: 1\n")[0];
  assert.deepEqual([failed?.runner, failed?.passed, failed?.failed, failed?.errors, failed?.failing], ["pest", 3, 2, 0, ["Tests\\Feature\\CartTest::it applies a coupon", "Tests\\Unit\\SlugTest::it strips punctuation"]]);
  assert.ok(!JSON.stringify(failed).includes("identical") && !JSON.stringify(failed).includes(".php"));
  const errored = runners(ERRORED + "\n" + "exit code: 2\n")[0];
  assert.deepEqual([errored?.runner, errored?.passed, errored?.failed, errored?.errors, errored?.failing], ["phpunit", 2, 0, 1, ["Tests\\Unit\\MailTest::testSend"]]);
  const skips = runners(SKIPS + "\n" + EXIT)[0];
  assert.deepEqual([skips?.runner, skips?.passed, skips?.skipped], ["paratest", 3, 3]);
  assert.deepEqual(runners(WARNED + "\n" + EXIT)[0]?.passed, 4);
  assert.equal(runners(PASS + "\n" + EXIT)[0]?.build_only, undefined);
});

test("Q1: done reads them: a pass is met, failures, skips and no tests are not", () => {
  assert.deepEqual(verdictOf(PASS + "\n" + EXIT), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(PASS + "\n" + EXIT, "the Pest suite passes"), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(FAIL + "\nexit code: 1\n").verdict, "missing");
  assert.notEqual(verdictOf(FAIL + "\n" + EXIT).verdict, "met");
  assert.deepEqual(verdictOf(SKIPS + "\n" + EXIT), { verdict: "unsure", reason: "skipped_tests" });
  assert.notEqual(verdictOf(NO_TESTS + "\n" + EXIT).verdict, "met");
  assert.deepEqual(runners(EMPTY_FAILED + "\n" + EXIT)[0]?.errors, 1);
  assert.notEqual(verdictOf(EMPTY_FAILED + "\n" + EXIT).verdict, "met");
});

test("Q1: positions: glued after other summaries and after a grep prefix are read, text before the object is not", () => {
  const glued = runners('{"tool":"pint","result":"passed"}{"tool":"rector","result":"passed","totals":{"changed_files":0,"errors":0},"changed_files":[]}' + PASS + "\n" + EXIT);
  assert.deepEqual(glued.map((r) => r.runner).sort(), ["pest", "pint", "rector"]);
  assert.equal(runners("12:" + PASS + "\n" + EXIT)[0]?.runner, "pest");
  assert.deepEqual(runners("Result: " + PASS + "\n" + EXIT), []);
});

test("Q1: a clipped failing object stays failing and is incomplete; a second object adds its failures", () => {
  const clipped = runners(FAIL.slice(0, 160) + "\n" + EXIT)[0];
  assert.equal(clipped?.runner, "pest");
  assert.ok((clipped?.failed ?? 0) + (clipped?.errors ?? 0) >= 1);
  assert.equal(clipped?.incomplete, true);
  assert.notEqual(verdictOf(FAIL.slice(0, 160) + "\n" + EXIT).verdict, "met");
  const two = runners(FAIL + "\n" + PASS + "\n" + EXIT)[0];
  assert.deepEqual([two?.passed, two?.failed, two?.failing.length], [12, 2, 2]);
});
