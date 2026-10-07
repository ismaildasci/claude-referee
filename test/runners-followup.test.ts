// Second review of the 2026-10-06 parser fixes, reproduced with real gh, node 26.9 and bun 1.4 output: CI line prefixes, node:test failure details and todo or skip
// lines with a reason under a tail or the done clip, and failing bun runs. Fixtures are invented lines of the same shape; real log text is never committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneEvidence, doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers as js } from "../src/engine/runners/js.ts";
import { skipMarkers } from "../src/engine/runners/skips.ts";

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

const ghView = (job: string, step: string, ...l: string[]) => l.map((x, i) => `${job}\t${step}\t2026-10-07T00:26:${String(50 + i).padStart(2, "0")}.1234567Z ${x}`);
const TSC = "src/a.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'.";
const TSC_PRETTY = "src/a.ts:1:14 - error TS2322: Type 'number' is not assignable to type 'string'.";
const GH_TSC = (tsc: string, ...tail: string[]) => lines(...ghView("typecheck", "Run npx tsc --noEmit", "##[group]Run npx tsc --noEmit", "npx tsc --noEmit", "shell: /usr/bin/bash -e {0}", "##[endgroup]", tsc, ...tail), "exit code: 0");

test("gh run view --log: a tsc error behind the job, step and timestamp prefix is a tsc error, and the step's exit line is read", () => {
  for (const tsc of [TSC, TSC_PRETTY]) {
    const log = GH_TSC(tsc, "##[error]Process completed with exit code 2.");
    const parsed = parseEvidence(log);
    assert.deepEqual({ runners: runnersOf(log), exit: parsed.exit_code, first: parsed.exit_lines[0] }, { runners: [["tsc", 0, 0, 1, 0, false]], exit: 2, first: "##[error]Process completed with exit code 2" }, tsc);
    for (const criterion of ["the typecheck passes", "CI passes"]) assert.deepEqual(verdictOf(log, criterion), { verdict: "missing", reason: "exit_code_nonzero" }, criterion);
    assert.deepEqual(verdictOf(GH_TSC(tsc), "the typecheck passes"), { verdict: "unsure", reason: undefined }, tsc);
    assert.deepEqual(verdictOf(GH_TSC(tsc), "the typecheck passes", 0.2), { verdict: "missing", reason: undefined }, tsc);
  }
});

const GH_FAILED = lines(
  ...ghView("required", "UNKNOWN STEP", "Run results:", '  "job": "test",', '  "result": "failure"', "##[error]Process completed with exit code 1."),
  "exit code: 0",
);
const RAW = (...l: string[]) => l.map((x, i) => `${i === 0 ? "﻿" : ""}2026-10-07T00:33:${String(20 + i).padStart(2, "0")}.4401234Z ${x}`);
const RAW_VITEST = lines(
  ...RAW("##[group]Run npx vitest run", "npx vitest run", "##[endgroup]", "", " RUN  v5.0.3 /home/runner/work/demo/demo", "", " ❯ test/a.test.ts (2 tests | 1 failed) 5ms", "   × a > rounds 3ms", "", " Test Files  1 failed (1)", "      Tests  1 failed | 1 passed (2)", "##[error]Process completed with exit code 1."),
  "exit code: 0",
);

test("GitHub Actions logs: '##[error]Process completed with exit code N.' behind a timestamp is an exit line, raw or through gh run view", () => {
  assert.deepEqual({ exit: parseEvidence(GH_FAILED).exit_code, trust: parseEvidence(GH_FAILED).trust }, { exit: 1, trust: "exit_code" });
  assert.deepEqual(verdictOf(GH_FAILED, "CI passes"), { verdict: "missing", reason: "exit_code_nonzero" });
  assert.deepEqual({ runners: runnersOf(RAW_VITEST), exit: parseEvidence(RAW_VITEST).exit_code }, { runners: [["vitest", 1, 1, 0, 0, false]], exit: 1 });
  assert.deepEqual(verdictOf(RAW_VITEST, "CI passes"), { verdict: "missing", reason: "exit_code_nonzero" });
  assert.deepEqual(verdictOf(RAW_VITEST.replace("##[error]Process completed with exit code 1.", "##[endgroup]"), "CI passes"), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(RAW_VITEST.replace("##[error]Process completed with exit code 1.", "##[endgroup]"), "CI passes", 0.2), { verdict: "missing", reason: undefined });
});

