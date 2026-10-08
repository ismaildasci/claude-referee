// The wider ANSI strip (docs/decisions/ansi-wide.md): colon colours, OSC 8 links, 8-bit CSI, charset switches and unterminated OSC are removed, and a check wrapped in them reads as the same text uncoloured.
// Every line is invented to mirror the escape shapes the real-use scan found; no real log text.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneEvidence, doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { stripAnsi } from "../src/engine/runners/util.ts";
import { stopSkipReason } from "../src/engine/stopgate/decide.ts";
import { analyzeTranscript } from "../src/engine/stopgate/transcript.ts";

const E = "\u001b";
const pack = loadPack("generic", packDirs(process.env));

const verdictOf = (log: string, noul: number, criterion = "all tests pass") => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], doneEvidence(log));
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul } }, stopped: [], cached: true }]);
  return result.verdict;
};

const turn = (command: string, output: string) => {
  const lines = [
    { type: "user", isSidechain: false, message: { role: "user", content: "fix the flag parser" } },
    { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "Edit", input: { file_path: "/src/cli.ts", old_string: "a", new_string: "b" } }] } },
    { type: "user", isSidechain: false, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }] } },
    { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_2", name: "Bash", input: { command } }] } },
    { type: "user", isSidechain: false, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_2", content: output, is_error: false }] } },
    { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "text", text: "Fixed; the tests pass." }] } },
  ];
  return analyzeTranscript(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
};

test("each escape shape from the real-use scan is removed, and its text kept", () => {
  assert.equal(stripAnsi(`${E}[38:2::255:0:0mred${E}[0m`), "red");
  assert.equal(stripAnsi(`${E}]8;;https://example.test/a\u0007link${E}]8;;\u0007`), "link");
  assert.equal(stripAnsi(`${E}]8;id=1;https://example.test${E}\\text${E}]8;;${E}\\`), "text");
  assert.equal(stripAnsi("\u009b32mgreen\u009b0m"), "green");
  assert.equal(stripAnsi(`${E}(Bok${E}[m`), "ok");
  assert.equal(stripAnsi(`${E}]0;window title`), "");
  assert.equal(stripAnsi(`${E}[32mtest result: ok. 3 passed${E}[0m`), "test result: ok. 3 passed");
});

test("the parsers read a log with an OSC 8 link or a colon colour as they read the plain one", () => {
  const plain = "test result: ok. 3 passed; 0 failed; 0 ignored\n";
  const linked = `test result: ok. ${E}]8;;https://example.test/run\u0007${E}[32m3 passed${E}[0m${E}]8;;\u0007; 0 failed; 0 ignored\n`;
  const colon = `${E}[38:5:2mtest result: ok. 3 passed; 0 failed; 0 ignored${E}[0m\n`;
  const runners = (log: string) => parseEvidence(`$ cargo test\n${log}exit code: 0\n`).runners.map((r) => [r.runner, r.passed, r.failed, r.errors]);
  assert.deepEqual(runners(linked), runners(plain));
  assert.deepEqual(runners(colon), runners(plain));
  assert.equal(verdictOf(`$ cargo test\n${linked}exit code: 0\n`, 0.98), verdictOf(`$ cargo test\n${plain}exit code: 0\n`, 0.98));
});

const SPEC_PASS_LINKED =
  `▶ cli\n  ${E}]8;;https://example.test/spec\u0007${E}[32m✔ exit code 2 for unknown flags${E}[39m${E}]8;;\u0007 ${E}[90m(0.07ms)${E}[39m\n` +
  `${E}[32m✔ cli ${E}[90m(0.88ms)${E}[39m${E}[39m\n` +
  ["tests 2", "suites 1", "pass 2", "fail 0", "cancelled 0", "skipped 0", "todo 0", "duration_ms 41.2"].map((l) => `${E}[34mℹ ${l}${E}[39m\n`).join("");
const SPEC_PASS_PLAIN = SPEC_PASS_LINKED.replace(/\u001b\]8;;[^\u0007]*\u0007/g, "");

test("a stop check whose passing title is an OSC 8 link reads as the same pass as the uncoloured title", () => {
  const linked = turn("npm test", SPEC_PASS_LINKED);
  const plain = turn("npm test", SPEC_PASS_PLAIN);
  assert.deepEqual(linked.checks, plain.checks);
  assert.deepEqual(linked.checks, [{ cmd: "npm test", status: "passed" }]);
  assert.equal(stopSkipReason(linked), "check_passed_after_edit");
  assert.equal(verdictOf(SPEC_PASS_LINKED, 0.98), verdictOf(SPEC_PASS_PLAIN, 0.98));
});

test("an unterminated OSC does not swallow the rest of the log", () => {
  const log = `${E}]8;;https://example.test/cut\n\n5 passed\nexit code: 0\n`;
  assert.equal(stripAnsi(log), "\n\n5 passed\nexit code: 0\n");
});
