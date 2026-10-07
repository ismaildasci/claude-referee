// Re-review of the 2026-10-07 follow-up, reproduced with real node 26.9, jest 30, vitest 5, bun 1.4, turbo, nx, npm 11 and gh output: node:test detail ownership and
// logged assertion errors in passing runs, CI cancel annotations, monorepo wrapper exit reports, bun prefixes, snapshots and empty filters. Fixtures are invented lines of the same shape.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers as js } from "../src/engine/runners/js.ts";
import { analyzeTranscript } from "../src/engine/stopgate/transcript.ts";

const pack = loadPack("generic", packDirs(process.env));
const verdictOf = (evidence: string, criterion = "all tests pass", p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: p } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const node = (text: string) => {
  const p = js.find((x) => x.name === "node:test");
  assert.ok(p);
  return p.parse(text);
};
const runnersOf = (text: string) => parseEvidence(text).runners.map((r) => [r.runner, r.passed, r.failed, r.errors, r.skipped, r.incomplete === true]);
const stopStatus = (log: string): string | undefined => {
  const entry = (role: string, content: unknown) => JSON.stringify({ type: role, isSidechain: false, message: { role, content } });
  const call = (id: string, name: string, input: Record<string, unknown>, result: string) => [entry("assistant", [{ type: "tool_use", id, name, input }]), entry("user", [{ type: "tool_result", tool_use_id: id, content: result }])];
  const transcript = [entry("user", "fix the handler"), ...call("toolu_1", "Edit", { file_path: "/a.ts", old_string: "a", new_string: "b" }, "ok"), ...call("toolu_2", "Bash", { command: "npm test" }, log), entry("assistant", [{ type: "text", text: "Fixed; all tests pass." }])];
  return analyzeTranscript(`${transcript.join("\n")}\n`).checks.at(-1)?.status;
};

const WARN_TAIL = lines(
  "  Error: lint reported warnings:",
  "  ⚠ no-unused-vars: 'x' is defined but never used",
  "  ⚠ prefer-const: 'y' is never reassigned",
  "      at TestContext.<anonymous> (file:///srv/work/demo/test/lint.test.mjs:3:141)",
  "      at Test.runInAsyncScope (node:async_hooks:226:14)",
  "      at Test.run (node:internal/test_runner/test:1402:25)",
  "      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7)",
);

test("node:test: a '⚠' line inside an error message does not own the frames after it; only a todo entry with a duration does", () => {
  assert.deepEqual({ f: node(WARN_TAIL)?.failed, i: node(WARN_TAIL)?.incomplete }, { f: 1, i: true });
  assert.deepEqual(verdictOf(`${WARN_TAIL}exit code: 0\n`), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(WARN_TAIL, "all tests pass", 0.2), { verdict: "missing", reason: undefined });
  const todo = lines("⚠ parses quoted fields (0.7ms) # not supported yet", "  AssertionError [ERR_ASSERTION]: x", "      at TestContext.<anonymous> (file:///srv/work/demo/test/csv.test.mjs:6:40)", "      at Test.run (node:internal/test_runner/test:1402:25)");
  assert.deepEqual({ f: node(todo)?.failed, s: node(todo)?.skipped }, { f: 0, s: 1 });
});

