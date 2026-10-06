// receipts command: project totals, per-day token rows and export without paths or request text.

import assert from "node:assert/strict";
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { projectId } from "../src/engine/datadir.ts";
import { appendReceipt, overruleReceipt, readOverruled, readReceipts, type Receipt } from "../src/engine/receipts.ts";
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

test("receipts verify checks the chain and overrule voids cached answers", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  const cwd = tempDir();
  const env = { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: dataDir };
  const doneRun = () => run(["done", "--criteria", "tests pass"], memoryIo({ env, cwd, stdin: "PASS ok" }), commands);
  try {
    await doneRun();
    await doneRun();
    const ok = memoryIo({ env, cwd });
    await run(["receipts", "verify"], ok, commands);
    assert.equal(ok.json()["verdict"], "chain_ok");
    assert.deepEqual(ok.json()["chain"], { receipts: 2, chained: 1, unchained: 1, breaks: [] });

    const first = readReceipts(dataDir)[0];
    assert.ok(first?.cache_keys?.length);
    const cacheFile = join(dataDir, "cache", `${first.cache_keys[0]}.json`);
    assert.ok(existsSync(cacheFile));
    const over = memoryIo({ env, cwd });
    await run(["receipts", "overrule", first.id], over, commands);
    assert.equal(over.json()["verdict"], "overruled");
    assert.equal(over.json()["dropped"], 1);
    assert.ok(!existsSync(cacheFile));
    assert.match(readFileSync(join(dataDir, "overruled.jsonl"), "utf8"), new RegExp(first.id));
    const missing = memoryIo({ env, cwd });
    assert.equal(await run(["receipts", "overrule", "nope"], missing, commands), 1);
  } finally {
    await server.close();
  }
  const projectDir = join(dataDir, "receipts", readdirSync(join(dataDir, "receipts"))[0] ?? "");
  const file = join(projectDir, readdirSync(projectDir)[0] ?? "");
  const lines = readFileSync(file, "utf8").trim().split("\n");
  writeFileSync(file, [lines[0]?.replace('"requests":1', '"requests":9'), lines[1]].join("\n") + "\n");
  const broken = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  assert.equal(await run(["receipts", "verify", "--fail-on", "chain_broken"], broken, commands), 3);
  const report = broken.json();
  assert.equal(report["verdict"], "chain_broken");
  assert.equal(((report["chain"] as { breaks: { kind: string }[] }).breaks[0])?.kind, "mismatch");
});

test("receipt lines that are not objects with a string id and ts are skipped, and one torn overrule line voids nothing else", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const project = projectId(cwd);
  const base = (id: string): Receipt => ({ id, ts: "2026-09-30T10:00:00.000Z", command: "done", project, requests: 1, cached: 0, input_tokens: 100, cost_usd: 0.0000042, ms: 5 });
  appendReceipt(dataDir, base("rGood1"));
  appendFileSync(join(dataDir, "receipts", project, "2026-09.jsonl"), 'null\n3\n"x"\n[1]\n{}\n{"ts":{}}\n{"id":"rNoTs"}\n{"id":5,"ts":"2026-09-30T10:00:00.000Z"}\n');
  appendReceipt(dataDir, base("rGood2"));
  assert.deepEqual(readReceipts(dataDir).map((r) => r.id), ["rGood1", "rGood2"]);
  const env = { REFEREE_DATA_DIR: dataDir };
  const summary = memoryIo({ env, cwd });
  assert.equal(await run(["receipts"], summary, commands), 0);
  assert.deepEqual([summary.json()["ok"], summary.json()["runs"]], [true, 2]);
  const tokens = memoryIo({ env, cwd });
  assert.equal(await run(["receipts", "--tokens"], tokens, commands), 0, JSON.stringify(tokens.json()));
  const over = memoryIo({ env, cwd });
  await run(["receipts", "overrule", "rGood2"], over, commands);
  assert.equal(over.json()["verdict"], "overruled");

  const file = join(dataDir, "overruled.jsonl");
  writeFileSync(file, '{"id":"r1","ts":"x"}\nnull\n{"id":"r2","ts"\n{"id":"rGood1","ts":"y"}\n');
  assert.deepEqual([...readOverruled(dataDir)].sort(), ["r1", "rGood1"]);
  const before = readFileSync(file, "utf8").trim().split("\n").length;
  overruleReceipt(dataDir, "rGood1", "2026-09-30T11:00:00.000Z");
  assert.equal(readFileSync(file, "utf8").trim().split("\n").length, before);
});
