// docs/decisions/php-agent-diagnostic-cap.md: PHP agent JSON summaries do not vouch for another linter's diagnostic lines, so the warning cap still applies (criteria naming only those clean linters: named-linter-cap.test.ts).
// Every line below is invented to mirror the real shapes (glued JSON summaries, oxlint agent-format heads, a silent type check, an exit line); no real log text is committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { RUNNER_KINDS, SUMMARY_ONLY } from "../src/engine/runners/kinds.ts";
import { parsers as phpAgent } from "../src/engine/runners/php-agent.ts";

const pack = loadPack("generic", packDirs(process.env));
const verdictOf = (evidence: string, criterion: string, p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: p } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;

const SUMMARIES = '{"tool":"pint","result":"passed"}{"tool":"rector","result":"passed","totals":{"changed_files":0,"errors":0}}';
const PHPSTAN = '{"tool":"phpstan","result":"passed","errors":0}';
const WARNINGS = [
  "web/cart.ts:12:9: warning eslint(no-unused-vars): Variable 'total' is declared but never used. help: Consider removing this declaration.",
  "web/cart.ts:30:5: warning eslint(no-debugger): `debugger` statement is not allowed help: Remove the debugger statement",
];
const WITH_WARNINGS = lines(SUMMARIES, "$ fmt --check web/", "All matched files use the correct format.", ...WARNINGS, PHPSTAN, "$ type-check --noEmit", "exit code: 0");
const WITHOUT_WARNINGS = lines(SUMMARIES, "$ fmt --check web/", "All matched files use the correct format.", PHPSTAN, "$ type-check --noEmit", "exit code: 0");

test("C1: lint and clean criteria are capped when another linter's warning line is in the log", () => {
  for (const criterion of ["lint is clean", "there are no lint warnings"]) {
    assert.deepEqual(verdictOf(WITH_WARNINGS, criterion), { verdict: "unsure", reason: "warning_in_log" }, criterion);
  }
});

test("C1: an exit-status criterion is not a clean claim and stays met", () => {
  assert.deepEqual(verdictOf(WITH_WARNINGS, "composer test exits with code 0"), { verdict: "met", reason: undefined });
});

test("C2: the same summaries without a diagnostic line are not capped", () => {
  for (const criterion of ["lint is clean", "there are no lint warnings", "phpstan reports no errors", "composer test exits with code 0"]) {
    assert.deepEqual(verdictOf(WITHOUT_WARNINGS, criterion), { verdict: "met", reason: undefined }, criterion);
  }
});

test("C2: a failing summary is still missing, the cap never lifts a verdict", () => {
  const failing = lines('{"tool":"phpstan","result":"failed","errors":3}', ...WARNINGS, "exit code: 0");
  assert.equal(verdictOf(failing, "lint is clean", 0.02).verdict, "missing");
});

test("SUMMARY_ONLY is exactly the set of non-test runners php-agent.ts parses (pao test lines are full test facts, docs/decisions/pao-test-json.md)", () => {
  const isTest = (name: string) => RUNNER_KINDS[name]?.includes("test") === true;
  assert.deepEqual([...SUMMARY_ONLY].sort(), phpAgent.map((p) => p.name).filter((n) => !isTest(n)).sort());
  assert.deepEqual(phpAgent.map((p) => p.name).filter(isTest).sort(), ["paratest", "pest", "phpunit"]);
});
