// receipts command: project totals, per-day token rows and export without paths or request text.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

test("receipts sums this project's runs, per day with --tokens, and exports them", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  const cwd = tempDir();
  const env = { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: dataDir };
  try {
    for (const flags of [[], [], ["--fresh"]]) {
      await run(["done", "--criteria", "tests pass", ...flags], memoryIo({ env, cwd, stdin: "PASS private-evidence-text" }), commands);
    }
  } finally {
    await server.close();
  }
  const summary = memoryIo({ env, cwd });
  await run(["receipts"], summary, commands);
  const s = summary.json();
  assert.equal(s["runs"], 3);
  assert.equal(s["requests"], 2);
  assert.equal(s["cached"], 1);
  assert.equal(s["input_tokens"], 200);
  assert.deepEqual(s["by_command"], { done: 3 });

  const other = memoryIo({ env, cwd: tempDir() });
  await run(["receipts"], other, commands);
  assert.equal(other.json()["runs"], 0);

  const tokens = memoryIo({ env, cwd });
  await run(["receipts", "--tokens"], tokens, commands);
  const rows = tokens.json()["rows"] as { command: string; runs: number; fresh_share: number }[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.runs, 3);
  assert.ok(Math.abs((rows[0]?.fresh_share ?? 0) - 0.33) < 0.01);

  const usage = memoryIo({ env: { ...env, CLAUDE_CONFIG_DIR: tempDir() }, cwd });
  await run(["receipts", "--usage"], usage, commands);
  assert.equal(usage.json()["verdict"], "usage");

  const out = join(tempDir(), "receipts.jsonl");
  const exported = memoryIo({ env, cwd });
  await run(["receipts", "export", "--out", out], exported, commands);
  assert.equal(exported.json()["receipts"], 3);
  const text = readFileSync(out, "utf8");
  assert.equal(text.trim().split("\n").length, 3);
  assert.ok(!text.includes("private-evidence-text") && !text.includes(cwd) && !text.includes(dataDir));
});

test("receipts rejects unknown actions and bad --days", async () => {
  const io = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() } });
  assert.equal(await run(["receipts", "delete"], io, commands), 1);
  const days = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() } });
  assert.equal(await run(["receipts", "--days", "0"], days, commands), 1);
});
