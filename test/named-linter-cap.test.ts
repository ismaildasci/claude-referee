// docs/decisions/named-linter-cap.md: a criterion that names only linters whose own parsed summaries are clean is not capped by another tool's warnings.
// Every line below is invented to mirror the real shapes (glued JSON summaries, oxlint agent-format heads, a silent type check, an exit line); no real log text is committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";

const pack = loadPack("generic", packDirs(process.env));
const run = (evidence: string, criteria: string[], p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, criteria, evidence);
  return finish(planned.length === 0 ? [] : [{ id: "done", answers: Object.fromEntries(criteria.map((_, i) => [`c${i + 1}`, { type: "noul" as const, noul: p }])), stopped: [], cached: true }]);
};
const verdictOf = (evidence: string, criterion: string) => {
  const result = run(evidence, [criterion]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;

const SUMMARIES = '{"tool":"pint","result":"passed"}{"tool":"rector","result":"passed","totals":{"changed_files":0,"errors":0}}';
const PHPSTAN = '{"tool":"phpstan","result":"passed","errors":0}';
const WARNINGS = [
  "web/cart.ts:12:9: warning eslint(no-unused-vars): Variable 'total' is declared but never used. help: Consider removing this declaration.",
  "web/cart.ts:30:5: warning eslint(no-debugger): `debugger` statement is not allowed help: Remove the debugger statement",
];
const combined = (pint = SUMMARIES, phpstan = PHPSTAN) => lines(pint, "$ fmt --check web/ && lint", "All matched files use the correct format.", ...WARNINGS, phpstan, "$ type-check --noEmit", "exit code: 0");

test("N1: criteria naming only clean parsed linters are met next to another tool's warnings", () => {
  for (const criterion of ["phpstan reports no errors", "pint passed, rector 0 errors, phpstan 0 errors", "pint, phpstan and rector report no problems", "composer test (pint, rector, vp fmt/lint, phpstan, tsc) exits 0; phpstan 0 errors"]) {
    assert.deepEqual(verdictOf(combined(), criterion), { verdict: "met", reason: undefined }, criterion);
  }
});

test("N1: generic lint or clean wording keeps the cap", () => {
  for (const criterion of ["lint is clean", "there are no lint warnings", "vp fmt/lint without errors", "phpstan is clean", "pint and phpstan pass with no warnings"]) {
    assert.deepEqual(verdictOf(combined(), criterion), { verdict: "unsure", reason: "warning_in_log" }, criterion);
  }
});

test("N1: a named linter that is not parsed, or not clean, keeps the cap", () => {
  const oxlintWarned = lines("  ! eslint(no-unused-vars): Variable 'x' is declared but never used.", "   ,-[web/a.ts:1:5]", "Found 4 warnings and 0 errors.", "Finished in 6ms on 3 files with 95 rules using 8 threads.", "exit code: 0");
  assert.deepEqual(verdictOf(oxlintWarned, "oxlint reports 0 errors"), { verdict: "unsure", reason: "warning_in_log" });
  const stylelintNextToClean = lines("⚠ 1 problem (0 errors, 1 warning)", "Found 0 warnings and 0 errors.", "Finished in 4ms on 3 files with 95 rules using 8 threads.", "exit code: 0");
  assert.deepEqual(verdictOf(stylelintNextToClean, "stylelint and oxlint pass"), { verdict: "unsure", reason: "warning_in_log" });
  assert.deepEqual(verdictOf(combined(), "phpstan and eslint report no errors"), { verdict: "unsure", reason: "warning_in_log" });
  assert.deepEqual(verdictOf(lines("tool: warning: the old flag is deprecated", "exit code: 0"), "phpstan reports no errors"), { verdict: "unsure", reason: "warning_in_log" });
});

test("N1: other caps and failures are unchanged", () => {
  assert.deepEqual(verdictOf(combined('{"tool":"pint","result":"fixed"}'), "pint passed"), { verdict: "unsure", reason: "incomplete_run" });
  assert.notEqual(verdictOf(combined(SUMMARIES, '{"tool":"phpstan","result":"failed","errors":2}'), "phpstan reports no errors").verdict, "met");
  const both = run(combined(), ["lint is clean", "phpstan reports no errors"]);
  assert.equal(both.verdict, "unsure");
  assert.equal(both["reason"], "warning_in_log");
  assert.deepEqual(both["criteria"], [{ i: 1, verdict: "unsure", p: 0.98 }, { i: 2, verdict: "met", p: 0.98 }]);
});
