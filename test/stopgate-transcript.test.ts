// analyzeTranscript: current-turn facts from synthetic Claude Code transcripts (edits, checks, statuses, robustness, speed).

import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeTranscript, currentTurn, scanLength, userPrompts } from "../src/engine/stopgate/transcript.ts";

const JEST_PASS = "Tests:       5 passed, 5 total\nTest Suites: 1 passed, 1 total\n";
const JEST_FAIL = "Tests:       1 failed, 4 passed, 5 total\nTest Suites: 1 failed, 1 total\n";

class T {
  lines: string[] = [];
  private n = 0;
  push(entry: unknown): this {
    this.lines.push(JSON.stringify(entry));
    return this;
  }
  user(text: string, extra: Record<string, unknown> = {}): this {
    return this.push({ type: "user", isSidechain: false, message: { role: "user", content: text }, ...extra });
  }
  say(text: string, extra: Record<string, unknown> = {}): this {
    return this.push({ type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "text", text }] }, ...extra });
  }
  tool(name: string, input: Record<string, unknown>, result?: { content: unknown; error?: boolean }, extra: Record<string, unknown> = {}): this {
    const id = `toolu_${++this.n}`;
    this.push({ type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] }, ...extra });
    if (result) {
      const block: Record<string, unknown> = { type: "tool_result", tool_use_id: id, content: result.content };
      if (result.error !== undefined) block["is_error"] = result.error;
      this.push({ type: "user", isSidechain: false, message: { role: "user", content: [block] }, ...extra });
    }
    return this;
  }
  edit(path: string): this {
    return this.tool("Edit", { file_path: path, old_string: "a", new_string: "b" }, { content: "ok" });
  }
  bash(command: string, content: string, error = false): this {
    return this.tool("Bash", { command }, { content, error });
  }
  text(): string {
    return this.lines.join("\n") + "\n";
  }
}

const statuses = (t: T) => analyzeTranscript(t.text()).checks.map((c) => c.status);

test("passing turn: edits then a passing test", () => {
  const f = analyzeTranscript(new T().user("fix the bug").edit("/a.ts").edit("/b.ts").bash("npm test", JEST_PASS).say("done").text());
  assert.deepEqual(f.edits, ["/a.ts", "/b.ts"]);
  assert.deepEqual(f.checks, [{ cmd: "npm test", status: "passed" }]);
  assert.equal(f.passedCheckAfterLastEdit, true);
  assert.equal(f.task, "fix the bug");
  assert.equal(f.finalMessage, "done");
});

