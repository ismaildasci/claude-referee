// Parser defects reproduced on 2026-10-06 with real tool output on local synthetic projects: node:test cancelled, failing list, todo and expected failures; cargo --no-fail-fast;
// exit lines inside source frames, titles, assertion messages and hex codes; Pest risky, incomplete and todos; vitest expected fail; tsc lines read as dotnet or not at all.
// Review round: two-summary logs, failure-glyph exit lines, prefixed tsc and NG errors, cargo build trace lines. Real log text is never committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parsers as compiled } from "../src/engine/runners/compiled.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers as js } from "../src/engine/runners/js.ts";
import { parsers as more } from "../src/engine/runners/more.ts";
import { skipMarkers } from "../src/engine/runners/skips.ts";

const pack = loadPack("generic", packDirs(process.env));
const by = (name: string) => {
  const p = [...js, ...compiled, ...more].find((x) => x.name === name);
  assert.ok(p, name);
  return p;
};
const verdictOf = (evidence: string, criterion = "all tests pass", p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: p } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;

const NODE_SUMMARY = (pass: number, fail: number, cancelled: number, skipped = 0, todo = 0) =>
  lines(`ℹ tests ${pass + fail + cancelled + skipped + todo}`, "ℹ suites 0", `ℹ pass ${pass}`, `ℹ fail ${fail}`, `ℹ cancelled ${cancelled}`, `ℹ skipped ${skipped}`, `ℹ todo ${todo}`, "ℹ duration_ms 212.4");
const NODE_TIMEOUT = NODE_SUMMARY(40, 0, 1) + lines("", "✖ failing tests:", "", "test at test/net.test.mjs:7:1", "✖ fetches the remote index (40.2ms)", "  'test timed out after 40ms'");
const NODE_HOOK =
  lines("▶ store suite", "  ✖ loads a record", "✖ store suite (0.3ms)", "✔ formats a date (0.1ms)") +
  NODE_SUMMARY(1, 0, 1) +
  lines("", "✖ failing tests:", "", "test at test/store.test.mjs:5:3", "✖ loads a record", "  'test did not finish before its parent and was cancelled'", "", "test at test/store.test.mjs:3:1", "✖ store suite (0.3ms)", "  Error: no connection");
const NODE_PASS = lines("✔ sums two numbers (0.4ms)", "✔ formats a date (0.1ms)") + NODE_SUMMARY(2, 0, 0);

test("node:test: a cancelled test is a failure and marks the run incomplete", () => {
  const f = by("node:test").parse(NODE_TIMEOUT);
  assert.deepEqual({ p: f?.passed, f: f?.failed, i: f?.incomplete, n: f?.failing }, { p: 40, f: 1, i: true, n: ["fetches the remote index"] });
  assert.equal(by("node:test").parse(NODE_TIMEOUT.replaceAll("ℹ ", "# "))?.failed, 1);
  assert.equal(by("node:test").parse(NODE_PASS)?.incomplete, undefined);
});

test("node:test: names under 'failing tests:' count, with or without a duration", () => {
  const f = by("node:test").parse(NODE_HOOK);
  assert.deepEqual({ f: f?.failed, n: f?.failing }, { f: 2, n: ["store suite", "loads a record"] });
  const listedOnly = by("node:test").parse(NODE_SUMMARY(3, 0, 0) + lines("", "✖ failing tests:", "", "test at test/a.test.mjs:1:1", "✖ reads the config", "  Error: missing key"));
  assert.deepEqual({ f: listedOnly?.failed, n: listedOnly?.failing }, { f: 1, n: ["reads the config"] });
  const cut = by("node:test").parse(lines("✔ sums two numbers (0.4ms)", "", "✖ failing tests:", ""));
  assert.equal(cut?.failed, 1);
});

