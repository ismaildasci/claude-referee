// Stop gate reads coloured check output the way done does: ANSI stripped before the exit-line rule and the pass/fail reading.
// Every line is invented to mirror node --test spec, GitHub and build output shapes; no real log text.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneEvidence, doneRequest } from "../src/cli/commands/done.ts";
import { stripAnsi } from "../src/cli/shared.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { stripAnsi as engineStripAnsi } from "../src/engine/runners/util.ts";
import { stopSkipReason } from "../src/engine/stopgate/decide.ts";
import { analyzeTranscript } from "../src/engine/stopgate/transcript.ts";

const E = "\u001b";
const pack = loadPack("generic", packDirs(process.env));

const verdictOf = (log: string, noul: number, criterion = "all tests pass") => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], doneEvidence(log));
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul } }, stopped: [], cached: true }]);
  return result.verdict;
};

const turn = (command: string, output: string, isError = false) => {
  const lines = [
    { type: "user", isSidechain: false, message: { role: "user", content: "fix the flag parser" } },
    { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "Edit", input: { file_path: "/src/cli.ts", old_string: "a", new_string: "b" } }] } },
    { type: "user", isSidechain: false, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }] } },
    { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_2", name: "Bash", input: { command } }] } },
    { type: "user", isSidechain: false, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_2", content: output, is_error: isError }] } },
    { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "text", text: "Fixed; the tests pass." }] } },
  ];
  return analyzeTranscript(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
};

const specTail = (pass: number, fail: number) =>
  [`tests ${pass + fail}`, "suites 1", `pass ${pass}`, `fail ${fail}`, "cancelled 0", "skipped 0", "todo 0", "duration_ms 41.2"].map((l) => `${E}[34mℹ ${l}${E}[39m\n`).join("");
const SPEC_PASS =
  `▶ cli\n  ${E}[32m✔ returns exit code 0 on --help ${E}[90m(0.31ms)${E}[39m${E}[39m\n  ${E}[32m✔ exit code 2 for unknown flags ${E}[90m(0.07ms)${E}[39m${E}[39m\n` +
  `${E}[32m✔ cli ${E}[90m(0.88ms)${E}[39m${E}[39m\n` +
  specTail(2, 0);
const SPEC_FAIL = `▶ cli\n  ${E}[31m✖ exit code 2 for unknown flags ${E}[90m(0.42ms)${E}[39m${E}[39m\n${E}[31m✖ cli ${E}[90m(0.9ms)${E}[39m${E}[39m\n` + specTail(0, 1);

test("one helper: done's stripAnsi is the engine's", () => {
  assert.equal(stripAnsi, engineStripAnsi);
});

test("coloured node spec pass whose test title says exit code 2: passed, as done reads it", () => {
  const facts = turn("npm test", SPEC_PASS);
  assert.deepEqual(facts.checks, [{ cmd: "npm test", status: "passed" }]);
  assert.equal(stopSkipReason(facts), "check_passed_after_edit");
  assert.equal(verdictOf(SPEC_PASS, 0.98), "met");
  assert.notEqual(verdictOf(SPEC_PASS, 0.2), "met");
});

test("a lone coloured passing title with no summary is not an exit line, and not a pass either", () => {
  const facts = turn("npm test", `${E}[32m✔ exit code 2 for unknown flags ${E}[90m(0.07ms)${E}[39m${E}[39m\n`);
  assert.deepEqual(facts.checks.map((c) => c.status), ["unknown"]);
  assert.equal(stopSkipReason(facts), null);
});

test("coloured failing spec stays failed, with or without the error flag", () => {
  for (const isError of [true, false]) {
    const facts = turn("npm test", SPEC_FAIL, isError);
    assert.deepEqual(facts.checks.map((c) => c.status), ["failed"]);
    assert.equal(stopSkipReason(facts), null);
  }
  assert.notEqual(verdictOf(SPEC_FAIL, 0.98), "met");
});

test("a coloured non-zero exit line after a clean summary still fails the check", () => {
  const log = `${E}[32m✔ adds numbers ${E}[90m(0.5ms)${E}[39m\n` + specTail(1, 0) + `${E}[31mError: Process completed with exit code 1.${E}[0m\n`;
  assert.deepEqual(turn("npm test", log).checks.map((c) => c.status), ["failed"]);
  assert.notEqual(verdictOf(log, 0.98), "met");
});

test("silent check whose only output is a coloured error word: not passed", () => {
  const facts = turn("npm run build", `\n> app@1.0.0 build\n> node build.mjs\n\n${E}[31merror${E}[39m: could not write dist/app.js\n`);
  assert.deepEqual(facts.checks.map((c) => c.status), ["unknown"]);
  assert.equal(stopSkipReason(facts), null);
});

test("coloured output with a plain exit code 0 line stays passed", () => {
  assert.deepEqual(turn("npm test", `${E}[32mall checks ok${E}[39m\nexit code: 0\n`).checks.map((c) => c.status), ["passed"]);
});
