// Data directory order, project id and receipts storage.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { dirSize, pluginDataId, projectId, resolveDataDir, tildify } from "../src/engine/datadir.ts";
import { appendReceipt, newReceiptId, readReceipts, type Receipt } from "../src/engine/receipts.ts";
import { tempDir } from "./helpers.ts";

test("datadir order: flag, CLAUDE_PLUGIN_DATA, REFEREE_DATA_DIR, default", () => {
  const home = "/home/u";
  assert.equal(resolveDataDir({ CLAUDE_PLUGIN_DATA: "/a", REFEREE_DATA_DIR: "/b" }, home, "/w", "x"), "/w/x");
  assert.equal(resolveDataDir({ CLAUDE_PLUGIN_DATA: "/a", REFEREE_DATA_DIR: "/b" }, home, "/w"), "/a");
  assert.equal(resolveDataDir({ REFEREE_DATA_DIR: "/b" }, home, "/w"), "/b");
  assert.equal(resolveDataDir({}, home, "/w"), "/home/u/.claude/plugins/data/claude-referee-claude-referee");
  assert.equal(resolveDataDir({ CLAUDE_CONFIG_DIR: "/cfg" }, home, "/w"), "/cfg/plugins/data/claude-referee-claude-referee");
  assert.equal(pluginDataId(), "claude-referee-claude-referee");
});

test("datadir project id is a stable 12-character hash", () => {
  const dir = tempDir();
  const id = projectId(dir);
  assert.match(id, /^[0-9a-f]{12}$/);
  assert.equal(projectId(dir), id);
  assert.notEqual(projectId(tempDir()), id);
});

test("datadir size counts nested files and tildify hides the home path", () => {
  const dir = tempDir();
  mkdirSync(join(dir, "a/b"), { recursive: true });
  writeFileSync(join(dir, "a/b/f.txt"), "12345");
  writeFileSync(join(dir, "g.txt"), "123");
  assert.equal(dirSize(dir), 8);
  assert.equal(dirSize(join(dir, "missing")), 0);
  assert.equal(tildify("/home/u/.claude/x", "/home/u"), "~/.claude/x");
});

test("receipts append by project and month and read back", () => {
  const dataDir = tempDir();
  const base = { command: "done", project: "abc123abc123", requests: 1, cached: 0, input_tokens: 120, cost_usd: 0.000005, ms: 12 };
  const r1: Receipt = { ...base, id: newReceiptId(1, () => 0.5), ts: "2026-09-30T10:00:00.000Z" };
  const r2: Receipt = { ...base, id: newReceiptId(2, () => 0.5), ts: "2026-10-01T10:00:00.000Z", project: "def456def456" };
  appendReceipt(dataDir, r1);
  appendReceipt(dataDir, r2);
  assert.deepEqual(readdirSync(join(dataDir, "receipts/abc123abc123")), ["2026-09.jsonl"]);
  assert.equal(readReceipts(dataDir).length, 2);
  assert.equal(readReceipts(dataDir, "abc123abc123")[0]?.id, r1.id);
  assert.ok(!readFileSync(join(dataDir, "receipts/abc123abc123/2026-09.jsonl"), "utf8").includes(dataDir));
});

test("receipts ids are short and sortable by time", () => {
  assert.match(newReceiptId(1_790_000_000_000), /^r[0-9a-z]{12}$/);
  assert.ok(newReceiptId(1_790_000_000_000, () => 0) < newReceiptId(1_790_000_000_001, () => 0));
});