const ASSERT_PROPS = (indent: string) => [`${indent}generatedMessage: true,`, `${indent}code: 'ERR_ASSERTION',`, `${indent}actual: 2,`, `${indent}expected: 1,`, `${indent}operator: 'strictEqual',`, `${indent}diff: 'simple'`];
const JEST_LOGGED = lines(
  "  console.log",
  "    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:",
  "    ",
  "    2 !== 1",
  "    ",
  "        at check (/srv/work/demo/src/check.js:2:28)",
  "        at Object.<anonymous> (/srv/work/demo/test/check.test.js:4:39) {",
  ...ASSERT_PROPS("      "),
  "    }",
  "",
  "      at log (test/check.test.js:2:90)",
  "",
  "Test Suites: 1 passed, 1 total",
  "Tests:       3 passed, 3 total",
  "Snapshots:   0 total",
  "Time:        0.293 s",
  "Ran all test suites.",
);
const VITEST_LOGGED = lines(
  "stdout | test/check.test.js > check rejects 2",
  "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:",
  "",
  "    at check (/srv/work/demo/src/check.js:2:28) {",
  ...ASSERT_PROPS("  "),
  "}",
  "",
  " ✓ test/check.test.js > check rejects 2 1ms",
  " ✓ test/check.test.js > check accepts 1 0ms",
  " ✓ test/check.test.js > handler 400 0ms",
  "",
  " Test Files  1 passed (1)",
  "      Tests  3 passed (3)",
);
const BUN_LOGGED = lines(
  "bun test v1.4.0 (34cbb9a4)",
  "",
  "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:",
  "",
  "    at check (/srv/work/demo/src/check.ts:2:28) {",
  ...ASSERT_PROPS("  "),
  "}",
  "",
  " 4 pass",
  " 0 fail",
  " 4 expect() calls",
  "Ran 4 tests across 1 file. [18.00ms]",
);

test("done and the Stop gate: a passing jest, vitest or bun run that logs a caught AssertionError stays a pass", () => {
  for (const log of [JEST_LOGGED, VITEST_LOGGED, BUN_LOGGED]) {
    assert.equal(node(log), null, log);
    assert.deepEqual(verdictOf(`${log}exit code: 0\n`), { verdict: "met", reason: undefined }, log);
    assert.equal(stopStatus(log), log === BUN_LOGGED ? "unknown" : "passed", log);
    assert.equal(stopStatus(`${log}exit code: 0\n`), "passed", log);
  }
  for (const tail of [lines(...ASSERT_PROPS("    "), "  }"), lines("    operator: 'strictEqual',", "    diff: 'simple'", "  }")]) {
    assert.deepEqual({ f: node(tail)?.failed, i: node(tail)?.incomplete }, { f: 1, i: true }, tail);
    assert.equal(stopStatus(`${tail}exit code: 0\n`), "failed", tail);
  }
  const strong = lines("      at TestContext.<anonymous> (file:///srv/work/demo/test/a.test.mjs:3:30)", "      at Test.run (node:internal/test_runner/test:1402:25)", "Ran 4 tests across 1 file. [18.00ms]");
  assert.equal(node(strong)?.failed, 1);
});

const ghView = (...l: string[]) => l.map((x) => `test (24, ubuntu-latest)\tUNKNOWN STEP\t2026-08-19T16:13:59.1503017Z ${x}`);
const CANCELLED = lines(
  ...ghView(
    "##[group]Run npm run test:websocket",
    "✔ closes on a 1006 frame (12.4ms)",
    "ℹ tests 137",
    "ℹ suites 12",
    "ℹ pass 137",
    "ℹ fail 0",
    "ℹ cancelled 0",
    "ℹ skipped 0",
    "ℹ todo 0",
    "ℹ duration_ms 5210.3",
    "##[group]Run npm run test:wpt",
    "> demo@1.0.0 test:wpt",
    "##[error]The job has exceeded the maximum execution time of 20m0s",
    "##[error]The operation was canceled.",
  ),
);

