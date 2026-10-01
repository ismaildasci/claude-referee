// Transcript marks (truncated checks, subagent reports, a pass from the previous turn) built from shapes seen in real Claude Code transcripts.
// Seen in ~/.claude/projects: Bash results starting "<persisted-output>\nOutput too large (47.9KB). Full output saved to: ...", middle cuts "... [7003 characters truncated] ...", task-notification user entries.

import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeTranscript } from "../src/engine/stopgate/transcript.ts";

const JEST_PASS = "Tests:       5 passed, 5 total\nTest Suites: 1 passed, 1 total\n";
const PERSISTED = "<persisted-output>\nOutput too large (47.9KB). Full output saved to: /Users/x/.claude/projects/p/s/tool-results/bs7crga0q.txt\n\nPreview (first 2KB):\n> app@1.0.0 test\n> jest\n\n...\n</persisted-output>";
const NOTIFICATION = '<task-notification>\n<task-id>a198e0a085d0bd557</task-id>\n<tool-use-id>toolu_01A2VB4urCPeZj8XH29daozv</tool-use-id>\n<output-file>/private/tmp/claude-501/p/s/tasks/a198e0a085d0bd557.output</output-file>\n<status>completed</status>\n<summary>Agent "Review the change" finished</summary>\n<result>No findings.</result>\n<usage><subagent_tokens>200785</subagent_tokens><tool_uses>6</tool_uses><duration_ms>205282</duration_ms></usage>\n</task-notification>';

class T {
  lines: string[] = [];
  private n = 0;
  push(entry: unknown): this {
    this.lines.push(JSON.stringify(entry));
    return this;
  }
  user(text: string): this {
    return this.push({ type: "user", isSidechain: false, message: { role: "user", content: text } });
  }
  notify(text = NOTIFICATION): this {
    return this.push({ type: "user", isSidechain: false, promptSource: "system", origin: { kind: "task-notification" }, message: { role: "user", content: text } });
  }
  say(text: string): this {
    return this.push({ type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "text", text }] } });
  }
  tool(name: string, input: Record<string, unknown>, content: string, error = false, toolUseResult?: unknown): this {
    const id = `toolu_${++this.n}`;
    this.push({ type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
    const block: Record<string, unknown> = { type: "tool_result", tool_use_id: id, content };
    if (error) block["is_error"] = true;
    return this.push({ type: "user", isSidechain: false, ...(toolUseResult ? { toolUseResult } : {}), message: { role: "user", content: [block] } });
  }
  edit(path: string): this {
    return this.tool("Edit", { file_path: path, old_string: "a", new_string: "b" }, "ok");
  }
  bash(command: string, content: string, error = false): this {
    return this.tool("Bash", { command }, content, error);
  }
  text(): string {
    return this.lines.join("\n") + "\n";
  }
}

test("a persisted (cut to a preview) Bash result never counts as a passing check", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npx tsc --noEmit", PERSISTED).say("done").text());
  assert.deepEqual(f.checks, [{ cmd: "npx tsc --noEmit", status: "unknown", truncated: true }]);
  assert.equal(f.passedCheckAfterLastEdit, false);
  assert.equal(f.marks.truncatedChecks, 1);
});

