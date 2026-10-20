// docs/decisions/script-tool-list.md: a plain step list after a script command (`composer test (pint, rector, phpstan, vue-tsc)`) is not a lint or test claim; a list with claim wording and a linter named outside a list still are.
// Every line below is invented in the shape of a real combined log (glued agent JSON summaries, oxlint agent-format warning lines, a silent type check, an exit line).

import assert from "node:assert/strict";
import { test } from "node:test";
import { claimsTests, doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";

const pack = loadPack("generic", packDirs(process.env));
const verdictOf = (evidence: string, criterion: string) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: 0.98 } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;

const LOG = lines(
  '{"tool":"pint","result":"passed"}{"tool":"rector","result":"passed","totals":{"changed_files":0,"errors":0}}',
  "$ vp fmt --check src/ && vp lint src/",
  "All matched files use the correct format.",
  "src/js/useWidget.ts:12:5: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily.",
  "src/js/usePanel.ts:30:18: warning typescript(no-base-to-string): 'value' will use Object's default stringification format.",
  '{"tool":"phpstan","result":"passed","errors":0}',
  "$ vue-tsc --noEmit",
  "exit code: 0",
);
const OXLINT_SUMMARY = lines("Found 4 warnings and 0 errors.", "Finished in 900ms on 400 files with 116 rules using 8 threads.", '{"tool":"phpstan","result":"passed","errors":0}', "exit code: 0");

test("S1: a plain step list after the script command is neither a lint nor a test claim", () => {
  for (const c of [
    "composer test (pint, rector, phpstan, vue-tsc) exits with code 0",
    "composer test (pint --test, rector --dry-run, frontend lint, phpstan, tsc --noEmit) finished with exit code 0",
    "composer test (pint, rector, vp fmt/lint, phpstan, vue-tsc) exit code 0",
    "npm run check (eslint + tsc) exits with code 0",
    "bun run verify (oxlint, vue-tsc) exits 0",
  ]) {
    assert.deepEqual(verdictOf(LOG, c), { verdict: "met", reason: undefined }, c);
    assert.deepEqual(verdictOf(OXLINT_SUMMARY, c), { verdict: "met", reason: undefined }, c);
  }
  assert.equal(claimsTests("composer test (pint --test, rector --dry-run) exits with code 0"), false);
});

test("S1: claim wording in the list, a linter outside a list and a lint claim still cap", () => {
  for (const c of [
    "composer test (lint clean) exits with code 0",
    "composer test (no warnings) exits with code 0",
    "composer test (phpstan no errors) exits with code 0",
    "composer test (phpstan 0 errors) exits with code 0",
    "composer test (lint hatasız) exits with code 0",
    "phpstan exits with code 0",
    "lint is clean",
    "composer test (pint, phpstan) exits 0; phpstan 0 errors",
    "composer test and phpstan exit with code 0",
    "npm run check (oxlint) passes and oxlint exits 0",
  ]) {
    assert.deepEqual(verdictOf(LOG, c), { verdict: "unsure", reason: "warning_in_log" }, c);
  }
  for (const c of ["composer test (all tests pass) exits with code 0", "composer test (unit tests, lint) exits with code 0", "cargo test (fmt, clippy) passes"]) {
    assert.equal(claimsTests(c), true, c);
  }
});

test("S1: a list that is not right after a script command is unchanged", () => {
  assert.deepEqual(verdictOf(LOG, "the checks (pint, rector, phpstan) exit with code 0"), { verdict: "unsure", reason: "warning_in_log" });
  assert.deepEqual(verdictOf(LOG, "composer test exits with code 0 (pint, phpstan)"), { verdict: "unsure", reason: "warning_in_log" });
});