test("CI prefixes: a passing step stays met, the prefix is stripped once, a timestamp inside a line is kept", () => {
  const pass = lines(...ghView("test", "Run npx vitest run", " ✓ test/a.test.ts (2 tests) 4ms", "", " Test Files  1 passed (1)", "      Tests  2 passed (2)"), "exit code: 0");
  assert.deepEqual(runnersOf(pass), [["vitest", 2, 0, 0, 0, false]]);
  assert.deepEqual(verdictOf(pass, "CI passes"), { verdict: "met", reason: undefined });
  const raw = lines(...RAW("Run npx tsc --noEmit", "npx tsc --noEmit"), "exit code: 0");
  assert.deepEqual(verdictOf(raw, "the typecheck passes"), { verdict: "met", reason: undefined });
  assert.equal(parseEvidence(`2026-10-07T00:00:00Z 2026-10-07T00:00:01Z exit code: 0\n`).exit_lines[0], "2026-10-07T00:00:01Z exit code: 0");
  assert.equal(parseEvidence(`deployed at 2026-10-07T00:00:00Z ${TSC}\n`).runners.length, 0);
  assert.equal(parseEvidence(GH_TSC(TSC)).lines, GH_TSC(TSC).split("\n").length);
});

test("CI prefixes: a skip count behind a timestamp is a skip marker, so an earlier run's skips still cap met", () => {
  const two = lines(...RAW(" Test Files  1 passed (1)", "      Tests  1 passed | 1 skipped (2)", "", " Test Files  1 passed (1)", "      Tests  2 passed (2)"), "exit code: 0");
  assert.equal(skipMarkers(two).length, 1);
  assert.deepEqual(verdictOf(two), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf(two.replace("1 passed | 1 skipped (2)", "2 passed (2)")), { verdict: "met", reason: undefined });
});

const DETAIL_TAIL = lines(
  "  +     d: 'x',",
  "  -     d: 'y',",
  "        e: true",
  "      }",
  "    }",
  "  ",
  "      at TestContext.<anonymous> (file:///srv/work/demo/test/config.test.mjs:3:31)",
  "      at Test.runInAsyncScope (node:async_hooks:226:14)",
  "      at Test.run (node:internal/test_runner/test:1402:25)",
  "      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {",
  "    generatedMessage: true,",
  "    code: 'ERR_ASSERTION',",
  "    actual: { a: 1, c: { d: 'x', e: true } },",
  "    expected: { a: 1, c: { d: 'y', e: true } },",
  "    operator: 'deepStrictEqual',",
  "    diff: 'simple'",
  "  }",
);
const HOOK_TAIL = lines("      at TestHook.run (node:internal/test_runner/test:1757:18)", "      at Suite.runHook (node:internal/test_runner/test:1289:20)", "      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3)");
const HOOK_ERROR = lines("  [Error [ERR_TEST_FAILURE]: no connection] {", "    code: 'ERR_TEST_FAILURE',", "    failureType: 'hookFailed',", "    cause: Error: no connection", "  }");
const TIMEOUT_TAIL = lines("test at test/net.test.mjs:7:1", "✖ fetches the remote index", "  'test timed out after 40ms'");
const PROPS_TAIL = lines("    operator: 'strictEqual',", "    diff: 'simple'", "  }");

