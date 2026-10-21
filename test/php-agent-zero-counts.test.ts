// docs/decisions/php-agent-zero-counts.md: Pint, PHPStan and Rector facts reach Jev without zero passed, failed and skipped counts; every other runner and every cap is unchanged.
// Every log line below is invented; the stubbed answer is 0.98.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";

const pack = loadPack("generic", packDirs(process.env));
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const ask = (evidence: string, criterion: string) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: 0.98 } }, stopped: [], cached: true }]);
  const runners = (planned[0]?.state as { evidence?: { runners?: Record<string, unknown>[] } } | undefined)?.evidence?.runners ?? [];
  return { runners: Object.fromEntries(runners.map((r) => [r["runner"], r])), verdict: result.verdict, reason: result["reason"] };
};

const PASSED = '{"tool":"pint","result":"passed"}{"tool":"rector","result":"passed","totals":{"changed_files":0,"errors":0},"changed_files":["app/Cart.php"]}';
const PHPSTAN = '{"tool":"phpstan","result":"passed","errors":0}';
const NODE_TEST = ["ℹ tests 12", "ℹ suites 0", "ℹ pass 12", "ℹ fail 0", "ℹ cancelled 0", "ℹ skipped 0", "ℹ todo 0", "ℹ duration_ms 52.1"];
const OXLINT = ["Found 2 warnings and 0 errors.", "Finished in 9ms on 3 files with 90 rules using 8 threads."];

test("Z1: the three runners send no zero test counts; their other facts and a non-zero count stay", () => {
  const { runners } = ask(lines(PASSED, PHPSTAN, "exit code: 0"), "pint, rector and phpstan pass");
  assert.deepEqual(runners["pint"], { runner: "pint", errors: 0, failing: [], summary_line: "pint reported no style issues" });
  assert.deepEqual(runners["phpstan"], { runner: "phpstan", errors: 0, failing: [], summary_line: "phpstan reported no errors" });
  assert.deepEqual(runners["rector"], { runner: "rector", errors: 0, failing: [], summary_line: "rector dry run found nothing to change" });
  const rector = ask(lines('{"tool":"rector","result":"failed","totals":{"changed_files":3,"errors":0}}'), "rector passed").runners["rector"];
  assert.equal(rector?.["failed"], 3);
  assert.equal("passed" in (rector ?? {}), false);
  assert.equal(ask(lines('{"tool":"pint","result":"fixed"}', "exit code: 0"), "pint passed").runners["pint"]?.["incomplete"], true);
});

test("Z1: other runners next to them keep every count, zeros included", () => {
  const { runners } = ask(lines(...NODE_TEST, PHPSTAN, ...OXLINT, "exit code: 0"), "all tests pass");
  assert.deepEqual(Object.keys(runners).sort(), ["node:test", "oxlint", "phpstan"]);
  for (const name of ["node:test", "oxlint"]) for (const key of ["passed", "failed", "skipped"]) assert.equal(typeof runners[name]?.[key], "number", `${name} ${key}`);
  assert.equal("passed" in (runners["phpstan"] ?? {}), false);
});

test("Z1: the caps give the same verdicts as before", () => {
  const warned = lines(PASSED, "web/cart.ts:12:9: warning eslint(no-unused-vars): Variable 'total' is declared but never used.", PHPSTAN, "exit code: 0");
  const cases: [string, string, string, string | undefined][] = [
    [warned, "lint is clean", "unsure", "warning_in_log"],
    [lines(PASSED, PHPSTAN, "exit code: 0"), "all tests pass", "unsure", "no_tests_run"],
    [lines('{"tool":"pint","result":"fixed"}', "exit code: 0"), "pint passed", "unsure", "incomplete_run"],
    [lines(PASSED, PHPSTAN, "exit code: 0"), "pint passed, rector 0 errors, phpstan 0 errors", "met", undefined],
  ];
  for (const [evidence, criterion, verdict, reason] of cases) {
    const got = ask(evidence, criterion);
    assert.deepEqual({ verdict: got.verdict, reason: got.reason }, { verdict, reason }, criterion);
  }
  const failed = ask(lines('{"tool":"phpstan","result":"failed","errors":2}', "exit code: 0"), "phpstan 0 errors");
  assert.notEqual(failed.verdict, "met");
  assert.equal(failed.runners["phpstan"]?.["errors"], 2);
});