test("a preview that holds a passing summary is still not proof", () => {
  const preview = `<persisted-output>\nOutput too large (31.2KB). Full output saved to: /x/y.txt\n\nPreview (first 2KB):\n${JEST_PASS}\n...\n</persisted-output>`;
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", preview).text());
  assert.equal(f.checks[0]?.status, "unknown");
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("a middle cut (characters or lines) with a passing summary at the tail does not pass", () => {
  for (const marker of ["... [7003 characters truncated] ...", "... [100 lines truncated] ..."]) {
    const out = `start of log\n\n${marker}\n\n${JEST_PASS}`;
    const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", out).text());
    assert.equal(f.checks[0]?.status, "unknown", marker);
    assert.equal(f.passedCheckAfterLastEdit, false, marker);
  }
});

test("a silent check moved to the background after its timeout is not a pass", () => {
  const moved = "Command did not complete within its 120s timeout and was moved to the background (ID: bkpygba5c). Output is being written to: /private/tmp/x/tasks/bkpygba5c.output. You will be notified when it completes.";
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm run typecheck", moved).text());
  assert.equal(f.checks[0]?.status, "unknown");
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("truncation only removes a pass: a failure stays failed and is flagged", () => {
  const out = `Exit code 1\n\n... [7003 characters truncated] ...\n\nTests:       1 failed, 4 passed, 5 total\n`;
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", out, true).text());
  assert.deepEqual(f.checks, [{ cmd: "npm test", status: "failed", truncated: true }]);
});

test("an untruncated pass is unchanged, and a later full pass after a truncated one counts", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", PERSISTED).bash("npm test", JEST_PASS).text());
  assert.deepEqual(f.checks.map((c) => c.status), ["unknown", "passed"]);
  assert.equal(f.passedCheckAfterLastEdit, true);
  assert.equal(f.marks.truncatedChecks, 1);
  assert.equal(f.checks[1] && "truncated" in f.checks[1], false);
});

test("text that only mentions a marker mid-sentence outside a result shape is not a truncation", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", `${JEST_PASS}note: the word persisted-output appears here and 5 lines truncated too`).text());
  assert.equal(f.checks[0]?.status, "passed");
  assert.equal(f.marks.truncatedChecks, 0);
});

test("an Agent launch is counted, is not a check and does not change what passed", () => {
  const launched = { isAsync: true, status: "async_launched", agentId: "a82c34f45b22254a4", description: "Review API-3", resolvedModel: "claude-sonnet-5", outputFile: "/private/tmp/x/tasks/a82c34f45b22254a4.output", canReadOutputFile: true };
  const t = new T().user("go").edit("/a.ts").tool("Agent", { description: "Review API-3", subagent_type: "general-purpose", prompt: "run the tests and report" }, "Async agent launched successfully.\nagentId: a82c34f45b22254a4", false, launched).say("A reviewer is checking it.");
  const f = analyzeTranscript(t.text());
  assert.equal(f.marks.subagentCalls, 1);
  assert.deepEqual(f.checks, []);
  assert.equal(f.passedCheckAfterLastEdit, false);
  assert.deepEqual(f.edits, ["/a.ts"]);
});

test("a task-notification is not a user prompt: the turn keeps its edits and counts the report", () => {
  const t = new T().user("fix the bug").edit("/a.ts").say("launched a reviewer").notify().say("the reviewer found nothing, all done");
  const f = analyzeTranscript(t.text());
  assert.deepEqual(f.edits, ["/a.ts"]);
  assert.equal(f.marks.subagentReports, 1);
  assert.equal(f.finalMessage, "the reviewer found nothing, all done");
  assert.equal(f.task, "fix the bug");
});

test("a background-command notification (string content, origin task-notification) does not start a turn either", () => {
  const note = '<task-notification>\n<task-id>bfw8s0ihw</task-id>\n<status>completed</status>\n<summary>Background command "npm test" completed (exit code 0)</summary>\n</task-notification>';
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").notify(note).text());
  assert.deepEqual(f.edits, ["/a.ts"]);
});

test("a notification is recognised by its text even when origin is missing, but typed text about it is a prompt", () => {
  const t = new T().user("go").edit("/a.ts").push({ type: "user", message: { role: "user", content: NOTIFICATION } });
  assert.deepEqual(analyzeTranscript(t.text()).edits, ["/a.ts"]);
  const typed = new T().user("go").edit("/a.ts").user("what does a task-notification look like?").edit("/b.ts");
  assert.deepEqual(analyzeTranscript(typed.text()).edits, ["/b.ts"]);
});

test("a passing check in the previous turn is marked stale when this turn edited and has none", () => {
  const t = new T().user("first").edit("/a.ts").bash("npm test", JEST_PASS).say("tests pass").user("also rename it").edit("/b.ts").say("renamed, tests pass");
  const f = analyzeTranscript(t.text());
  assert.equal(f.passedCheckAfterLastEdit, false);
  assert.equal(f.marks.stalePass, true);
});

test("no stale mark when the previous pass was before that turn's own last edit, or the turn has its own pass", () => {
  const before = new T().user("first").bash("npm test", JEST_PASS).edit("/a.ts").say("edited").user("second").edit("/b.ts").say("done");
  assert.equal(analyzeTranscript(before.text()).marks.stalePass, false);
  const own = new T().user("first").edit("/a.ts").bash("npm test", JEST_PASS).user("second").edit("/b.ts").bash("npm test", JEST_PASS);
  const f = analyzeTranscript(own.text());
  assert.equal(f.passedCheckAfterLastEdit, true);
  assert.equal(f.marks.stalePass, false);
});

test("a previous turn without edits that ran a passing check also marks the pass as earlier", () => {
  const t = new T().user("run the tests").bash("npm test", JEST_PASS).say("they pass").user("rename x").edit("/b.ts").say("done, tests pass");
  assert.equal(analyzeTranscript(t.text()).marks.stalePass, true);
});

test("marks never turn a turn into a skip: no mark changes passedCheckAfterLastEdit", () => {
  const t = new T().user("first").edit("/a.ts").bash("npm test", JEST_PASS).say("ok").user("second").edit("/b.ts").tool("Agent", { prompt: "x" }, "launched").notify().say("done");
  const f = analyzeTranscript(t.text());
  assert.equal(f.passedCheckAfterLastEdit, false);
  assert.deepEqual(f.marks, { truncatedChecks: 0, subagentCalls: 1, subagentReports: 1, stalePass: true });
});