test("node:test: failure details in a window with no summary are one failure, cut off", () => {
  for (const tail of [DETAIL_TAIL, HOOK_TAIL, HOOK_ERROR, TIMEOUT_TAIL, PROPS_TAIL]) {
    const f = node(tail);
    assert.deepEqual({ f: f?.failed, i: f?.incomplete }, { f: 1, i: true }, tail);
    assert.deepEqual(verdictOf(`${tail}exit code: 0\n`), { verdict: "unsure", reason: undefined }, tail);
    assert.deepEqual(verdictOf(tail), { verdict: "unsure", reason: "incomplete_run" }, tail);
    assert.deepEqual(verdictOf(tail, "all tests pass", 0.2), { verdict: "missing", reason: undefined }, tail);
  }
});

const NODE_SUMMARY = (pass: number, fail: number, skipped = 0, todo = 0) =>
  lines(`ℹ tests ${pass + fail + skipped + todo}`, "ℹ suites 0", `ℹ pass ${pass}`, `ℹ fail ${fail}`, "ℹ cancelled 0", `ℹ skipped ${skipped}`, `ℹ todo ${todo}`, "ℹ duration_ms 130.4");

test("node:test: details printed by a passing run with a summary, and details under a todo entry, are not failures", () => {
  const logged = lines("AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:", "    at TestContext.<anonymous> (file:///srv/work/demo/test/a.test.mjs:5:12)", "    at Test.run (node:internal/test_runner/test:1402:25) {", "  code: 'ERR_ASSERTION',", "  diff: 'simple'", "}", "✔ reports a caught assertion (0.6ms)", "✔ sums two numbers (0.4ms)") + NODE_SUMMARY(2, 0) + "exit code: 0\n";
  assert.deepEqual({ f: node(logged)?.failed, i: node(logged)?.incomplete }, { f: 0, i: undefined });
  assert.deepEqual(verdictOf(logged), { verdict: "met", reason: undefined });
  const clean = lines("✔ sums two numbers (0.4ms)", "✔ formats a date (0.1ms)") + NODE_SUMMARY(2, 0) + "exit code: 0\n";
  assert.deepEqual(verdictOf(clean), { verdict: "met", reason: undefined });
  for (const tail of [lines("ℹ cancelled 0", "ℹ skipped 0", "ℹ todo 0", "ℹ duration_ms 130.4"), lines("✔ sums two numbers (0.4ms)", "✔ formats a date (0.1ms)")]) assert.equal(node(tail), null, tail);
});

const TODO_BLOCK = lines(
  "test at test/csv.test.mjs:6:26",
  "⚠ parses quoted fields (0.726625ms) # quoted fields not supported yet",
  "  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:",
  "  ",
  "      at TestContext.<anonymous> (file:///srv/work/demo/test/csv.test.mjs:6:40)",
  "      at Test.run (node:internal/test_runner/test:1402:25) {",
  "    code: 'ERR_ASSERTION',",
  "    operator: 'deepStrictEqual',",
  "    diff: 'simple'",
  "  }",
);

test("node:test: a todo or skip line with a reason is a todo or skip, with or without a summary", () => {
  const todo = node(TODO_BLOCK);
  assert.deepEqual({ f: todo?.failed, s: todo?.skipped }, { f: 0, s: 1 });
  assert.deepEqual(verdictOf(`${TODO_BLOCK}exit code: 0\n`), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf(`${TODO_BLOCK}exit code: 0\n`, "all tests pass", 0.2), { verdict: "missing", reason: undefined });
  for (const line of ["﹣ fetches the remote index (0.053583ms) # needs network", "✔ formats the footer (0.064ms) # wording not final", "  ⚠ nested todo (0.2ms) # later"]) {
    const log = lines("✔ sums two numbers (0.4ms)", line, "exit code: 0");
    assert.equal(node(log)?.skipped, 1, line);
    assert.deepEqual(verdictOf(log), { verdict: "unsure", reason: "skipped_tests" }, line);
  }
  const full = lines("✔ adds (0.4ms)", "⚠ parses quoted fields (0.5ms) # not yet", "✔ footer (0.1ms) # later", "⚠ todo flag (1.3ms) # TODO", "﹣ needs network (0.05ms) # offline", "﹣ skipped flag (0.04ms) # SKIP") + NODE_SUMMARY(1, 0, 2, 3) + lines("", "✖ failing tests:", "", "test at a.test.mjs:4:1", "⚠ parses quoted fields (0.5ms) # not yet", "  AssertionError [ERR_ASSERTION]: x", "", "test at a.test.mjs:6:1", "⚠ todo flag (1.3ms) # TODO", "  AssertionError [ERR_ASSERTION]: y", "exit code: 0");
  assert.deepEqual({ f: node(full)?.failed, s: node(full)?.skipped }, { f: 0, s: 5 });
});