test("node:test: the failing list ends at the next unindented line; later failures still count", () => {
  const two = NODE_SUMMARY(1, 1, 0) + lines("", "✖ failing tests:", "", "test at a.test.mjs:1:1", "✖ a breaks (1ms)", "  Error: x", "> test:e2e", "✖ b breaks (2ms)", "✖ 2 problems (2 errors, 0 warnings)");
  assert.deepEqual(by("node:test").parse(two)?.failing, ["a breaks", "b breaks"]);
});

test("node:test: todo counts as skipped in the summary and as a skip marker", () => {
  const todo = lines("✔ later (0.1ms) # TODO") + NODE_SUMMARY(450, 0, 0, 0, 1);
  assert.equal(by("node:test").parse(todo)?.skipped, 1);
  assert.equal(by("node:test").parse(NODE_SUMMARY(450, 0, 0, 0, 1).replaceAll("ℹ ", "# "))?.skipped, 1);
  for (const hit of ["ℹ todo 1", "ℹ skipped 2", "# todo 1"]) assert.equal(skipMarkers(hit).length, 1, hit);
  for (const clean of ["ℹ tests 451", "ℹ suites 1", "ℹ pass 450", "ℹ fail 0", "ℹ cancelled 0", "ℹ skipped 0", "ℹ todo 0", "ℹ duration_ms 200.8"]) assert.equal(skipMarkers(clean).length, 0, clean);
});

const NODE_TODO_FAIL =
  lines("✔ works (0.4ms)", "⚠ not yet (0.5ms) # wip") +
  NODE_SUMMARY(1, 0, 0, 0, 1) +
  lines("", "✖ failing tests:", "", "test at a.test.mjs:4:1", "⚠ not yet (0.5ms) # wip", "  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:", "", "exit code: 0");
const NODE_TODO_FAIL_TAP = lines("TAP version 13", "# Subtest: works", "ok 1 - works", "# Subtest: not yet", "not ok 2 - not yet # TODO wip", "  ---", "  failureType: 'testCodeFailure'", "  ...", "1..2") + NODE_SUMMARY(1, 0, 0, 0, 1).replaceAll("ℹ ", "# ") + "exit code: 0\n";

test("node:test: a failing todo test is a todo, not a failure", () => {
  for (const log of [NODE_TODO_FAIL, NODE_TODO_FAIL_TAP]) {
    const f = by("node:test").parse(log);
    assert.deepEqual({ f: f?.failed, s: f?.skipped, n: f?.failing }, { f: 0, s: 1, n: [] });
    assert.deepEqual(verdictOf(log), { verdict: "unsure", reason: "skipped_tests" });
  }
  const mixed = NODE_SUMMARY(1, 1, 0, 0, 1) + lines("", "✖ failing tests:", "", "test at a.test.mjs:4:1", "⚠ not yet (0.5ms) # wip", "", "test at a.test.mjs:9:1", "✖ adds (0.3ms)", "  Error: x");
  assert.deepEqual({ f: by("node:test").parse(mixed)?.failed, n: by("node:test").parse(mixed)?.failing }, { f: 1, n: ["adds"] });
  assert.equal(by("node:test").parse(lines("✔ works (0.4ms)", "", "✖ failing tests:", "", "test at a.test.mjs:4:1"))?.failed, 1);
});

const NODE_XFAIL = lines("✔ adds (0.4ms)", "✔ rounds half to even (known bug) (0.4ms) # EXPECTED FAILURE") + NODE_SUMMARY(2, 0, 0) + "exit code: 0\n";
const NODE_XFAIL_TAP = lines("TAP version 13", "# Subtest: adds", "ok 1 - adds", "# Subtest: rounds half to even (known bug)", "ok 2 - rounds half to even (known bug) # EXPECTED FAILURE", "1..2") + NODE_SUMMARY(2, 0, 0).replaceAll("ℹ ", "# ") + "exit code: 0\n";

