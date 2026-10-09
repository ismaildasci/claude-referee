// Echoed command lines as facts for exit-code-only evidence (docs/decisions/command-echo-facts.md): known check tools only, none when the command hides or tolerates output.

import assert from "node:assert/strict";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const lines = (text: string): readonly string[] => parseEvidence(text).command_lines;

test("a check tool's echo before an exit-code-only log is kept; the exit line and other echoes are not", () => {
  assert.deepEqual(lines("$ tsc --noEmit\nexit code: 0\n"), ["$ tsc --noEmit"]);
  assert.deepEqual(lines("\n> app@1.0.0 lint\n> eslint .\n\nexit code: 0\n"), ["> eslint ."]);
  assert.deepEqual(lines("$ ./deploy.sh --prod\n$ echo done\nexit code: 0\n"), []);
  assert.deepEqual(lines("$ npm run build\n$ npm run build\nexit code: 0\n"), ["$ npm run build"]);
});

test("a log whose echoed check command hides, redirects or tolerates its output or failure sends no echo", () => {
  for (const command of ["eslint --quiet .", "eslint -q .", "oxlint --silent src", "eslint -f json .", "eslint . -o out.txt", "eslint --fix .", "eslint . || true", "tsc --noEmit ; true", "eslint . > out.txt", "tsc 2>/dev/null"]) {
    assert.deepEqual(lines(`$ ${command}\nexit code: 0\n`), [], command);
  }
  assert.deepEqual(lines("$ tsc --noEmit\n$ eslint --quiet .\nexit code: 0\n"), []);
});

test("at most three lines of at most 80 characters", () => {
  const many = ["a", "b", "c", "d"].map((x) => `$ npm run ${x}`).join("\n");
  assert.equal(lines(`${many}\nexit code: 0\n`).length, 3);
  assert.equal(lines(`$ npm test ${"x".repeat(200)}\nexit code: 0\n`)[0]?.length, 80);
});

test("the facts sent to Jev carry command_lines only for exit-code-only evidence", async () => {
  const sent = async (evidence: string): Promise<Record<string, unknown>> => {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test", REFEREE_DATA_DIR: tempDir() }, stdin: evidence });
    assert.equal(await run(["done", "--criteria", "typecheck passes", "--dry-run"], io, commands), 0);
    const request = (io.json()["sent"] as { state: { evidence: Record<string, unknown> } }[])[0];
    return request?.state.evidence ?? {};
  };
  assert.deepEqual((await sent("$ tsc --noEmit\nexit code: 0\n"))["command_lines"], ["$ tsc --noEmit"]);
  assert.equal("command_lines" in (await sent("exit code: 0\n")), false);
  assert.equal("command_lines" in (await sent("$ npm test\nTests: 12 passed, 12 total\nexit code: 0\n")), false);
});