test("CI logs: a cancel or timeout annotation marks the parsed runners incomplete, so earlier steps' pass summaries are not met", () => {
  assert.deepEqual(runnersOf(CANCELLED), [["node:test", 137, 0, 0, 0, true]]);
  for (const criterion of ["all tests pass", "CI passes"]) {
    assert.deepEqual(verdictOf(CANCELLED, criterion), { verdict: "unsure", reason: "incomplete_run" }, criterion);
    assert.deepEqual(verdictOf(CANCELLED, criterion, 0.2), { verdict: "missing", reason: undefined }, criterion);
  }
  const shutdown = CANCELLED.replace(/^.*##\[error\]The job has exceeded.*\n/m, "").replace("The operation was canceled.", "The runner has received a shutdown signal. This can happen when the runner service is stopped.");
  assert.deepEqual(verdictOf(shutdown, "CI passes"), { verdict: "unsure", reason: "incomplete_run" });
  const raw = CANCELLED.replaceAll("test (24, ubuntu-latest)\tUNKNOWN STEP\t", "");
  assert.deepEqual(verdictOf(raw, "CI passes"), { verdict: "unsure", reason: "incomplete_run" });
  const finished = CANCELLED.replace(/.*##\[error\].*\n/g, "");
  assert.deepEqual(verdictOf(finished, "CI passes"), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(lines("ℹ tests 2", "ℹ pass 2", "ℹ fail 0", "the operation was canceled."), "CI passes"), { verdict: "met", reason: undefined });
});

const NODE_ENOENT = ["  Error: ENOENT: no such file or directory, open 'missing-config.json'", "      at readFileSync (node:fs:620:20)", "    errno: -2,", "    code: 'ENOENT',", "    syscall: 'open',", "    path: 'missing-config.json'", "  }"];
const TURBO = lines(
  ...NODE_ENOENT.map((l) => `api:test: ${l}`),
  "api:test: npm error Lifecycle script `test` failed with error:",
  "api:test: npm error code 1",
  "api:test: npm error path /srv/work/demo/packages/api",
  "api:test: npm error command failed",
  "api:test: npm error command sh -c node --test",
  "api#test:  ERROR  command (/srv/work/demo/packages/api) /usr/local/bin/npm run test exited (1)",
  "",
  " Tasks:    1 successful, 2 total",
  "Cached:    0 cached, 2 total",
  "  Time:    574ms ",
  "Failed:    api#test",
  "",
  " ERROR  run failed: command  exited (1)",
);
const NX = lines(
  ...NODE_ENOENT,
  "npm error Lifecycle script `test` failed with error:",
  "npm error code 1",
  "npm error command sh -c node --test",
  "",
  " NX   Running targets typecheck, test for 2 projects failed",
  "",
  "Failed tasks:",
  "",
  "- api:test",
  "",
  "  Run duration:      785ms",
);
const BUN_FILTER = lines(
  "@acme/api test: Ran 13 tests across 1 file. [4.00ms]",
  "@acme/web test: error: expect(received).toBe(expected)",
  "@acme/web test:       at <anonymous> (/srv/work/demo/packages/web/a.test.ts:3:36)",
  "@acme/web test: (fail) adds [0.32ms]",
  "@acme/web test: ",
  "@acme/web test:  12 pass",
  "@acme/web test:  1 fail",
  "@acme/web test:  13 expect() calls",
  "@acme/web test: Ran 13 tests across 1 file. [4.00ms]",
  "@acme/api test: Exited with code 0",
  "@acme/web test: Exited with code 1",
);
const BUN_RUN = lines(" 13 expect() calls", "Ran 13 tests across 1 file. [5.00ms]", 'error: script "test" exited with code 1');
const CONCURRENTLY = lines("[web] src/a.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'.", "[web] cd packages/web && tsc -p . exited with code 1", "[api] cd packages/api && vitest run exited with code 0");
const NPM_WS = lines(...NODE_ENOENT, "npm error Lifecycle script `test` failed with error:", "npm error code 1", "npm error workspace api", "npm error command sh -c node --test", "", "> test", "> node --test", "", "✔ case 0 (0.4ms)", "ℹ tests 1", "ℹ pass 1", "ℹ fail 0");

test("monorepo wrappers: turbo, nx, bun --filter, bun run, concurrently and npm report a failed task with a non-zero code, so a tail's exit code 0 is missing", () => {
  const cases: [string, number, string][] = [
    [TURBO, 1, "api:test: npm error code 1"],
    [NX, 1, "npm error code 1"],
    [BUN_FILTER, 1, "@acme/web test: Exited with code 1"],
    [BUN_RUN, 1, 'error: script "test" exited with code 1'],
    [CONCURRENTLY, 1, "[web] cd packages/web && tsc -p . exited with code 1"],
    [NPM_WS, 1, "npm error code 1"],
  ];
  for (const [log, code, first] of cases) {
    const piped = `${log}exit code: 0\n`;
    assert.deepEqual({ exit: parseEvidence(piped).exit_code, first: parseEvidence(piped).exit_lines[0] }, { exit: code, first }, log);
    assert.deepEqual({ exit: parseEvidence(log).exit_code, trust: parseEvidence(log).trust === "unparsed" }, { exit: code, trust: false }, log);
    assert.deepEqual(verdictOf(piped), { verdict: "missing", reason: "exit_code_nonzero" }, log);
    assert.equal(stopStatus(piped), "failed", log);
  }
  assert.deepEqual(parseEvidence(lines(" NX   Running target test for 2 projects failed", "exit code: 0")).exit_code, 1);
  assert.deepEqual(runnersOf(BUN_FILTER), [["bun test", 12, 1, 0, 0, false]]);
  assert.deepEqual(parseEvidence(BUN_FILTER.replace(/^.*Exited with code.*\n/gm, "")).runners[0]?.failing, ["adds"]);
});

test("monorepo wrappers: a zero code adds no exit line, a log's own non-zero exit lines stay as they were, and prose or titles are not wrapper reports", () => {
  const clean = lines("[api] cd packages/api && vitest run exited with code 0", "@acme/api test: Exited with code 0", " NX   Successfully ran target test for 2 projects", " Tasks:    2 successful, 2 total");
  assert.deepEqual({ trust: parseEvidence(clean).trust, exit: parseEvidence(clean).exit_code }, { trust: "unparsed", exit: null });
  assert.deepEqual(verdictOf(`${clean}exit code: 0\n`), { verdict: "met", reason: undefined });
  const compose = lines("tests-1  | ========================= 1 failed, 30 passed in 6.12s =========================", "tests-1 exited with code 1", "compose exit code: 1");
  assert.deepEqual({ exit: parseEvidence(compose).exit_code, lines: parseEvidence(compose).exit_lines }, { exit: 1, lines: ["compose exit code: 1"] });
  const npm = lines("npm error code ECONNRESET", "npm error network aborted", "added 387 packages in 14s", "exit code: 0");
  assert.deepEqual(parseEvidence(npm).exit_code, 0);
  const prose = lines("✔ restarts when the worker exited with code 1 (0.4ms)", "worker 4021 exited with code 1, restarting", "ℹ tests 1", "ℹ pass 1", "ℹ fail 0", "exit code: 0");
  assert.deepEqual(verdictOf(prose), { verdict: "met", reason: undefined });
});

test("bun test: a failed snapshot is a failure, a regex that matches no test is an error, and added or passed snapshots are neither", () => {
  for (const snap of ["snapshots: 1 failed", "snapshots: 2 passed, 1 added, 1 failed"]) {
    const tail = lines(snap, " 13 expect() calls", "Ran 13 tests across 1 file. [4.00ms]");
    assert.deepEqual(runnersOf(tail), [["bun test", 0, 1, 0, 0, false]], snap);
    assert.deepEqual(verdictOf(`${tail}exit code: 0\n`), { verdict: "unsure", reason: undefined }, snap);
  }
  for (const snap of ["snapshots: +3 added", " 5 snapshots, 5 expect() calls", "snapshots: 2 passed, 1 added"]) assert.deepEqual(runnersOf(lines(" 3 pass", " 0 fail", snap, "Ran 3 tests across 1 file. [8.00ms]")), [], snap);
  const empty = lines("bun test v1.4.0 (34cbb9a4)", "", 'error: regex "nonexistent" matched 0 tests. Searched 1 file (skipping 1 test) [4.00ms]');
  assert.deepEqual(runnersOf(empty), [["bun test", 0, 0, 1, 0, true]]);
  assert.deepEqual(verdictOf(`${empty}exit code: 0\n`), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(empty, "all tests pass", 0.2), { verdict: "missing", reason: undefined });
  assert.equal(stopStatus(`${empty}exit code: 0\n`), "failed");
  const pnpm = lines("packages/web test: (fail) cli > throws [0.06ms]", "packages/web test:  2 pass", "packages/web test:  2 fail", "packages/web test: Ran 4 tests across 1 file. [3.00ms]");
  assert.deepEqual(runnersOf(pnpm), [["bun test", 2, 2, 0, 0, false]]);
  assert.deepEqual(parseEvidence(lines("(fail) parser: handles a quoted field [1.2ms]")).runners[0]?.failing, ["parser: handles a quoted field"]);
});

const TAP_SUMMARY = (pass: number, fail: number, todo = 0) => lines(`# tests ${pass + fail + todo}`, "# suites 1", `# pass ${pass}`, `# fail ${fail}`, "# cancelled 0", "# skipped 0", `# todo ${todo}`, "# duration_ms 133.4");
const TAP_HOOK = lines(
  "not ok 1 - db",
  "  ---",
  "  duration_ms: 1.776709",
  "  type: 'suite'",
  "  location: '/srv/work/demo/test/db.test.mjs:2:1'",
  "  failureType: 'hookFailed'",
  "  error: 'teardown failed'",
  "  code: 'ERR_TEST_FAILURE'",
  "  stack: |-",
  "    SuiteContext.<anonymous> (file:///srv/work/demo/test/db.test.mjs:2:44)",
  "    TestHook.run (node:internal/test_runner/test:1757:18)",
  "    Suite.runHook (node:internal/test_runner/test:1289:20)",
  "    Suite.run (node:internal/test_runner/test:1906:13)",
  "  ...",
  "1..1",
);

test("node:test TAP: a describe-level after() hook failure under a '# fail 0' summary is a failure", () => {
  const window = TAP_HOOK.split("\n").slice(5).join("\n") + TAP_SUMMARY(5, 0);
  assert.deepEqual(runnersOf(window), [["node:test", 5, 1, 0, 0, false]]);
  assert.deepEqual(verdictOf(`${window}exit code: 0\n`), { verdict: "unsure", reason: undefined });
  assert.deepEqual(runnersOf(TAP_HOOK + TAP_SUMMARY(5, 0)), [["node:test", 5, 1, 0, 0, false]]);
  const frames = TAP_HOOK.split("\n").slice(11).join("\n") + TAP_SUMMARY(5, 0);
  assert.equal(node(frames)?.failed, 1);
  const todo = lines("not ok 13 - parses quoted fields # TODO not supported yet", "  ---", "  failureType: 'testCodeFailure'", "  code: 'ERR_ASSERTION'", "  stack: |-", "    TestContext.<anonymous> (file:///srv/work/demo/test/csv.test.mjs:3:90)", "    Test.run (node:internal/test_runner/test:1402:25)", "  ...", "1..13") + TAP_SUMMARY(12, 0, 1);
  for (const log of [todo, todo.split("\n").slice(1).join("\n")]) {
    assert.deepEqual({ f: node(log)?.failed, s: node(log)?.skipped }, { f: 0, s: 1 }, log);
    assert.deepEqual(verdictOf(`${log}exit code: 0\n`), { verdict: "unsure", reason: "skipped_tests" }, log);
  }
  const xfail = lines("ok 13 - known # EXPECTED FAILURE bug 123", "  ---", "  duration_ms: 0.13", "  type: 'test'", "  ...", "1..13") + TAP_SUMMARY(13, 0);
  assert.deepEqual({ f: node(xfail)?.failed, x: node(xfail)?.expected_failures }, { f: 0, x: 1 });
});