test("node:test: a name with '#', an expected failure and a passing run are not todos", () => {
  const log = lines("✔ handles # in names (0.1ms)", "✔ rounds half to even (0.4ms) # EXPECTED FAILURE", "✔ sums (0.2ms)") + NODE_SUMMARY(3, 0) + "exit code: 0\n";
  assert.deepEqual({ s: node(log)?.skipped, x: node(log)?.expected_failures }, { s: 0, x: 1 });
  const named = lines("✔ handles # in names (0.1ms)", "✔ sums (0.2ms)") + NODE_SUMMARY(2, 0) + "exit code: 0\n";
  assert.deepEqual(verdictOf(named), { verdict: "met", reason: undefined });
});

test("done: a todo run whose summary falls in the clip's omitted middle is not met", () => {
  const pass = Array.from({ length: 60 }, (_, i) => `✔ splits simple row ${i} (0.018125ms)`);
  const todos = Array.from({ length: 15 }, (_, i) => `⚠ parses quoted field ${i} (0.726625ms) # quoted fields not supported yet`);
  const block = (i: number) => [
    "",
    `test at test/csv.test.mjs:${6 + i}:26`,
    `⚠ parses quoted field ${i} (0.726625ms) # quoted fields not supported yet`,
    "  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:",
    ...Array.from({ length: 12 }, (_, j) => `  -   'field ${j}'`),
    `      at TestContext.<anonymous> (file:///srv/work/demo/test/csv.test.mjs:${6 + i}:40)`,
    ...Array.from({ length: 5 }, () => "      at Test.run (node:internal/test_runner/test:1402:25)"),
    "    code: 'ERR_ASSERTION',",
    "    operator: 'deepStrictEqual',",
    "    diff: 'simple'",
    "  }",
  ];
  const log = lines(...pass, ...todos) + NODE_SUMMARY(60, 0, 0, 15) + lines("", "✖ failing tests:", ...Array.from({ length: 15 }, (_, i) => block(i)).flat(), "exit code: 0");
  const clipped = doneEvidence(log);
  assert.ok(!clipped.includes("ℹ todo 15") && clipped.includes("characters omitted"));
  assert.equal(verdictOf(clipped).verdict, "unsure");
  assert.deepEqual(verdictOf(log), { verdict: "unsure", reason: "skipped_tests" });
});

const BUN_TAIL = lines(
  '5 |   test("exits with exit code 0 on --help", () => {',
  '6 |     const r = spawnSync("sh", ["-c", "exit 3"]);',
  "7 |     expect(r.status).toBe(0);",
  "                         ^",
  "error: expect(received).toBe(expected)",
  "",
  "Expected: 0",
  "Received: 3",
  "",
  "      at <anonymous> (/srv/work/demo/cli.test.ts:7:22)",
  "(fail) cli > exits with exit code 0 on --help [14.04ms]",
  "",
  " 1 pass",
  " 1 fail",
  " 2 expect() calls",
  "Ran 2 tests across 1 file. [25.00ms]",
);
const bun = (text: string) => parseEvidence(text).runners.find((r) => r.runner === "bun test") ?? null;

