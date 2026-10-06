// mix test, ctest and rubocop parsers; fixtures are synthetic and mirror the dev logs of the second real-log sample.
// Each tool: pass, fail, truncated, forged or indented, warnings or excluded; formats in docs/decisions/real-logs-2-parsers.md.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers } from "../src/engine/runners/more-tools.ts";

const by = (name: string) => {
  const p = parsers.find((x) => x.name === name);
  assert.ok(p, name);
  return p;
};
const mix = by("mix test");
const ctest = by("ctest");
const rubocop = by("rubocop");

const EX = (summary: string) => `$ mix test\nRunning ExUnit with seed: 795176, max_cases: 8\n\n........\nFinished in 3.4 seconds (1.0s async, 2.4s sync)\n${summary}\nexit code: 0\n`;

test("mix test: pass, excluded, empty, failures, cut-off and forged summaries", () => {
  const ok = mix.parse(EX("11 doctests, 277 tests, 0 failures"));
  assert.deepEqual({ p: ok?.passed, f: ok?.failed, inc: ok?.incomplete }, { p: 288, f: 0, inc: undefined });
  const excl = mix.parse(EX("11 doctests, 277 tests, 0 failures (41 excluded)"));
  assert.deepEqual({ s: excl?.skipped, p: excl?.passed }, { s: 41, p: 288 });
  assert.equal(mix.parse(EX("3 tests, 0 failures, 1 skipped"))?.skipped, 1);
  const empty = mix.parse(EX("0 tests, 0 failures (6 excluded)"));
  assert.deepEqual({ p: empty?.passed, inc: empty?.incomplete }, { p: 0, inc: true });
  const failed = mix.parse(`Running ExUnit with seed: 1\n\n  1) test adds (MathTest)\n     test/math_test.exs:5\n     Assertion with == failed\n\nFinished in 0.1 seconds (0.1s async, 0.0s sync)\n3 tests, 1 failure\n`);
  assert.deepEqual({ f: failed?.failed, names: failed?.failing }, { f: 1, names: ["adds (MathTest)"] });
  const cut = mix.parse("Running ExUnit with seed: 1\n\n.....\n");
  assert.deepEqual({ p: cut?.passed, inc: cut?.incomplete }, { p: 0, inc: true });
  assert.equal(mix.parse("5 tests, 0 failures\n"), null);
  assert.equal(mix.parse("$ gleam test\n..........\nFinished in 0.042 seconds\n26 tests, 0 failures\n"), null);
  assert.equal(mix.parse("  Running ExUnit with seed: 1\nFinished in 1 seconds\n  5 tests, 0 failures\n"), null);
  assert.equal(mix.parse(`Running ExUnit with seed: 1\nFinished in 0.1 seconds (0.1s async, 0.0s sync)\n5 tests, 0 failures\n1 tests, 1 failure\n`)?.failed, 1);
  const second = mix.parse(`${EX("5 tests, 0 failures")}Running ExUnit with seed: 2\n.....\n`);
  assert.equal(second?.incomplete, true);
  const crash = mix.parse(`Running ExUnit with seed: 1\n** (CompileError) test/a_test.exs:3: undefined function x/0\n`);
  assert.deepEqual({ e: crash?.errors, inc: crash?.incomplete }, { e: 1, inc: true });
  assert.equal(mix.parse("$ mix test.coverage\n|  100.00% | Total |\nGenerated HTML coverage results in \"cover\" directory\n"), null);
});

test("mix test: the Result summary only when it is a pass", () => {
  const ok = mix.parse("Running ExUnit with seed: 7\nFinished in 13.9 seconds (7.5s async, 6.3s sync)\n\nResult: 1534 passed (6 doctests, 1528 tests)\n");
  assert.deepEqual({ p: ok?.passed, inc: ok?.incomplete }, { p: 1534, inc: undefined });
  const odd = mix.parse("Running ExUnit with seed: 7\nFinished in 1 seconds (1s async, 0s sync)\nResult: 5 passed, 2 failed (7 tests)\n");
  assert.deepEqual({ f: odd?.failed, inc: odd?.incomplete }, { f: 1, inc: true });
  const unknown = mix.parse("Running ExUnit with seed: 7\nFinished in 1 seconds (1s async, 0s sync)\nResult: 5 passed, 1 skipped (6 tests)\n");
  assert.equal(unknown?.incomplete, true);
});

test("mix test: a failing run with exit code 0 is a conflict, not a pass", () => {
  const p = parseEvidence(EX("5 tests, 2 failures"));
  assert.equal(p.trust, "parsed");
  assert.equal(p.conflict, true);
});