test("node:test: an expected failure is an expected failure in both reporters, capped like an xfail", () => {
  for (const log of [NODE_XFAIL, NODE_XFAIL_TAP]) {
    assert.deepEqual({ p: by("node:test").parse(log)?.passed, x: by("node:test").parse(log)?.expected_failures }, { p: 2, x: 1 });
    assert.equal(skipMarkers(log).length, 1);
    assert.deepEqual(verdictOf(log), { verdict: "unsure", reason: "skipped_tests" });
  }
  assert.equal(by("node:test").parse(NODE_PASS)?.expected_failures, undefined);
  assert.equal(skipMarkers("✔ reports EXPECTED FAILURE lines (0.2ms)").length, 0);
});

test("done: cancelled, listed-failing and todo node:test runs never reach met; a clean run still does", () => {
  assert.deepEqual(verdictOf(`${NODE_TIMEOUT}exit code: 0\n`), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(NODE_TIMEOUT), { verdict: "unsure", reason: "incomplete_run" });
  assert.deepEqual(verdictOf(NODE_HOOK), { verdict: "unsure", reason: "incomplete_run" });
  assert.deepEqual(verdictOf(`${NODE_SUMMARY(450, 0, 0, 0, 1)}exit code: 0\n`), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf(`${NODE_PASS}exit code: 0\n`), { verdict: "met", reason: undefined });
});

const CARGO_NFF_TAIL = lines(
  "test check_total_399 ... ok",
  "",
  "test result: ok. 400 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s",
  "",
  "   Doc-tests calc",
  "",
  "running 0 tests",
  "",
  "test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s",
  "",
  "error: 2 targets failed:",
  "    `--test parse_fail`",
  "    `--test io_fail`",
);

test("cargo test --no-fail-fast: the closing 'N targets failed' line is a failure", () => {
  assert.deepEqual({ p: by("cargo test").parse(CARGO_NFF_TAIL)?.passed, f: by("cargo test").parse(CARGO_NFF_TAIL)?.failed }, { p: 400, f: 2 });
  assert.equal(by("cargo test").parse(CARGO_NFF_TAIL.replace("2 targets failed", "1 target failed"))?.failed, 1);
  assert.equal(by("cargo test").parse(CARGO_NFF_TAIL.replace("error: 2 targets failed:", "note: error: 2 targets failed:"))?.failed, 0);
});

test("done: a cargo tail whose only failure is the targets line is not met", () => {
  assert.deepEqual(verdictOf(`${CARGO_NFF_TAIL}exit code: 0\n`), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(`${CARGO_NFF_TAIL}exit code: 101\n`), { verdict: "missing", reason: "exit_code_nonzero" });
  assert.deepEqual(verdictOf(CARGO_NFF_TAIL, "all tests pass", 0.2), { verdict: "missing", reason: undefined });
  const clean = CARGO_NFF_TAIL.split("\nerror: 2 targets failed:")[0];
  assert.deepEqual(verdictOf(`${clean}\nexit code: 0\n`), { verdict: "met", reason: undefined });
});

test("exit lines: real shapes still parse, hex codes keep their value", () => {
  const cases: [string, number][] = [
    ["Reason: builder failed with exit code 2.", 2],
    ["error: builder for '/nix/store/abc-demo.drv' failed with exit code 1;", 1],
    ["Error: Process completed with exit code 1.", 1],
    ["dotnet exit code: 0", 0],
    ["sbt 'testOnly *.QueueSpec' exit code: 0", 0],
    ["    helper_test.go:19: stdout of helper: exit code: 0", 0],
    ["  process didn't exit successfully: `deps/demo-1a2b` (exit status: 101)", 101],
    ["Process exited with exit code 0xC0000005", 0xc0000005],
    ["  process didn't exit successfully: `t\\d\\a.exe` (exit code: 0xc0000005, STATUS_ACCESS_VIOLATION)", 0xc0000005],
    ["exit code: 0", 0],
  ];
  for (const [line, code] of cases) assert.equal(parseEvidence(`${line}\n`).exit_code, code, line);
});