test("failing test after edit", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npx jest", JEST_FAIL, true).text());
  assert.deepEqual(f.checks.map((c) => c.status), ["failed"]);
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("edits without any check", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").say("all good").text());
  assert.deepEqual(f.edits, ["/a.ts"]);
  assert.deepEqual(f.checks, []);
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("no edits at all: a passing check does not count", () => {
  const f = analyzeTranscript(new T().user("run tests").bash("npm test", JEST_PASS).text());
  assert.deepEqual(f.edits, []);
  assert.equal(f.checks.length, 1);
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("check before the last edit only", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", JEST_PASS).edit("/b.ts").text());
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("check passed then another edit of the same file", () => {
  const f = analyzeTranscript(new T().user("go").edit("/a.ts").bash("npm test", JEST_PASS).edit("/a.ts").text());
  assert.deepEqual(f.edits, ["/a.ts"]);
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("several checks mixed", () => {
  const t = new T().user("go").edit("/a.ts").bash("npm test", JEST_FAIL, true).edit("/a.ts").bash("npm test", JEST_PASS).bash("pnpm run lint", "weird output");
  const f = analyzeTranscript(t.text());
  assert.deepEqual(f.checks.map((c) => c.status), ["failed", "passed", "unknown"]);
  assert.equal(f.passedCheckAfterLastEdit, true);
});

test("tsc silent success with exit code 0", () => {
  assert.deepEqual(statuses(new T().user("go").edit("/a.ts").bash("npx tsc --noEmit", "")), ["passed"]);
  assert.deepEqual(statuses(new T().user("go").bash("npm run typecheck", "Exit code 0")), ["passed"]);
});

test("tsc error", () => {
  const out = "Exit code 2\nsrc/a.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.\n";
  assert.deepEqual(statuses(new T().user("go").edit("/a.ts").bash("npx tsc --noEmit", out, true)), ["failed"]);
  assert.deepEqual(statuses(new T().user("go").bash("tsc", "src/a.ts(1,1): error TS2322: bad")), ["failed"]);
});

test("silent success is refused when the output holds a failure marker or the exit is masked", () => {
  assert.deepEqual(statuses(new T().user("go").bash("npx eslint .", "1 problem (1 error, 0 warnings)")), ["unknown"]);
  assert.deepEqual(statuses(new T().user("go").bash("npx tsc | head", "")), ["unknown"]);
  assert.deepEqual(statuses(new T().user("go").bash("cargo check", "")), ["passed"]);
  assert.deepEqual(statuses(new T().user("go").bash("go vet ./...", "")), ["passed"]);
});

test("nonzero exit code in the text is a failure even when not flagged as error", () => {
  assert.deepEqual(statuses(new T().user("go").bash("make test", "something\nexit code 2")), ["failed"]);
  assert.deepEqual(statuses(new T().user("go").bash("make test", "something\nexit code 0")), ["passed"]);
});

test("non-check Bash commands are ignored", () => {
  const t = new T().user("go").bash("ls -la", "x").bash("git status", "clean").bash("cat package.json", "{}").bash("node script.mjs", "ok");
  assert.deepEqual(analyzeTranscript(t.text()).checks, []);
});

test("a check named inside echo, a commit message or a path is not a check", () => {
  const t = new T()
    .user("go")
    .bash('echo "npm test"', "npm test")
    .bash('git commit -m "run npm test and tsc"', "ok")
    .bash("grep -rn 'pytest' .", "x")
    .bash("cat <<'EOF'\nnpm test\nEOF", "npm test")
    .bash("cat npm-test.log", "x");
  assert.deepEqual(analyzeTranscript(t.text()).checks, []);
});

test("checks are found in command position after separators, assignments and wrappers", () => {
  const cmds = ["cd app && npm test", "CI=1 pnpm test", "git add . ; cargo test", "time go test ./...", "(cd x; make lint)", "./vendor/bin/phpunit --filter X", "python3 -m pytest -q", "bunx vitest run", "pnpm exec eslint .", "dotnet test", "mvn clean test", "./gradlew check", "bundle x; rspec", "npx playwright test", "yarn build", "rake test", "ruff check .", "mypy src"];
  const t = new T().user("go");
  for (const c of cmds) t.bash(c, "");
  assert.equal(analyzeTranscript(t.text()).checks.length, cmds.length);
});

test("commands that look similar but are not checks", () => {
  const cmds = ["npm install", "npm run dev", "cargo run", "go run .", "make deploy", "ruff format .", "git test", "python script.py", "npx prettier --write ."];
  const t = new T().user("go");
  for (const c of cmds) t.bash(c, "");
  assert.deepEqual(analyzeTranscript(t.text()).checks, []);
});

test("tool_result errors mark the check failed", () => {
  assert.deepEqual(statuses(new T().user("go").bash("pytest", "no summary here", true)), ["failed"]);
});

test("check without a tool_result stays unknown", () => {
  const t = new T().user("go").edit("/a.ts").tool("Bash", { command: "npm test" });
  assert.deepEqual(analyzeTranscript(t.text()).checks, [{ cmd: "npm test", status: "unknown" }]);
});

test("conflicting summaries are not passed", () => {
  assert.notEqual(statuses(new T().user("go").bash("npm test", "Tests:       1 failed, 4 passed, 5 total\nexit code 0"))[0], "passed");
});

test("sidechain entries are ignored", () => {
  const t = new T().user("go").edit("/a.ts");
  t.push({ type: "user", isSidechain: true, message: { role: "user", content: "subagent prompt" } });
  t.tool("Edit", { file_path: "/side.ts" }, { content: "ok" }, { isSidechain: true });
  t.tool("Bash", { command: "npm test" }, { content: JEST_PASS }, { isSidechain: true });
  t.say("sidechain words", { isSidechain: true });
  t.say("main words");
  const f = analyzeTranscript(t.text());
  assert.deepEqual(f.edits, ["/a.ts"]);
  assert.deepEqual(f.checks, []);
  assert.equal(f.finalMessage, "main words");
  assert.equal(f.passedCheckAfterLastEdit, false);
});

test("sidechain first prompt does not become the task", () => {
  const t = new T();
  t.push({ type: "user", isSidechain: true, message: { role: "user", content: "subagent" } });
  t.user("the real task");
  assert.equal(analyzeTranscript(t.text()).task, "the real task");
});

test("meta and system messages are not user prompts", () => {
  const t = new T().user("first").edit("/old.ts").user("meta text", { isMeta: true }).push({ type: "system", content: "hook output" }).user("<local-command-stdout>x</local-command-stdout>").edit("/new.ts");
  const f = analyzeTranscript(t.text());
  assert.deepEqual(f.edits, ["/old.ts", "/new.ts"]);
  assert.equal(f.task, "first");
});

test("the turn starts at the last real prompt, after tool_result user messages", () => {
  const t = new T().user("first task").edit("/old.ts").bash("npm test", JEST_PASS).say("done one").user("second prompt").edit("/new.ts").bash("npm test", JEST_FAIL, true).say("tests fail");
  const f = analyzeTranscript(t.text());
  assert.equal(f.task, "first task");
  assert.deepEqual(f.edits, ["/new.ts"]);
  assert.deepEqual(f.checks.map((c) => c.status), ["failed"]);
  assert.equal(f.finalMessage, "tests fail");
});

test("a prompt given as text blocks counts as real", () => {
  const t = new T().user("first").edit("/old.ts");
  t.push({ type: "user", message: { role: "user", content: [{ type: "text", text: "second" }] } });
  t.edit("/new.ts");
  assert.deepEqual(analyzeTranscript(t.text()).edits, ["/new.ts"]);
});

const IMAGE = { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } };

test("an image-only prompt starts a new turn; the task stays the first text prompt", () => {
  for (const content of [[IMAGE], [IMAGE, { type: "text", text: "" }], [{ type: "text", text: "  " }, IMAGE]]) {
    const t = new T().user("first task").edit("/old.ts").say("Fixed.");
    t.push({ type: "user", isSidechain: false, message: { role: "user", content } });
    t.say("The screenshot shows the dashboard.");
    const f = analyzeTranscript(t.text());
    assert.deepEqual(f.edits, [], JSON.stringify(content));
    assert.equal(f.task, "first task");
    assert.equal(f.finalMessage, "The screenshot shows the dashboard.");
  }
  const first = new T().push({ type: "user", message: { role: "user", content: [IMAGE] } }).user("now fix it").edit("/a.ts");
  assert.equal(analyzeTranscript(first.text()).task, "now fix it");
});

test("a pasted image with its [Image #1] text is a prompt; an image inside a tool_result is not", () => {
  const t = new T().user("first").edit("/old.ts");
  t.push({ type: "user", message: { role: "user", content: [{ type: "text", text: "[Image #1]" }, IMAGE] } });
  t.edit("/new.ts");
  assert.deepEqual(analyzeTranscript(t.text()).edits, ["/new.ts"]);
  const read = new T().user("go").edit("/a.ts").tool("Read", { file_path: "/shot.png" }, { content: [IMAGE] }).edit("/b.ts");
  assert.deepEqual(analyzeTranscript(read.text()).edits, ["/a.ts", "/b.ts"]);
});

test("userPrompts lists an image-only prompt with empty text", () => {
  const t = new T().user("fix it", { timestamp: "2026-10-01T10:00:00.000Z" });
  t.push({ type: "user", timestamp: "2026-10-01T10:05:00.000Z", message: { role: "user", content: [IMAGE] } });
  assert.deepEqual(userPrompts(t.text()), [
    { ts: "2026-10-01T10:00:00.000Z", text: "fix it" },
    { ts: "2026-10-01T10:05:00.000Z", text: "" },
  ]);
});

test("Write, MultiEdit and NotebookEdit paths are collected, paths only and distinct", () => {
  const t = new T().user("go");
  t.tool("Write", { file_path: "/w.ts", content: "SECRET" }, { content: "ok" });
  t.tool("MultiEdit", { file_path: "/m.ts", edits: [] }, { content: "ok" });
  t.tool("NotebookEdit", { notebook_path: "/n.ipynb", new_source: "x" }, { content: "ok" });
  t.edit("/w.ts");
  t.tool("Read", { file_path: "/r.ts" }, { content: "x" });
  const f = analyzeTranscript(t.text());
  assert.deepEqual(f.edits, ["/w.ts", "/m.ts", "/n.ipynb"]);
  assert.ok(!JSON.stringify(f).includes("SECRET"));
});

test("task is clipped to 1500 chars from the start, final message to 2000 from the end, cmd to 200", () => {
  const long = "x".repeat(3000);
  const t = new T().user("S" + long).edit("/a.ts").bash("npm test -- " + "y".repeat(500), JEST_PASS).say(long + "END");
  const f = analyzeTranscript(t.text());
  assert.equal(f.task.length, 1500);
  assert.ok(f.task.startsWith("S"));
  assert.equal(f.finalMessage.length, 2000);
  assert.ok(f.finalMessage.endsWith("END"));
  assert.equal(f.checks[0]?.cmd.length, 200);
});

test("malformed lines are skipped and a truncated last line is tolerated", () => {
  const good = new T().user("go").edit("/a.ts").bash("npm test", JEST_PASS);
  const text = good.text() + "{not json}\n\n[1,2]\nnull\n" + '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t9","name":"Edit","input":{"file_pa';
  const f = analyzeTranscript(text);
  assert.deepEqual(f.edits, ["/a.ts"]);
  assert.equal(f.passedCheckAfterLastEdit, true);
});

test("a truncated tail with no trailing newline and a cut tool_result", () => {
  const t = new T().user("go").edit("/a.ts").tool("Bash", { command: "npm test" });
  const f = analyzeTranscript(t.text() + '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_');
  assert.deepEqual(f.checks, [{ cmd: "npm test", status: "unknown" }]);
});

test("empty and garbage input", () => {
  const empty = { task: "", finalMessage: "", edits: [], checks: [], passedCheckAfterLastEdit: false, marks: { truncatedChecks: 0, subagentCalls: 0, subagentReports: 0, stalePass: false } };
  assert.deepEqual(analyzeTranscript(""), empty);
  assert.deepEqual(analyzeTranscript("\n\n\n"), empty);
  assert.deepEqual(analyzeTranscript("garbage\nmore garbage"), empty);
  assert.doesNotThrow(() => analyzeTranscript(undefined as unknown as string));
});

test("a transcript without any real prompt is analysed from the start", () => {
  const f = analyzeTranscript(new T().edit("/a.ts").bash("npm test", JEST_PASS).text());
  assert.equal(f.task, "");
  assert.equal(f.passedCheckAfterLastEdit, true);
});

test("duplicated tool_use entries count once", () => {
  const t = new T().user("go");
  const entry = { type: "assistant", message: { content: [{ type: "tool_use", id: "dup", name: "Bash", input: { command: "npm test" } }] } };
  t.push(entry).push(entry);
  assert.equal(analyzeTranscript(t.text()).checks.length, 1);
});

test("a 20 MB transcript is analysed in under 1.5 seconds", () => {
  const filler = "z".repeat(10_000);
  const t = new T();
  t.user("first task");
  for (let i = 0; i < 1000; i++) t.user(`prompt ${i}`).say(filler).bash("ls", filler);
  t.user("last prompt").edit("/a.ts");
  for (let i = 0; i < 200; i++) t.bash("ls", filler);
  t.bash("npm test", JEST_PASS + filler.slice(0, 200_000));
  t.say("done");
  const text = t.text();
  assert.ok(text.length > 20_000_000, `size ${text.length}`);
  const t0 = performance.now();
  const f = analyzeTranscript(text);
  const ms = performance.now() - t0;
  assert.equal(f.task, "first task");
  assert.deepEqual(f.edits, ["/a.ts"]);
  assert.equal(f.passedCheckAfterLastEdit, true);
  assert.ok(ms < 1500, `took ${ms.toFixed(0)} ms`);
});

test("turn key: a hash of the prompt's uuid or position, never its text; same within a turn, new for the next prompt", () => {
  const t = new T().user("first").edit("/a.ts").user("second task").edit("/b.ts");
  const key = analyzeTranscript(t.text()).turn;
  assert.match(key ?? "", /^[0-9a-f]{12}$/);
  assert.equal(currentTurn(t.text()), key);
  t.bash("npm test", JEST_PASS).push({ type: "user", origin: { kind: "task-notification" }, message: { role: "user", content: "<task-notification>done</task-notification>" } }).say("done");
  assert.equal(analyzeTranscript(t.text()).turn, key);
  const reworded = new T().user("first").edit("/a.ts").user("other words!").edit("/b.ts");
  assert.equal(analyzeTranscript(reworded.text()).turn, key);
  assert.notEqual(analyzeTranscript(t.user("third").text()).turn, key);
  const viaUuid = (pad: number, text: string) => {
    const u = new T();
    for (let i = 0; i < pad; i++) u.say("pad");
    return analyzeTranscript(u.user(text, { uuid: "4f0c-uuid" }).edit("/c.ts").text()).turn;
  };
  assert.equal(viaUuid(0, "a"), viaUuid(5, "b"));
  assert.notEqual(viaUuid(0, "a"), analyzeTranscript(new T().user("a", { uuid: "other-uuid" }).edit("/c.ts").text()).turn);
  assert.equal(analyzeTranscript(new T().edit("/a.ts").text()).turn, undefined);
  assert.equal(currentTurn("garbage"), undefined);
  assert.equal(currentTurn(""), undefined);
});

test("turn key: a prompt without a uuid is keyed by its position within the session; a uuid keys the same in every session", () => {
  const plain = new T().user("fix it").edit("/a.ts").text();
  const other = new T().user("something else entirely").say("ok").text();
  assert.equal(currentTurn(plain, "s1"), currentTurn(plain, "s1"));
  assert.equal(analyzeTranscript(plain, "s1").turn, currentTurn(plain, "s1"));
  assert.notEqual(currentTurn(plain, "s1"), currentTurn(plain, "s2"));
  assert.notEqual(currentTurn(other, "s1"), currentTurn(plain, "s2"));
  assert.notEqual(analyzeTranscript(plain, "s1").turn, analyzeTranscript(plain, "s2").turn);
  const withUuid = new T().user("fix it", { uuid: "9b1d-uuid" }).edit("/a.ts").text();
  assert.equal(currentTurn(withUuid, "s1"), currentTurn(withUuid, "s2"));
  assert.equal(analyzeTranscript(withUuid, "s1").turn, analyzeTranscript(withUuid, "s2").turn);
  assert.notEqual(currentTurn(withUuid, "s1"), currentTurn(plain, "s1"));
});

test("scanLength: the characters analyzeTranscript may scan, the current turn and the one before it", () => {
  assert.equal(scanLength(""), 0);
  const none = new T().edit("/a.ts").say("no prompt").text();
  assert.equal(scanLength(none), none.length);
  const one = new T().user("first");
  const head = one.text().length;
  const single = one.edit("/a.ts").say("done").text();
  assert.equal(scanLength(single), single.length - head);
  const big = "z".repeat(50_000);
  const first = new T().say("intro").user("first");
  const firstEnd = first.text().length;
  const two = first.say(big).user("second").edit("/b.ts").say("done").text();
  assert.equal(scanLength(two), two.length - firstEnd);
  assert.ok(scanLength(two) > big.length);
  const three = new T().user("first").say(big).user("second").say("short").user("third").edit("/c.ts").text();
  assert.ok(scanLength(three) < 1_000, `scanned ${scanLength(three)}`);
  assert.equal(scanLength(new T().user("only").text().trimEnd()), 0);
  const noNewline = new T().say("x").user("last").text().trimEnd();
  assert.equal(scanLength(noNewline), noNewline.length);
  assert.equal(scanLength("garbage"), "garbage".length);
});
