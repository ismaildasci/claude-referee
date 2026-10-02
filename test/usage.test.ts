// receipts --usage: claude-referee CLI calls counted from Claude Code transcripts, by command position.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { cliCallsIn } from "../src/engine/usage.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const CLI = "/Users/someone/.claude/plugins/cache/claude-referee/claude-referee/0.1.1/dist/cli.mjs";

test("cliCallsIn counts claude-referee and the short-lived evidence-referee", () => {
  const cli = "/Users/someone/.claude/plugins/cache/evidence-referee/evidence-referee/0.1.7/dist/cli.mjs";
  assert.deepEqual(cliCallsIn("npx evidence-referee receipts --tokens"), ["receipts"]);
  assert.deepEqual(cliCallsIn("evidence-referee done --criteria x; claude-referee judge --question q"), ["done", "judge"]);
  assert.deepEqual(cliCallsIn(`node "${cli}" decide`), ["decide"]);
  assert.deepEqual(cliCallsIn("grep -rn evidence-referee README.md"), []);
});

test("cliCallsIn counts the CLI only in command position", () => {
  assert.deepEqual(cliCallsIn("grep -rn claude-referee README.md"), []);
  assert.deepEqual(cliCallsIn("cd /tmp && echo claude-referee is installed"), []);
  assert.deepEqual(cliCallsIn(`node "${CLI}" done --criteria "tests pass" --evidence -`), ["done"]);
  assert.deepEqual(cliCallsIn(`npm test 2>&1 | node ${CLI} done --criteria x`), ["done"]);
  assert.deepEqual(cliCallsIn("npx claude-referee receipts --tokens"), ["receipts"]);
  assert.deepEqual(cliCallsIn("npx --yes --package https://example.com/claude-referee-0.1.0.tgz claude-referee doctor"), ["doctor"]);
  assert.deepEqual(cliCallsIn("FOO=1 claude-referee verify --source a.md --claim x; claude-referee judge --question q"), ["verify", "judge"]);
  assert.deepEqual(cliCallsIn(`node "${CLI}" decide <<'EOF'\nclaude-referee judge is mentioned here\nEOF\necho ok`), ["decide"]);
  assert.deepEqual(cliCallsIn('node "/work/other-tool/dist/cli.mjs" build'), []);
});

function transcriptLine(value: unknown): string {
  return JSON.stringify(value) + "\n";
}

const use = (id: string, command: string, ts: string) => ({ type: "assistant", timestamp: ts, message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
const result = (id: string, text: string, ts: string) => ({ type: "user", timestamp: ts, message: { content: [{ type: "tool_result", tool_use_id: id, content: text }] } });

function fixture(): { configDir: string; cwd: string } {
  const configDir = tempDir("referee-config-");
  const cwd = tempDir("referee-proj-");
  const dir = join(configDir, "projects", cwd.replace(/[^A-Za-z0-9]/g, "-"));
  mkdirSync(join(dir, "s1", "subagents"), { recursive: true });
  writeFileSync(
    join(dir, "s1.jsonl"),
    [
      transcriptLine(use("t1", "grep -rn claude-referee docs/", "2026-09-30T10:00:00Z")),
      transcriptLine(result("t1", "docs/a.md: private transcript text", "2026-09-30T10:00:01Z")),
      transcriptLine(use("t2", `npm test 2>&1 | node "${CLI}" done --criteria "tests pass" --evidence -`, "2026-09-30T10:01:00Z")),
      transcriptLine(result("t2", '{"ok":true,"verdict":"met"}', "2026-09-30T10:01:02Z")),
      transcriptLine(use("t2", `npm test 2>&1 | node "${CLI}" done --criteria "tests pass" --evidence -`, "2026-09-30T10:01:00Z")),
      "not json\n",
    ].join(""),
  );
  writeFileSync(
    join(dir, "s1", "subagents", "agent-1.jsonl"),
    [transcriptLine(use("t3", `node "${CLI}" done --criteria x`, "2026-09-30T11:00:00Z")), transcriptLine(result("t3", '{"ok":true,"verdict":"missing"}', "2026-09-30T11:00:01Z"))].join(""),
  );
  return { configDir, cwd };
}

test("receipts --usage counts CLI calls from transcripts, subagents included, each tool call once", async () => {
  const { configDir, cwd } = fixture();
  const env = { CLAUDE_CONFIG_DIR: configDir, REFEREE_DATA_DIR: tempDir() };
  const io = { ...memoryIo({ env, cwd }), now: () => Date.parse("2026-10-01T00:00:00Z") };
  assert.equal(await run(["receipts", "--usage"], io, commands), 0);
  const out = io.json();
  assert.equal(out["verdict"], "usage");
  assert.deepEqual(out["rows"], [{ day: "2026-09-30", command: "done", calls: 2, subagent_calls: 1, result_chars: 58 }]);
  const line = io.out.join("");
  assert.ok(!line.includes("private transcript text") && !line.includes(cwd) && !line.includes(configDir));

  const again = { ...memoryIo({ env, cwd }), now: () => Date.parse("2026-10-01T00:00:00Z") };
  await run(["receipts", "--usage"], again, commands);
  assert.equal(again.out.join(""), line);
});

test("receipts --usage reports zero calls when there are no transcripts", async () => {
  const io = memoryIo({ env: { CLAUDE_CONFIG_DIR: tempDir(), REFEREE_DATA_DIR: tempDir() }, cwd: tempDir() });
  assert.equal(await run(["receipts", "--usage"], io, commands), 0);
  assert.deepEqual(io.json()["rows"], []);
  assert.equal(io.json()["transcripts"], 0);
});