test("exit lines: source frames, test titles, result lines and open quotes are not exit codes", () => {
  const titles = [
    ' 8 |   test("exits with exit code 0 on --help", () => {',
    "> 12 |   it('returns exit code 0', () => {",
    '      8|   test("exit code 0 is returned")',
    '  test("exits with exit code 0 on --help", () => {',
    'echo "exit code: 0"',
    "✔ returns exit code 2 on an unknown flag (0.4ms)",
    "  ✓ cli > exits with exit code 0 3ms",
    "  × cli > exits with exit code 0 5ms",
    "(pass) cli > exits with exit code 0 [1.20ms]",
    "ok 1 - exits with exit code 0",
    "exit code 10x5",
  ];
  for (const line of titles) assert.equal(parseEvidence(`${line}\n`).exit_code, null, line);
});

test("exit lines: assertion messages, suite and subtest titles are not exit codes", () => {
  const shapes = [
    "error: expected exit code 0, got 2",
    "    cli_test.go:31: expected exit code 0, got 2",
    "AssertionError: Expected exit status 0 but received 1",
    "    cli_test.go:44: exit code = 2, want 0",
    "    cli_test.go:45: exit code 0, expected 3",
    "▶ exit code 2 handling",
    "# Subtest: exit code 2 handling",
    "    # Subtest: returns exit code 2 on a bad flag",
    "﹣ exits with exit code 3 (0.1ms) # SKIP",
  ];
  for (const line of shapes) assert.equal(parseEvidence(`${line}\n`).exit_code, null, line);
});

test("exit lines: a failure line keeps a non-zero code; a 0 on a failure line is a title", () => {
  const cases: [string, number | null][] = [
    ["✖ Command failed with exit code 1: npm run lint", 1],
    ["× Process exited with exit code 2", 2],
    ["not ok 3 - exits with exit code 1", 1],
    ["✖ exits with exit code 0 on --help (1.2ms)", null],
    ["(fail) cli > exits with exit code 0 [1.20ms]", null],
  ];
  for (const [line, code] of cases) assert.equal(parseEvidence(`${line}\n`).exit_code, code, line);
});

const BUN_MSG = lines(
  "bun test v1.4.0 (0a1b2c3d)",
  "",
  "cli.test.ts:",
  "5 |   const code = run([\"--quiet\"]);",
  "6 |   if (code !== 0) throw new Error(`expected exit code 0, got ${code}`);",
  "                                                                         ^",
  "error: expected exit code 0, got 2",
  "      at <anonymous> (/srv/work/demo/cli.test.ts:6:70)",
  "(fail) accepts --quiet [4.41ms]",
  "",
  " 1 pass",
  " 1 fail",
  "Ran 2 tests across 1 file. [12.00ms]",
);

test("done: an assertion message is not a clean exit, a failure line with a non-zero code is missing, titles stay met", () => {
  assert.equal(parseEvidence(BUN_MSG).trust, "unparsed");
  assert.deepEqual(verdictOf(BUN_MSG), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf(`${NODE_PASS}✖ Command failed with exit code 1: npm run lint\n`), { verdict: "missing", reason: "exit_code_nonzero" });
  const suites = lines("▶ exit code 2 handling", "  ✔ returns exit code 2 on a bad flag (0.3ms)", "✔ exit code 2 handling (1.3ms)") + NODE_SUMMARY(2, 0, 0) + "exit code: 0\n";
  assert.deepEqual(verdictOf(suites), { verdict: "met", reason: undefined });
  const tap = lines("TAP version 13", "# Subtest: exit code 2 handling", "    # Subtest: returns exit code 2 on a bad flag", "    ok 1 - returns exit code 2 on a bad flag", "    1..1", "ok 1 - exit code 2 handling", "1..1") + NODE_SUMMARY(1, 0, 0).replaceAll("ℹ ", "# ") + "exit code: 0\n";
  assert.deepEqual(verdictOf(tap), { verdict: "met", reason: undefined });
});

const CARGO_BUILD = (tail: string) => lines("$ cargo build", "   Compiling demo v0.1.0 (/srv/demo)", "    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.21s", tail, "exit code: 0");

