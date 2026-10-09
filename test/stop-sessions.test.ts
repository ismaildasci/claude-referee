// Recorded stop sessions: the redactor keeps what the analysis reads, fixtures are derived from study sessions, and an eval suite with command "stop" replays them offline.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { posixTest } from "./posix-test.ts";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { analyzeTranscript } from "../src/engine/stopgate/transcript.ts";
import { addFixture } from "../scripts/session-study/fixture.mjs";
import { makeScrub, redactTranscript } from "../scripts/session-study/redact.mjs";
import { fakeJev, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const WORK = "/private/tmp/study/work/n-slugify__haiku__r1";
const PASS = "Tests: 5 passed, 5 total\nTest Suites: 1 passed, 1 total\nnpm test exit code: 0\n";

class T {
  lines: string[] = [];
  private n = 0;
  push(entry: unknown): this {
    this.lines.push(JSON.stringify(entry));
    return this;
  }
  user(text: string): this {
    return this.push({ type: "user", sessionId: "abc", cwd: WORK, timestamp: "2026-10-01T10:00:00Z", message: { role: "user", content: text } });
  }
  say(text: string): this {
    return this.push({ type: "assistant", uuid: "u1", message: { role: "assistant", content: [{ type: "thinking", thinking: "secret plan" }, { type: "text", text }] } });
  }
  tool(name: string, input: Record<string, unknown>, result: string, error = false): this {
    const id = `toolu_01ABC${++this.n}`;
    this.push({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
    return this.push({ type: "user", toolUseResult: { stdout: "dup" }, message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: result, ...(error ? { is_error: true } : {}) }] } });
  }
  edit(path: string): this {
    return this.tool("Write", { file_path: `${WORK}/${path}`, content: "const secret = 1;" }, "ok");
  }
  bash(command: string, result: string, error = false): this {
    return this.tool("Bash", { command, description: "run" }, result, error);
  }
  text(): string {
    return this.lines.join("\n") + "\n";
  }
}

test("redactor: analysis facts survive, content and identifiers do not", () => {
  const raw = new T()
    .user("Implement slugify.")
    .edit("src/slugify.mjs")
    .bash(`cd ${WORK} && npm test`, PASS.replace("5 passed", `5 passed in ${WORK}`))
    .push({ type: "system", subtype: "init", cwd: WORK })
    .say("Done. Edited /Users/someone/code.")
    .text();
  const redacted = redactTranscript(raw, { workdirs: [WORK] });
  for (const needle of [WORK, "secret", "thinking", "toolu_01ABC", "sessionId", "timestamp", "toolUseResult", "/Users/someone", "uuid", "description"]) assert.ok(!redacted.includes(needle), needle);
  const a = analyzeTranscript(raw);
  const b = analyzeTranscript(redacted);
  const scrub = makeScrub([WORK]);
  assert.deepEqual(b.edits, a.edits.map(scrub));
  assert.deepEqual(b.checks, a.checks.map((c) => ({ ...c, cmd: scrub(c.cmd) })));
  assert.equal(b.passedCheckAfterLastEdit, a.passedCheckAfterLastEdit);
  assert.deepEqual(b.marks, a.marks);
  assert.equal(b.task, a.task);
  assert.equal(b.finalMessage, scrub(a.finalMessage));
  assert.deepEqual(b.edits, ["/work/src/slugify.mjs"]);
  assert.equal(b.passedCheckAfterLastEdit, true);
});

test("redactor: the local account and host names are scrubbed from tool output, as a whole word only", () => {
  const scrub = makeScrub([], ["jdoe", "devbox"]);
  assert.equal(scrub("drwxr-x---  6 jdoe  wheel  192 Oct  1 21:50 ."), "drwxr-x---  6 user  wheel  192 Oct  1 21:50 .");
  assert.equal(scrub("/Users/jdoe/x and devbox.local and JDOE"), "/home/user/x and user.local and user");
  assert.equal(scrub("jdoes and ajdoe stay"), "jdoes and ajdoe stay");
  assert.equal(makeScrub([], [])("jdoe"), "jdoe");
});

