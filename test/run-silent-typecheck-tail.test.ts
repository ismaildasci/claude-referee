// docs/decisions/run-silent-typecheck-tail.md: under done --run with exit 0, a tsc or vue-tsc echo that ends the output becomes a runner fact; piped evidence and every other shape are unchanged.
// Every line below is invented in the shape of a real combined log; doneRequest gets the check's exit code and command as done --run passes them.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { silentTypecheckTail } from "../src/engine/runners/echo.ts";

const pack = loadPack("generic", packDirs(process.env));
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const ask = (evidence: string, criterion: string, run: boolean, code = 0) => {
  const { planned, finish } = run ? doneRequest(pack, undefined, [criterion], evidence, code, "composer test") : doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: 0.98 } }, stopped: [], cached: true }]);
  const facts = (planned[0]?.state as { evidence?: { runners?: { runner: string; summary_line: string | null }[]; trust?: string } } | undefined)?.evidence;
  return { verdict: result.verdict, reason: result["reason"], runners: facts?.runners?.map((r) => r.runner) ?? [], tail: facts?.runners?.find((r) => r.runner.endsWith("tsc"))?.summary_line, trust: facts?.trust };
};

const HEAD = ["$ composer test", '{"tool":"pint","result":"passed"}{"tool":"rector","result":"passed","totals":{"changed_files":0,"errors":0}}', "src/js/useWidget.ts:12:5: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily.", '{"tool":"phpstan","result":"passed","errors":0}'];
const COMBINED = lines(...HEAD, "$ vue-tsc --noEmit", "exit code: 0");

test("R1: under --run the silent vue-tsc tail is a type check fact, piped it is not", () => {
  const run = ask(COMBINED, "vue-tsc reports no errors", true);
  assert.deepEqual(run, { verdict: "met", reason: undefined, runners: ["pint", "phpstan", "rector", "vue-tsc"], tail: "vue-tsc printed no diagnostics and exited 0", trust: "parsed" });
  const piped = ask(COMBINED, "vue-tsc reports no errors", false);
  assert.deepEqual(piped.runners, ["pint", "phpstan", "rector"]);
  assert.equal(piped.reason, undefined);
  assert.equal(ask(COMBINED, "composer test (pint, rector, phpstan, vue-tsc) exits with code 0", true).verdict, "met");
  assert.deepEqual(ask(lines("$ npm run typecheck", "> app@1.0.0 typecheck", "> tsc --noEmit", "exit code: 0"), "the typecheck passes", true).runners, ["tsc"]);
});

test("R1: the lint and test caps are unchanged by the fact", () => {
  assert.deepEqual(ask(COMBINED, "lint is clean", true).reason, "warning_in_log");
  assert.deepEqual(ask(COMBINED, "all tests pass", true).reason, "no_tests_run");
});

test("R1: other shapes are not read as a silent tail", () => {
  for (const tail of ["$ vue-tsc --noEmit || true", "$ vue-tsc --noEmit > /dev/null", "$ tsc --noEmit 2>/dev/null", "$ vue-tsc --noEmit; echo done", "$ vue-tsc --noEmit | tee out.txt", "$ eslint .", "$ NODE_OPTIONS=--x vue-tsc --noEmit", "> tsc --noEmit --quiet"]) {
    assert.equal(silentTypecheckTail(lines(...HEAD, tail, "exit code: 0")), null, tail);
  }
  assert.equal(silentTypecheckTail(lines(...HEAD, "$ vue-tsc --noEmit", "src/App.vue(3,1): error TS2304: Cannot find name 'x'.", "exit code: 0")), null);
  assert.equal(silentTypecheckTail(lines("$ vue-tsc --noEmit", ...HEAD, "exit code: 0")), null);
  assert.equal(silentTypecheckTail(lines(...HEAD, "$ vue-tsc --noEmit", "", "exit code: 0", "")), "vue-tsc");
  assert.deepEqual(ask(COMBINED, "vue-tsc reports no errors", true, 2), { verdict: "missing", reason: "exit_code_nonzero", runners: [], tail: undefined, trust: undefined });
});