test("cargo build: shell-trace and prompt exit lines after Finished are not extra output", () => {
  for (const tail of ["+ echo 'exit code: 0'", "+(eval):1> echo 'exit code: 0'", "✔ exit code: 0"]) {
    assert.equal(by("cargo build").parse(CARGO_BUILD(tail))?.incomplete, undefined, tail);
    assert.deepEqual(verdictOf(CARGO_BUILD(tail), "the build succeeds"), { verdict: "met", reason: undefined }, tail);
  }
  assert.equal(by("cargo build").parse(CARGO_BUILD("Hello from demo"))?.incomplete, true);
});

const BUN_FRAME = lines(
  "bun test v1.4.0 (0a1b2c3d)",
  "",
  "cli.test.ts:",
  ' 7 | describe("cli", () => {',
  ' 8 |   test("exits with exit code 0 on --help", () => {',
  ' 9 |     expect(run(["--help"])).toBe(0);',
  "10 |   });",
  "error: expect(received).toBe(expected)",
  "",
  "Expected: 2",
  "Received: 0",
  "",
  "      at <anonymous> (/srv/work/demo/cli.test.ts:12:30)",
  "(fail) cli > exits non-zero on an unknown flag [3.14ms]",
  "",
  " 1 pass",
  " 1 fail",
  "Ran 2 tests across 1 file. [18.00ms]",
);

test("done: an exit code read from a source frame or hex code never gives met; a title no longer gives missing", () => {
  assert.deepEqual(verdictOf(BUN_FRAME), { verdict: "unsure", reason: undefined });
  assert.equal(parseEvidence(BUN_FRAME).trust, "unparsed");
  assert.deepEqual(verdictOf("running tests\nProcess exited with exit code 0xC0000005\n"), { verdict: "missing", reason: "exit_code_nonzero" });
  const titled = lines("✔ returns exit code 2 on an unknown flag (0.4ms)", "✔ prints usage (0.6ms)") + NODE_SUMMARY(2, 0, 0) + "exit code: 0\n";
  assert.deepEqual(verdictOf(titled), { verdict: "met", reason: undefined });
});

const PEST_MIXED = lines("", "   WARN  Tests\\Unit\\DraftTest", "  ✓ passes", "  ! risky no assertions → This test did not perform any assertions", "  … incomplete one → wip", "", "  Tests:    1 risky, 1 incomplete, 1 passed (1 assertions)", "  Duration: 0.05s", "", "exit code: 0");
const PEST_RISKY = lines("", "   WARN  Tests\\Unit\\OnlyRiskyTest", "  ! risky a → This test did not perform any assertions", "  ! risky b → This test did not perform any assertions", "", "  Tests:    2 risky (0 assertions)", "  Duration: 0.11s", "", "exit code: 0");
const PEST_PASS = lines("", "   PASS  Tests\\Unit\\SlugTest", "  ✓ it lowercases input", "  ✓ it strips punctuation", "", "  Tests:    2 passed (4 assertions)", "  Duration: 0.12s", "", "exit code: 0");

test("Pest: risky and incomplete count as skipped, a risky-only line is still a summary", () => {
  assert.deepEqual({ p: by("jest").parse(PEST_MIXED)?.passed, s: by("jest").parse(PEST_MIXED)?.skipped }, { p: 1, s: 2 });
  assert.deepEqual({ p: by("jest").parse(PEST_RISKY)?.passed, s: by("jest").parse(PEST_RISKY)?.skipped }, { p: 0, s: 2 });
  assert.deepEqual({ p: by("jest").parse(PEST_PASS)?.passed, s: by("jest").parse(PEST_PASS)?.skipped }, { p: 2, s: 0 });
  assert.equal(by("jest").parse("Tests:       1 skipped, 2 passed, 3 total\n")?.skipped, 1);
});