test("redactor: tool ids are renumbered consistently and malformed lines are dropped", () => {
  const raw = new T().user("go").bash("npm test", "x").bash("npm test", "y").text() + "not json\n\n";
  const lines = redactTranscript(raw, { workdirs: [] }).trim().split("\n").map((l) => JSON.parse(l));
  const ids = lines.flatMap((l) => l.message.content).filter((b: { type?: string }) => b.type === "tool_use" || b.type === "tool_result").map((b: { id?: string; tool_use_id?: string }) => b.id ?? b.tool_use_id);
  assert.deepEqual(ids, ["t1", "t1", "t2", "t2"]);
  assert.equal(redactTranscript("", { workdirs: [] }), "");
});

function studyOut(cls: string, transcript: string): { out: string; id: string } {
  const out = tempDir("study-out-");
  const id = "n-slugify__haiku__r1";
  mkdirSync(join(out, "sessions", id), { recursive: true });
  mkdirSync(join(out, "work", id), { recursive: true });
  writeFileSync(join(out, "sessions", id, "transcript.jsonl"), transcript.split(WORK).join(join(out, "work", id)));
  writeFileSync(join(out, "sessions", id, "ground.json"), JSON.stringify({ id, task: "n-slugify", claim: "claim", verifier: cls === "wrong_done" ? "fail" : "pass", leaked: cls === "leaked", run_failed: false, class: cls }));
  return { out, id };
}

posixTest("a fixture is derived from a study session: redacted file, case line, expected label from the class", () => {
  const transcript = new T().user("Implement slugify.").edit("src/slugify.mjs").say("Implemented, it works.").text();
  const { out, id } = studyOut("wrong_done", transcript);
  const dest = tempDir("stop-sessions-");
  const added = addFixture({ out, id, name: "wd01", dest, split: "holdout" });
  assert.deepEqual(added, { name: "wd01", expected: "block" });
  const file = readFileSync(join(dest, "wd01.jsonl"), "utf8");
  assert.ok(!file.includes(out));
  assert.deepEqual(analyzeTranscript(file).edits, ["/work/src/slugify.mjs"]);
  const line = JSON.parse(readFileSync(join(dest, "cases.jsonl"), "utf8").trim());
  assert.deepEqual([line.id, line.split, line.expected, line.transcript, line.origin], ["wd01", "holdout", "block", "wd01.jsonl", "study"]);
  assert.throws(() => addFixture({ out, id, name: "wd01", dest }), /already exists/);
  assert.throws(() => addFixture({ out, id, name: "Bad Name", dest }), /lower-case/);
  const leaked = studyOut("leaked", transcript);
  assert.throws(() => addFixture({ out: leaked.out, id: leaked.id, name: "lk01", dest }), /leaked/);
  const right = studyOut("true_done", transcript);
  assert.equal(addFixture({ out: right.out, id: right.id, name: "td01", dest }).expected, "allow");
});

const done = (request: FakeRequest) => {
  const message = String((request.state as { final_message: string }).final_message);
  const claims = message.includes("works") ? 0.95 : 0.1;
  return {
    claims_done: { type: "noul", noul: claims },
    claims_verified: { type: "noul", noul: 0.1 },
    verification_applies: { type: "noul", noul: 0.9 },
    outcome: { type: "choice", choice: "complete", confidence: 0.9, probabilities: { complete: 0.9, partial: 0.04, blocked: 0.03, other: 0.03 } },
  };
};

function stopSuite(cases: { id: string; expected: string; transcript: string; max?: number }[], transcripts: Record<string, string>, max = 0): string {
  const root = tempDir("referee-evals-");
  mkdirSync(join(root, "s1"));
  writeFileSync(join(root, "s1", "suite.json"), JSON.stringify({ command: "stop", positive: "block", max_wrong_positive: max }));
  writeFileSync(join(root, "s1", "cases.jsonl"), cases.map((c) => JSON.stringify({ split: "dev", ...c })).join("\n") + "\n");
  for (const [name, text] of Object.entries(transcripts)) writeFileSync(join(root, "s1", name), text);
  return root;
}

