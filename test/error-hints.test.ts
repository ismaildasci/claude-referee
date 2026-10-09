// Credential stops name the line and the rule without the value; size errors name tokens, the limit and the largest file.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { redact, stopError } from "../src/engine/redact.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const SECRET = ["9f8e7d6c", "5b4a3f2e", "1d0c"].join("");

test("a secret on line 2 of a multi-line field reports line 2 and the assignment rule, never the value", () => {
  const { stopped } = redact({ evidence: `ok\nAPI_KEY=${SECRET}\nmore` });
  assert.deepEqual(stopped, [{ kind: "secret_assignment", field: "evidence", line: 2 }]);
  const error = stopError(stopped);
  assert.match(error.message, /secret_assignment in evidence, line 2/);
  assert.match(String(error.details.next_step), /key, token, secret or password/);
  for (const text of [error.message, String(error.details.next_step)]) for (let i = 0; i + 6 <= SECRET.length; i++) assert.ok(!text.includes(SECRET.slice(i, i + 6)));
});

test("a single-line field has no line and other kinds keep the generic next step", () => {
  assert.deepEqual(redact({ evidence: `API_KEY=${SECRET}` }).stopped, [{ kind: "secret_assignment", field: "evidence" }]);
  const aws = stopError(redact({ evidence: `x\nAKIA${"A".repeat(16)}` }).stopped);
  assert.match(aws.message, /aws_access_key in evidence, line 2/);
  assert.match(String(aws.details.next_step), /^Remove the credential from the input/);
});

test("decide over the token limit names tokens, the limit and the largest context file; verify names tokens and the limit", async () => {
  const cwd = tempDir();
  mkdirSync(join(cwd, "ctx"));
  for (const [name, size] of [["small.md", 40_000], ["big.md", 90_000]] as const) writeFileSync(join(cwd, "ctx", name), "word ".repeat(size / 5));
  const env = { TYPESAFE_API_KEY: "ts_test", REFEREE_DATA_DIR: tempDir() };
  const decision = JSON.stringify({ decision: "which?", context_files: ["ctx/small.md", "ctx/big.md"], options: [{ name: "A", text: "a" }, { name: "B", text: "b" }] });
  const decide = memoryIo({ env, cwd, stdin: decision });
  assert.equal(await run(["decide"], decide, commands), 1);
  const error = decide.json();
  assert.equal(error["error"], "too_large");
  assert.match(String(error["message"]), /about \d+ tokens, limit 32000/);
  assert.match(String(error["next_step"]), /largest file is ctx\/big\.md \(about \d+ tokens\)/);
  const claims = memoryIo({ env, cwd, stdin: "word ".repeat(40_000) });
  assert.equal(await run(["claims", "--source", "-", "--claim", "x"], claims, commands), 1);
  assert.match(String(claims.json()["message"]), /about \d+ tokens, limit 32000/);
});