test("done: Pest risky or incomplete tests are capped like skips; a clean Pest run is met", () => {
  assert.deepEqual(verdictOf(PEST_MIXED), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf(PEST_RISKY), { verdict: "unsure", reason: "skipped_tests" });
  assert.deepEqual(verdictOf(PEST_PASS), { verdict: "met", reason: undefined });
});

const VITEST_XFAIL = lines("", " RUN  v5.0.3 /srv/work/demo", "", " ✓ t/x.test.js > adds 1ms", " ✓ t/x.test.js > known bug 3ms", "", " Test Files  1 passed (1)", "      Tests  1 passed | 1 expected fail (2)", "   Start at  19:10:10", "   Duration  186ms (transform 44%, import 29%, tests 18%, worker 10%)", "", "exit code: 0");

test("vitest: an expected fail is an expected failure, capped like an xfail", () => {
  const f = by("vitest").parse(VITEST_XFAIL);
  assert.deepEqual({ p: f?.passed, f: f?.failed, x: f?.expected_failures }, { p: 1, f: 0, x: 1 });
  assert.deepEqual(verdictOf(VITEST_XFAIL), { verdict: "unsure", reason: "skipped_tests" });
  const clean = VITEST_XFAIL.replace("1 passed | 1 expected fail (2)", "2 passed (2)");
  assert.equal(by("vitest").parse(clean)?.expected_failures, undefined);
  assert.deepEqual(verdictOf(clean), { verdict: "met", reason: undefined });
});

const PEST_TWO = (first: string) => lines("", "   WARN  T5\\RiskyOneTest", "  ✓ adds", "  ! no assertions here → This test did not perform any assertions", "", `  Tests:    ${first}`, "  Duration: 0.15s", "", "", "   PASS  T4\\CleanTest", "  ✓ lowercases", "  ✓ trims", "", "  Tests:    2 passed (2 assertions)", "  Duration: 0.08s", "", "exit code: 0");
const VITEST_TWO = VITEST_XFAIL.replace("exit code: 0\n", "") + VITEST_XFAIL.replace("1 passed | 1 expected fail (2)", "2 passed (2)");

test("two summaries: risky, incomplete or expected-fail counts in an earlier run still cap met", () => {
  for (const log of [PEST_TWO("1 risky, 1 passed (1 assertions)"), PEST_TWO("1 risky, 1 incomplete, 1 passed (1 assertions)"), VITEST_TWO]) {
    assert.equal(skipMarkers(log).length, 1);
    assert.deepEqual(verdictOf(log), { verdict: "unsure", reason: "skipped_tests" });
  }
  assert.deepEqual(verdictOf(PEST_TWO("1 passed (1 assertions)")), { verdict: "met", reason: undefined });
  for (const hit of ["Tests:    1 risky, 1 passed (1 assertions)", "Tests:    1 incomplete, 1 passed (1 assertions)", "Tests  1 passed | 1 expected fail (2)", "Tests:    2 todos, 1 passed (1 assertions)"]) assert.equal(skipMarkers(hit).length, 1, hit);
  for (const clean of ["Tests:    0 risky, 2 passed (2 assertions)", "Tests  2 passed (2)", "Some tests are risky without assertions.", "the incomplete run was retried"]) assert.equal(skipMarkers(clean).length, 0, clean);
});

test("Pest: plural todos count as skipped and cap met", () => {
  const todos = lines("", "   PASS  T3\\TodoTest - 2 todos", "  ✓ adds numbers", "  ↓ parses the header", "  ↓ rejects a bad token", "", "  Tests:    2 todos, 1 passed (1 assertions)", "  Duration: 0.20s", "", "exit code: 0");
  assert.deepEqual({ p: by("jest").parse(todos)?.passed, s: by("jest").parse(todos)?.skipped }, { p: 1, s: 2 });
  assert.deepEqual(verdictOf(todos), { verdict: "unsure", reason: "skipped_tests" });
});