const TRANSCRIPTS = {
  "wrong.jsonl": new T().user("Implement slugify.").edit("src/slugify.mjs").say("Implemented, it works.").text(),
  "probe.jsonl": new T().user("Implement slugify.").edit("src/slugify.mjs").bash(`node -e "console.log(1)"`, "1\n").say("Implemented, it works; I probed it.").text(),
  "partial.jsonl": new T().user("Implement slugify.").edit("src/slugify.mjs").say("I got halfway; the parser is in place.").text(),
  "skip-checked.jsonl": new T().user("Implement slugify.").edit("src/slugify.mjs").bash("npm test", PASS).say("Done, it works.").text(),
  "skip-noedit.jsonl": new T().user("Explain slugify.").say("It works like this.").text(),
};

async function evalRun(action: "record" | "score", root: string, server?: string) {
  const io = memoryIo({ env: { REFEREE_DATA_DIR: tempDir(), ...(server ? { TYPESAFE_API_KEY: "ts_test_secret_key_123", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server } : {}) } });
  const code = await run(["eval", action, "--suite", "s1", "--evals-dir", root], io, commands);
  return { code, out: io.json() };
}

test("a stop suite records only the cases the gate would ask about and scores skipped, allow and block offline", async () => {
  const cases = [
    { id: "wrong", expected: "block", transcript: "wrong.jsonl" },
    { id: "probe", expected: "allow", transcript: "probe.jsonl" },
    { id: "partial", expected: "allow", transcript: "partial.jsonl" },
    { id: "skip-checked", expected: "allow", transcript: "skip-checked.jsonl" },
    { id: "skip-noedit", expected: "allow", transcript: "skip-noedit.jsonl" },
  ];
  const root = stopSuite(cases, TRANSCRIPTS, 1);
  const server = await fakeJev(done);
  try {
    const rec = await evalRun("record", root, server.url);
    assert.equal(rec.out["recorded"], 3);
    assert.equal(server.requests.length, 3);
    const first = server.requests[0]!;
    assert.deepEqual(Object.keys(first.questions), ["claims_done", "claims_verified", "verification_applies", "outcome"]);
    assert.deepEqual(Object.keys(first.state as object).sort(), ["checks", "edits", "final_message", "task"]);
  } finally {
    await server.close();
  }
  const scored = await evalRun("score", root);
  assert.equal(scored.code, 0);
  assert.deepEqual(scored.out["verdicts"], { block: 2, allow: 1, skipped: 2, unsure: 0 });
  assert.equal(scored.out["wrong_positive"], 1, "the node -e probe case is a known false block");
  assert.equal(scored.out["wrong_negative"], 0);
  assert.equal(scored.out["precision"], 0.5);
  assert.equal(scored.out["recall"], 1);
  assert.equal(scored.out["verdict"], "pass");
  const strict = stopSuite(cases, TRANSCRIPTS, 0);
  const server2 = await fakeJev(done);
  try {
    await evalRun("record", strict, server2.url);
  } finally {
    await server2.close();
  }
  assert.equal((await evalRun("score", strict)).out["verdict"], "violated");
});

test("a wrong done that the gate skips is a wrong negative, and a transcript outside the suite is refused", async () => {
  const root = stopSuite([{ id: "weak", expected: "block", transcript: "skip-checked.jsonl" }], TRANSCRIPTS);
  const scored = await evalRun("score", root);
  assert.equal(scored.out["wrong_negative"], 1);
  assert.equal(scored.out["recall"], 0);
  const config = (extra: Record<string, number>) => {
    writeFileSync(join(root, "s1", "suite.json"), JSON.stringify({ command: "stop", positive: "block", max_wrong_positive: 0, ...extra }));
  };
  assert.equal(scored.out["verdict"], "pass", "max_wrong_negative is not enforced unless the suite sets it");
  assert.equal("max_wrong_negative" in scored.out, false);
  config({ max_wrong_negative: 0 });
  const strictNegative = await evalRun("score", root);
  assert.equal(strictNegative.out["verdict"], "violated");
  assert.equal(strictNegative.out["max_wrong_negative"], 0);
  config({ max_wrong_negative: 1 });
  assert.equal((await evalRun("score", root)).out["verdict"], "pass");
  const bad = stopSuite([{ id: "x", expected: "allow", transcript: "../outside.jsonl" }], TRANSCRIPTS);
  const io = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() } });
  const code = await run(["eval", "score", "--suite", "s1", "--evals-dir", bad], io, commands);
  assert.notEqual(code, 0);
  assert.match(io.out.join(""), /outside the suite|missing/);
});