test("bun test: a failing run is read from its summary and (fail) lines", () => {
  assert.deepEqual({ runners: runnersOf(BUN_TAIL), failing: bun(BUN_TAIL)?.failing, summary: bun(BUN_TAIL)?.summary_line }, { runners: [["bun test", 1, 1, 0, 0, false]], failing: ["cli > exits with exit code 0 on --help"], summary: "Ran 2 tests across 1 file. [25.00ms]" });
  const mixed = lines("(fail) cli > exits with exit code 0 on --help [0.26ms]", "(fail) cli > throws [0.08ms]", "", " 2 pass", " 1 skip", " 1 todo", " 2 fail", " 3 expect() calls", "Ran 6 tests across 1 file. [9.00ms]");
  assert.deepEqual(runnersOf(mixed), [["bun test", 2, 2, 0, 2, false]]);
  const unhandled = lines("# Unhandled error between tests", "-------------------------------", "error: module boom", "-------------------------------", "", " 2 pass", " 1 fail", " 1 error", " 2 expect() calls", "Ran 3 tests across 2 files. [10.00ms]");
  assert.deepEqual(runnersOf(unhandled), [["bun test", 2, 1, 1, 0, false]]);
  assert.deepEqual(runnersOf(lines("(fail) cli > throws [0.08ms]")), [["bun test", 0, 1, 0, 0, true]]);
});

test("done: a failing bun run behind a pipe's exit code 0 is not met; its real exit code is missing", () => {
  assert.deepEqual(verdictOf(`${BUN_TAIL}exit code: 0\n`), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(`${BUN_TAIL}exit code: 1\n`), { verdict: "missing", reason: "exit_code_nonzero" });
  assert.deepEqual(verdictOf(BUN_TAIL, "all tests pass", 0.2), { verdict: "missing", reason: undefined });
  assert.deepEqual(verdictOf("(fail) cli > throws [0.08ms]\nexit code: 0\n"), { verdict: "unsure", reason: undefined });
});

test("bun test: a clean run keeps its exit-code reading, and node, jest, vitest and mocha output is not bun's", () => {
  const clean = lines("bun test v1.4.0 (34cbb9a4)", "", " 2 pass", " 0 fail", " 2 expect() calls", "Ran 2 tests across 1 file. [4.00ms]", "exit code: 0");
  assert.deepEqual({ trust: parseEvidence(clean).trust, runners: parseEvidence(clean).runners.length }, { trust: "exit_code", runners: 0 });
  assert.deepEqual(verdictOf(clean), { verdict: "met", reason: undefined });
  const skips = lines("(pass) cart > adds item [0.41ms]", "(skip) cart > applies bundle coupon", "", " 1 pass", " 1 skip", " 0 fail", "Ran 2 tests across 1 file. [9.00ms]", "exit code: 0");
  assert.equal(bun(skips), null);
  assert.deepEqual(verdictOf(skips), { verdict: "unsure", reason: "skipped_tests" });
  const others = [
    NODE_SUMMARY(3, 1) + lines("", "✖ failing tests:", "", "test at a.test.mjs:1:1", "✖ adds (1ms)"),
    NODE_SUMMARY(3, 1).replaceAll("ℹ ", "# "),
    lines("FAIL src/a.test.ts", "  ● adds", "Tests:       1 failed, 1 passed, 2 total"),
    lines(" ❯ test/a.test.ts (2 tests | 1 failed) 5ms", " Test Files  1 failed (1)", "      Tests  1 failed | 1 passed (2)"),
    lines("  1 passing (4ms)", "  1 failing", "", "  1) adds:", "     AssertionError: expected 1 to equal 2"),
  ];
  for (const log of others) assert.equal(bun(log), null, log);
});

test("skip markers: a zero count is never a skip marker, so a test's own count line with zeros stays met", () => {
  for (const line of ["Completed: 1, Incomplete: 0", "Todos: 0", "Risky: 0", "0 risky", "0 incomplete", "Tests:    0 risky, 0 incomplete, 2 passed (2 assertions)", "Tests  2 passed | 0 expected fail (2)", "Completed: 1, Pending: 0"]) assert.deepEqual(skipMarkers(line), [], line);
  const log = lines("Completed: 1, Incomplete: 0", "✔ counts todos (0.630958ms)") + NODE_SUMMARY(1, 0) + "exit code: 0\n";
  assert.deepEqual(verdictOf(log), { verdict: "met", reason: undefined });
});
