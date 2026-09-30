// Output contract: rounding, field order, details file and exit codes.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run } from "../src/cli/run.ts";
import type { Command } from "../src/cli/types.ts";
import { RefereeError } from "../src/engine/errors.ts";
import { render, renderError, roundDeep } from "../src/engine/output.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const describe = { summary: "test", inputs: {}, outputs: {}, errors: [], effects: "none", cost: "none" };

function fixed(result: Record<string, unknown>): Command {
  return { name: "fixed", describe, options: { mode: { type: "string" } }, run: async () => result };
}

test("output rounds floats to two digits and keeps _usd precision", () => {
  assert.deepEqual(roundDeep({ p: 0.123456, n: 3, cost_usd: 0.0000421234 }), { p: 0.12, n: 3, cost_usd: 0.000042 });
});

test("output is one minified line and drops undefined fields", () => {
  assert.equal(render({ ok: true, verdict: "met", p: 0.914, skip: undefined, receipt: "r1" }), '{"ok":true,"verdict":"met","p":0.91,"receipt":"r1"}');
});

test("output moves long results to a details file and keeps scalars", () => {
  const dir = tempDir();
  const line = render({ ok: true, verdict: "flagged", items: Array.from({ length: 400 }, (_, i) => `item-${i}`), receipt: "r2" }, { detailsDir: dir, receipt: "r2" });
  const parsed = JSON.parse(line) as Record<string, unknown>;
  assert.equal(parsed["verdict"], "flagged");
  assert.equal(parsed["details"], join(dir, "r2.json"));
  assert.ok(line.length < 400);
  assert.ok(existsSync(join(dir, "r2.json")));
  assert.equal((JSON.parse(readFileSync(join(dir, "r2.json"), "utf8")) as { items: unknown[] }).items.length, 400);
});

test("error envelope stays under 2,000 characters", () => {
  const text = renderError(new RefereeError("bad_input", "x".repeat(5000), { next_step: "y".repeat(5000) }));
  assert.ok(text.length < 2000);
  assert.equal((JSON.parse(text) as { error: string }).error, "bad_input");
});

test("a negative verdict exits 0 and --fail-on exits 3", async () => {
  const command = fixed({ ok: true, verdict: "missing" });
  assert.equal(await run(["fixed"], memoryIo(), [command]), 0);
  assert.equal(await run(["fixed", "--fail-on", "missing,unsure"], memoryIo(), [command]), 3);
  assert.equal(await run(["fixed", "--fail-on", "unsure"], memoryIo(), [command]), 0);
});

test("unknown commands and flags are errors with exit 1", async () => {
  const io = memoryIo();
  assert.equal(await run(["nope"], io, []), 1);
  assert.equal(io.json()["error"], "bad_input");
  const io2 = memoryIo();
  assert.equal(await run(["fixed", "--no-such-flag"], io2, [fixed({ ok: true })]), 1);
  assert.equal(io2.json()["error"], "bad_input");
});

test("--describe prints JSON without running the command", async () => {
  const io = memoryIo();
  const command: Command = { name: "boom", describe, options: {}, run: async () => { throw new Error("ran"); } };
  assert.equal(await run(["boom", "--describe"], io, [command]), 0);
  assert.equal(io.json()["command"], "boom");
});