test("tsc output is read by tsc alone, not as a dotnet build; MSBuild errors still count", () => {
  const plain = "src/a.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.\nsrc/a.ts(2,7): error TS2322: Type 'number' is not assignable to type 'string'.\n";
  const pretty = "src/a.ts:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.\n\nFound 1 error in src/a.ts:1\n";
  for (const log of [plain, pretty]) assert.deepEqual(parseEvidence(log).runners.map((r) => r.runner), ["tsc"]);
  assert.equal(by("dotnet test").parse("Error: src/app/x.component.html:1:1 - error NG8001: 'app-x' is not a known element\n"), null);
  assert.equal(by("dotnet test").parse("CSC : error CS5001: Program does not contain a static 'Main' method [/src/App/App.csproj]\n")?.errors, 1);
  assert.equal(by("dotnet test").parse("/src/App/App.csproj : error NU1101: Unable to find package Demo.Missing.\n")?.errors, 1);
  assert.equal(by("dotnet test").parse("App/x.ts(1,7): error TS2322: Type bad [/src/App/App.csproj]\n\nBuild FAILED.\n")?.errors, 1);
  assert.deepEqual(verdictOf(`${plain}exit code: 2\n`, "the code typechecks"), { verdict: "missing", reason: "exit_code_nonzero" });
});

const TSC_LINE = "src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.";

test("tsc errors behind a turbo, CI timestamp, BuildKit or Angular prefix are still tsc errors", () => {
  const prefixed = [`web:typecheck: ${TSC_LINE}`, `@acme/web:typecheck: ${TSC_LINE}`, `@acme/web: ${TSC_LINE}`, `packages/web typecheck: ${TSC_LINE}`, `[web] ${TSC_LINE}`, `web-1  | ${TSC_LINE}`];
  for (const line of [...prefixed, `2026-10-06T12:00:00.1234567Z ${TSC_LINE}`, `#12 4.123 ${TSC_LINE}`, "ERROR in src/app/app.component.ts:5:3 - error TS2322: Type 'string' is not assignable to type 'number'.", "Error: src/app/app.component.ts:5:3 - error TS2322: Type 'string' is not assignable to type 'number'.", "Error: src/app/x.component.html:1:1 - error NG8001: 'app-x' is not a known element"]) {
    assert.deepEqual(parseEvidence(`${line}\n`).runners.map((r) => [r.runner, r.errors]), [["tsc", 1]], line);
  }
  assert.equal(by("tsc").parse("NOTE: all good src/a.ts(1,1): error TS2322: x\nFound 0 errors.\n")?.errors, 0);
});

test("done: prefixed tsc or NG errors never give met with exit code 0, alone or next to a passing run; a clean run is met", () => {
  const ng = "Error: src/app/x.component.html:1:1 - error NG8001: 'app-x' is not a known element\n";
  const angular = "Error: src/app/app.component.ts:5:3 - error TS2322: Type 'string' is not assignable to type 'number'.\n";
  for (const log of [ng, angular]) for (const criterion of ["the build succeeds", "the code typechecks"]) assert.deepEqual(verdictOf(`${log}exit code: 0\n`, criterion), { verdict: "unsure", reason: undefined }, criterion);
  assert.deepEqual(verdictOf(ng, "the build succeeds", 0.2), { verdict: "missing", reason: undefined });
  const turbo = `web:typecheck: ${TSC_LINE}\n${VITEST_XFAIL.replace("1 passed | 1 expected fail (2)", "2 passed (2)")}`;
  assert.deepEqual(verdictOf(turbo), { verdict: "unsure", reason: undefined });
  const ci = `2026-10-06T12:00:00.1234567Z ${TSC_LINE}\n${NODE_PASS}exit code: 0\n`;
  assert.deepEqual(verdictOf(ci), { verdict: "unsure", reason: undefined });
  assert.deepEqual(verdictOf("$ npx tsc --noEmit\nexit code: 0\n", "the code typechecks"), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf("Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12, Duration: 1 s - App.Tests.dll (net8.0)\nexit code: 0\n"), { verdict: "met", reason: undefined });
});