const CT = (summary: string, extra = "") => `$ ctest --output-on-failure\nTest project /srv/work/build\n    Start 1: unit\n1/2 Test #1: unit ........................   Passed    0.01 sec\n    Start 2: io\n2/2 Test #2: io ..........................   Passed    0.02 sec\n\n${summary}\n\nTotal Test time (real) =   0.05 sec\n${extra}exit code: 0\n`;

test("ctest: pass, failed block, not run block, no tests, cut-off", () => {
  const ok = ctest.parse(CT("100% tests passed, 0 tests failed out of 2"));
  assert.deepEqual({ p: ok?.passed, f: ok?.failed, inc: ok?.incomplete }, { p: 2, f: 0, inc: undefined });
  const failed = ctest.parse(`${CT("50% tests passed, 1 tests failed out of 2")}\nThe following tests FAILED:\n\t  2 - io (Failed)\nErrors while running CTest\n`);
  assert.deepEqual({ f: failed?.failed, names: failed?.failing, p: failed?.passed }, { f: 1, names: ["io"], p: 1 });
  const skipped = ctest.parse(CT("100% tests passed, 0 tests failed out of 5").replace("\nTotal Test time", "\nThe following tests did not run:\n\t  3 - slow (Disabled)\n\t  4 - net (Skipped)\n\nTotal Test time"));
  assert.deepEqual({ s: skipped?.skipped, p: skipped?.passed }, { s: 2, p: 3 });
  assert.equal(ctest.parse("Test project /srv/work/build\nNo tests were found!!!\n")?.incomplete, true);
  assert.equal(ctest.parse("Test project /srv/work/build\n    Start 1: unit\n1/2 Test #1: unit ........ Passed 0.01 sec\n")?.incomplete, true);
  const noTotal = ctest.parse("100% tests passed, 0 tests failed out of 2\nexit code: 0\n");
  assert.equal(noTotal?.incomplete, true);
  const perTest = ctest.parse(CT("100% tests passed, 0 tests failed out of 2").replace("unit ........................   Passed", "unit ........................***Failed"));
  assert.equal(perTest?.failed, 1);
  assert.equal(ctest.parse("$ echo done\nexit code: 0\n"), null);
});

const RB = (summary: string, body = "") => `$ bundle exec rubocop\nInspecting 480 files\n........C...\n${body}\n${summary}\nexit code: 0\n`;

test("rubocop: clean, offenses, corrected, install-only and cut-off logs", () => {
  const ok = rubocop.parse(RB("480 files inspected, no offenses detected"));
  assert.deepEqual({ p: ok?.passed, e: ok?.errors, inc: ok?.incomplete }, { p: 480, e: 0, inc: undefined });
  const bad = rubocop.parse(RB("480 files inspected, 2 offenses detected", "Offenses:\n\napp/a.rb:3:5: C: Style/StringLiterals: Prefer single-quoted strings.\napp/b.rb:9:1: W: Lint/UselessAssignment: Useless assignment.\n"));
  assert.deepEqual({ e: bad?.errors, p: bad?.passed, names: bad?.failing }, { e: 2, p: 478, names: ["app/a.rb", "app/b.rb"] });
  const fixed = rubocop.parse(RB("1 file inspected, 1 offense detected, 1 offense corrected", "app/a.rb:3:5: [Corrected] C: Style/StringLiterals: x\n"));
  assert.equal(fixed?.incomplete, true);
  assert.equal(rubocop.parse("Inspecting 480 files\n........\n")?.incomplete, true);
  assert.equal(rubocop.parse("Successfully installed rubocop-1.91.0\n12 gems installed\nexit code: 0\n"), null);
  assert.equal(rubocop.parse("  480 files inspected, no offenses detected\n"), null);
  assert.equal(rubocop.parse(RB("0 files inspected, no offenses detected"))?.incomplete, true);
  const warn = rubocop.parse(RB("480 files inspected, no offenses detected", "Warning: Lint/Foo does not support Bar parameter.\nNotice: baseline in effect\n"));
  assert.equal(warn?.warnings, 2);
  const noSummaryButOffense = rubocop.parse("Inspecting 3 files\napp/a.rb:1:1: E: Lint/Syntax: unexpected token\n");
  assert.deepEqual({ e: noSummaryButOffense?.errors, inc: noSummaryButOffense?.incomplete }, { e: 1, inc: true });
});

test("cross-tool: a log of one tool is not claimed by the others", () => {
  for (const log of [EX("5 tests, 0 failures"), CT("100% tests passed, 0 tests failed out of 2"), RB("480 files inspected, no offenses detected")]) {
    const names = parseEvidence(log).runners.map((r) => r.runner);
    assert.equal(names.length, 1, names.join(","));
  }
});
