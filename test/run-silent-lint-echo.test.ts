// docs/decisions/run-silent-lint-echo.md: under done --run with exit 0, the CLI's own `$ <command>` line no longer stops the silent eslint or oxlint reading; piped evidence is unchanged.
// Every line below is invented in the shape of a real npm lint run; doneRequest gets the check's exit code and command as done --run passes them.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";

const pack = loadPack("generic", packDirs(process.env));
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const ask = (evidence: string, ran?: string, code = 0, criterion = "lint is clean") => {
  const { planned, finish } = ran === undefined ? doneRequest(pack, undefined, [criterion], evidence) : doneRequest(pack, undefined, [criterion], evidence, code, ran);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: 0.98 } }, stopped: [], cached: true }]);
  const facts = (planned[0]?.state as { evidence?: { runners?: { runner: string }[]; trust?: string } } | undefined)?.evidence;
  return { verdict: result.verdict, reason: result["reason"], runners: facts?.runners?.map((r) => r.runner) ?? [], trust: facts?.trust };
};

const ESLINT = ["", "> web@1.0.0 lint", '> eslint --ext ".js,.vue" --ignore-path .gitignore . --cache'];
const OXLINT = ["", "> api@0.0.1 lint", "> oxlint --type-aware src/ test/", ""];

test("R1: under --run a silent eslint or oxlint run behind the CLI's command line is a clean run, piped it is not", () => {
  assert.deepEqual(ask(lines("$ npm run lint", ...ESLINT, "exit code: 0"), "npm run lint"), { verdict: "met", reason: undefined, runners: ["eslint"], trust: "parsed" });
  assert.deepEqual(ask(lines("$ cd api && npm run lint", ...OXLINT, "exit code: 0"), "cd api && npm run lint").runners, ["oxlint"]);
  assert.deepEqual(ask(lines("$ npm run lint", ...ESLINT, "exit code: 0")), { verdict: "met", reason: undefined, runners: [], trust: "exit_code" });
});

test("R1: the silent reading's exclusions still hold under --run", () => {
  const run = (...l: string[]) => ask(lines("$ npm run lint", ...l, "exit code: 0"), "npm run lint");
  for (const command of ["> eslint . --quiet", "> eslint . -f json", "> eslint . --fix", "> eslint . || true"]) assert.equal(run("", "> web@1.0.0 lint", command).trust, "exit_code", command);
  assert.equal(run(...ESLINT, "", "> web@1.0.0 lint:css", "> eslint styles").trust, "exit_code");
  assert.equal(run(...ESLINT, "Done in 1.20s.").trust, "exit_code");
  assert.deepEqual(ask(lines("$ npm run lint", ...ESLINT, "exit code: 2"), "npm run lint", 2), { verdict: "missing", reason: "exit_code_nonzero", runners: [], trust: undefined });
  const warned = run(...ESLINT, "", "/repo/src/App.vue", "  3:1  warning  Unexpected console statement  no-console", "", "✖ 1 problem (0 errors, 1 warning)");
  assert.notEqual(warned.verdict, "met");
});

test("R1: only the exact command line is dropped, and a parsed log keeps its facts", () => {
  assert.equal(ask(lines("$ npm run lint:fix", ...ESLINT, "exit code: 0"), "npm run lint").trust, "exit_code");
  assert.equal(ask(lines(...ESLINT, "$ npm run lint", "exit code: 0"), "npm run lint").trust, "exit_code");
  const parsed = lines("$ npm run test", "", "> web@1.0.0 test", "> vitest run", "", " Test Files  2 passed (2)", "      Tests  9 passed (9)", "exit code: 0");
  const run = doneRequest(pack, undefined, ["all tests pass"], parsed, 0, "npm run test").planned[0]?.state as { evidence: { runners: unknown[] } };
  assert.deepEqual(run.evidence.runners.length, parseEvidence(parsed).runners.length);
});
