// Session key: transcripts found by session id in any Claude Code project folder, CLI receipts that carry CLAUDE_CODE_SESSION_ID,
// and receipts --session joining one session's receipts, stops and transcript across project ids without printing paths or text.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { projectId } from "../src/engine/datadir.ts";
import { appendReceipt, envSessionId, readReceipts, type Receipt } from "../src/engine/receipts.ts";
import { Session } from "../src/engine/session.ts";
import { appendStop } from "../src/engine/stopgate/stops.ts";
import type { StopRecord } from "../src/engine/stopgate/types.ts";
import { LOCATOR_FOLDERS_MAX, LOCATOR_SCANS_MAX, suggestForStops, transcriptLocator } from "../src/engine/stopgate/weak.ts";
import { claudeProjectsDir, projectTranscriptDirs } from "../src/engine/usage.ts";
import { queue } from "../src/ui/api.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const enc = (p: string) => p.replace(/[^A-Za-z0-9]/g, "-");

function line(type: string, ts: string, content: unknown): string {
  return JSON.stringify({ type, timestamp: ts, message: { role: type, content } });
}

const BROKEN = [
  line("user", "2026-09-29T09:00:00.000Z", "add a login page"),
  line("assistant", "2026-09-29T09:05:00.000Z", [{ type: "text", text: "done" }]),
  line("user", "2026-09-29T10:30:00.000Z", "it is broken, secret-transcript-words here"),
].join("\n") + "\n";

function transcript(projects: string, folder: string, session: string, text = BROKEN): string {
  const dir = join(projects, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${session}.jsonl`), text);
  return dir;
}

function stop(id: string, extra: Partial<StopRecord>): StopRecord {
  return {
    id,
    ts: "2026-09-29T09:06:00.000Z",
    session_id: "sess",
    project: "p",
    mode: "shadow",
    edits: 1,
    checks: 0,
    ms: 10,
    decision: { claims_done: 0.9, claims_verified: 0.1, verification_applies: 0.9, outcome: {}, would_block: true },
    ...extra,
  };
}

function receipt(id: string, project: string, extra: Partial<Receipt> = {}): Receipt {
  return { id, ts: "2026-09-29T09:00:00.000Z", command: "done", project, requests: 1, cached: 0, input_tokens: 10, cost_usd: 0, ms: 5, ...extra };
}

test("the locator tries the reader's dirs first, then every project folder with one readdir per locator", () => {
  const projects = join(tempDir(), "projects");
  const own = transcript(projects, "-own-folder", "in-own");
  transcript(projects, "-elsewhere-a", "moved-1");
  transcript(projects, "-elsewhere-b", "moved-2");
  const locator = transcriptLocator([own], projects);
  assert.equal(locator.find("in-own"), join(own, "in-own.jsonl"));
  assert.equal(locator.readdirs, 0, "a transcript in the reader's own dir needs no listing");
  assert.equal(locator.find("moved-1"), join(projects, "-elsewhere-a", "moved-1.jsonl"));
  assert.equal(locator.find("moved-2"), join(projects, "-elsewhere-b", "moved-2.jsonl"));
  assert.equal(locator.find("no-such-session"), null);
  assert.equal(locator.readdirs, 1, "one listing of the projects dir per locator");

  rmSync(join(projects, "-elsewhere-a", "moved-1.jsonl"));
  assert.equal(locator.find("moved-1"), join(projects, "-elsewhere-a", "moved-1.jsonl"), "a session is looked up once per locator");
  assert.equal(transcriptLocator([own], projects).find("moved-1"), null, "a new locator sees the change");
  assert.equal(transcriptLocator([own]).find("moved-2"), null, "without a projects dir only the reader's dirs count");
});

test("the locator rejects ids that could leave the folder and never lists for them", () => {
  const root = tempDir();
  const projects = join(root, "projects");
  const own = transcript(projects, "-own", "ok-id");
  writeFileSync(join(root, "evil.jsonl"), BROKEN);
  writeFileSync(join(projects, "evil.jsonl"), BROKEN);
  const locator = transcriptLocator([own], projects);
  for (const id of ["../evil", "../../evil", "..%2Fevil", "a/b", "a\\b", "", "x".repeat(65), "evil\0", "sp ace"]) assert.equal(locator.find(id), null, JSON.stringify(id));
  assert.equal(locator.readdirs, 0);
  assert.equal(locator.find("x".repeat(64)), null);
  assert.equal(locator.readdirs, 1, "a valid 64-character id may be looked up");
});

test("the locator survives a missing or unreadable projects dir and honours CLAUDE_CONFIG_DIR", () => {
  const missing = transcriptLocator([join(tempDir(), "nope")], join(tempDir(), "no-projects"));
  assert.equal(missing.find("sess"), null);
  assert.equal(missing.find("other"), null);
  assert.equal(missing.readdirs, 1);
  const file = join(tempDir(), "a-file");
  writeFileSync(file, "x");
  assert.equal(transcriptLocator([], file).find("sess"), null);

  const home = tempDir();
  const config = tempDir();
  assert.equal(claudeProjectsDir({}, home), join(home, ".claude", "projects"));
  assert.equal(claudeProjectsDir({ CLAUDE_CONFIG_DIR: ` ${config} ` }, home), join(config, "projects"));
  assert.equal(claudeProjectsDir({ CLAUDE_CONFIG_DIR: "  " }, home), join(home, ".claude", "projects"));
  const cwd = tempDir();
  assert.deepEqual(projectTranscriptDirs({ CLAUDE_CONFIG_DIR: config }, home, cwd).slice(0, 1), [join(config, "projects", enc(cwd))]);
});

test("the locator's cost is capped: the newest folders and a fixed number of sessions per call", () => {
  const projects = join(tempDir(), "projects");
  const old = new Date("2020-01-01T00:00:00Z");
  const fresh = new Date("2026-09-01T00:00:00Z");
  for (let i = 0; i < LOCATOR_FOLDERS_MAX; i++) {
    const dir = join(projects, `-f${String(i).padStart(4, "0")}`);
    mkdirSync(dir, { recursive: true });
    utimesSync(dir, fresh, fresh);
  }
  const oldest = transcript(projects, "-zz-oldest", "oldest-session");
  utimesSync(oldest, old, old);
  assert.equal(transcriptLocator([], projects).find("oldest-session"), null, "past the folder cap the oldest folder is left out");
  utimesSync(oldest, new Date(), new Date());
  assert.equal(transcriptLocator([], projects).find("oldest-session"), join(oldest, "oldest-session.jsonl"));

  const small = join(tempDir(), "projects");
  transcript(small, "-late", "late-session");
  const locator = transcriptLocator([], small);
  for (let i = 0; i < LOCATOR_SCANS_MAX; i++) assert.equal(locator.find(`miss-${i}`), null);
  assert.equal(locator.find("late-session"), null, "past the scan cap a session is not looked for");
  assert.equal(transcriptLocator([], small).find("late-session"), join(small, "-late", "late-session.jsonl"));
});

test("suggestForStops and the dashboard queue find a transcript stored under another project folder", () => {
  const home = tempDir();
  const cwd = tempDir();
  const dataDir = tempDir();
  const projects = join(home, ".claude", "projects");
  transcript(projects, "-the-folder-the-session-started-in", "sess-moved");
  const s = stop("q1", { session_id: "sess-moved", project: projectId(cwd) });
  const before = suggestForStops(transcriptLocator(projectTranscriptDirs({}, home, cwd)), [s]);
  assert.equal(before.size, 0, "the reader's own dirs alone miss it");
  const after = suggestForStops(transcriptLocator(projectTranscriptDirs({}, home, cwd), claudeProjectsDir({}, home)), [s]);
  assert.deepEqual(after.get("q1"), { label: "right", reason: "reported_broken", source: "next_message" });

  appendStop(dataDir, s);
  const listed = queue({ dataDir, cwd, home, env: {}, now: () => Date.parse("2026-09-30T12:00:00Z") });
  assert.deepEqual(listed.stops[0]?.suggestion, { label: "right", reason: "reported_broken", source: "next_message" });
  assert.ok(!JSON.stringify(listed).includes("secret-transcript-words"));
});

test("receipts --stops shows the hint when the transcript sits in another project folder", async () => {
  const home = tempDir();
  const cwd = tempDir();
  const dataDir = tempDir();
  const config = tempDir();
  transcript(join(config, "projects"), "-parent-folder", "sess-split");
  appendStop(dataDir, stop("m1", { session_id: "sess-split", project: projectId(cwd) }));
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir, CLAUDE_CONFIG_DIR: config }, cwd, home });
  assert.equal(await run(["receipts", "--stops"], io, commands), 0);
  const stops = io.json()["stops"] as { id: string; suggestion?: unknown }[];
  assert.deepEqual(stops.find((s) => s.id === "m1")?.suggestion, { label: "right", reason: "reported_broken", source: "next_message" });
  const text = io.out.join("");
  assert.ok(!text.includes("secret-transcript-words") && !text.includes(config) && !text.includes("parent-folder"));
});

test("envSessionId accepts only 1 to 64 letters, digits, '.', '_' or '-'", () => {
  assert.equal(envSessionId({ CLAUDE_CODE_SESSION_ID: "0f6c1e2a-1b2c-4d5e-8f90-123456789abc" }), "0f6c1e2a-1b2c-4d5e-8f90-123456789abc");
  assert.equal(envSessionId({ CLAUDE_CODE_SESSION_ID: "x".repeat(64) }), "x".repeat(64));
  for (const bad of [undefined, "", "x".repeat(65), "../x", "a/b", "a b", " id", "id\n", "é"]) assert.equal(envSessionId({ CLAUDE_CODE_SESSION_ID: bad }), undefined, JSON.stringify(bad));
});

test("CLI receipts carry CLAUDE_CODE_SESSION_ID when it is valid, error receipts too; hook receipts keep the hook's id", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  const cwd = tempDir();
  const keyed = { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: dataDir };
  const done = (env: Record<string, string>, stdin: string, extra: string[] = []) => run(["done", "--criteria", "tests pass", "--evidence", "-", ...extra], memoryIo({ env, cwd, stdin }), commands);
  try {
    await done({ ...keyed, CLAUDE_CODE_SESSION_ID: "cli-sess-1" }, "Tests: 1 passed, 1 total\n");
    await done({ ...keyed, CLAUDE_CODE_SESSION_ID: "../escape" }, "Tests: 2 passed, 2 total\n");
    await done({ ...keyed, CLAUDE_CODE_SESSION_ID: "y".repeat(65) }, "Tests: 3 passed, 3 total\n");
    await done(keyed, "Tests: 4 passed, 4 total\n");
    assert.equal(await done({ REFEREE_DATA_DIR: dataDir, CLAUDE_CODE_SESSION_ID: "cli-sess-1" }, "Tests: 5 passed, 5 total\n", ["--pack", "no-such-pack"]), 1);
    assert.equal(await done({ REFEREE_DATA_DIR: dataDir, CLAUDE_CODE_SESSION_ID: "cli-sess-1", HOME: tempDir() }, "Tests: 6 passed, 6 total\n"), 1);
  } finally {
    await server.close();
  }
  const all = readReceipts(dataDir);
  assert.equal(all.length, 6);
  assert.deepEqual(all.map((r) => r.session_id), ["cli-sess-1", undefined, undefined, undefined, "cli-sess-1", "cli-sess-1"]);
  assert.deepEqual(all.slice(4).map((r) => r.error), ["pack_not_found", "no_api_key"]);
  assert.ok(!readFileSync(join(dataDir, "receipts", projectId(cwd), `${all[0]?.ts.slice(0, 7)}.jsonl`), "utf8").includes("escape"));

  const hookData = tempDir();
  const base = { cwd, home: tempDir(), platform: "linux" as const, now: () => Date.parse("2026-09-30T12:00:00Z"), pack: { name: "generic", version: "0" }, dataDir: hookData };
  new Session({ ...base, command: "stop-gate", env: { CLAUDE_CODE_SESSION_ID: "env-sess" }, profile: "hook", sessionId: "hook-sess" }).record({ verdict: "shadow" });
  new Session({ ...base, command: "stop-gate", env: { CLAUDE_CODE_SESSION_ID: "env-sess" }, profile: "hook", sessionId: "unknown" }).record({ verdict: "shadow" });
  new Session({ ...base, command: "done", env: { CLAUDE_CODE_SESSION_ID: "env-sess" } }).record({ verdict: "met" });
  assert.deepEqual(readReceipts(hookData).map((r) => r.session_id), ["hook-sess", "unknown", "env-sess"]);
});

test("receipts --session joins one session's receipts and stops across project ids, with the transcript as a count only", async () => {
  const dataDir = tempDir();
  const home = tempDir();
  const config = tempDir();
  const cwd = tempDir();
  const [p1, p2, p3] = ["aaaaaaaaaaa1", "bbbbbbbbbbb2", "ccccccccccc3"];
  appendReceipt(dataDir, receipt("r1", p1, { session_id: "sess-join", verdict: "met", requests: 2, input_tokens: 100, cost_usd: 0.001 }));
  appendReceipt(dataDir, receipt("r2", p2, { session_id: "sess-join", verdict: "missing" }));
  appendReceipt(dataDir, receipt("r3", p2, { session_id: "sess-join", command: "verify", verdict: "supported" }));
  appendReceipt(dataDir, receipt("r4", p2, { session_id: "sess-join", command: "decide", error: "no_api_key", requests: 0 }));
  appendReceipt(dataDir, receipt("r5", p1, { session_id: "sess-join", command: "judge", verdict: "Not A Code" }));
  appendReceipt(dataDir, receipt("r6", p1, { session_id: "other-sess", verdict: "met" }));
  appendReceipt(dataDir, receipt("r7", p3, { verdict: "met" }));
  appendReceipt(dataDir, receipt("r8", p3, { session_id: "sess-join", verdict: "met", ts: "2026-01-01T00:00:00.000Z" }));
  appendStop(dataDir, stop("s1", { session_id: "sess-join", project: p1, task_excerpt: "task text" }));
  const { decision: _asked, ...skipped } = stop("s2", { session_id: "sess-join", project: p3, ts: "2026-09-29T11:00:00.000Z", skipped: "no_edits" });
  appendStop(dataDir, skipped);
  appendStop(dataDir, stop("s3", { session_id: "other-sess", project: p1 }));
  transcript(join(config, "projects"), "-somewhere-unrelated", "sess-join");
  const env = { REFEREE_DATA_DIR: dataDir, CLAUDE_CONFIG_DIR: config };

  const io = memoryIo({ env, cwd, home });
  assert.equal(await run(["receipts", "--session", "sess-join", "--pretty"], io, commands), 0);
  const out = io.json();
  assert.equal(out["verdict"], "session");
  assert.equal(out["session_id"], "sess-join");
  assert.equal(out["days"], undefined);
  assert.equal(out["runs"], 6, "every project id, any age without --days");
  assert.equal(out["requests"], 6);
  assert.equal(out["input_tokens"], 150);
  assert.deepEqual(out["by_command"], { done: 3, claims: 1, decide: 1, judge: 1 });
  assert.deepEqual(out["by_verdict"], { done: { met: 2, missing: 1 }, claims: { supported: 1 }, decide: { no_api_key: 1 }, judge: { other: 1 } });
  assert.deepEqual(out["by_project"], { [p1]: { receipts: 2, stops: 1 }, [p2]: { receipts: 3, stops: 0 }, [p3]: { receipts: 1, stops: 1 } });
  assert.equal(out["transcript_found"], true);
  assert.equal(out["transcript_lines"], 3);
  assert.equal((out["stats"] as { stops: number }).stops, 2);
  const stops = out["stops"] as { id: string; project: string; suggestion?: unknown; task_excerpt?: string }[];
  assert.deepEqual(stops.map((s) => [s.id, s.project]), [["s2", p3], ["s1", p1]]);
  assert.deepEqual(stops[1]?.suggestion, { label: "right", reason: "reported_broken", source: "next_message" });
  const text = io.out.join("");
  for (const hidden of ["secret-transcript-words", "somewhere-unrelated", config, home, dataDir, "other-sess"]) assert.ok(!text.includes(hidden), hidden);

  const windowed = memoryIo({ env, cwd, home });
  await run(["receipts", "--session", "sess-join", "--days", "30"], windowed, commands);
  assert.equal(windowed.json()["runs"], 5);
  assert.equal(windowed.json()["days"], 30);

  const current = memoryIo({ env: { ...env, CLAUDE_CODE_SESSION_ID: "sess-join" }, cwd, home });
  assert.equal(await run(["receipts", "--session", "current"], current, commands), 0);
  assert.equal(current.json()["session_id"], "sess-join");
  assert.equal(current.json()["runs"], 6);

  const lost = memoryIo({ env, cwd, home });
  await run(["receipts", "--session", "other-sess"], lost, commands);
  assert.equal(lost.json()["transcript_found"], false);
  assert.equal(lost.json()["transcript_lines"], null);
  assert.equal(lost.json()["runs"], 1);

  const empty = memoryIo({ env, cwd, home });
  await run(["receipts", "--session", "never-seen"], empty, commands);
  assert.deepEqual([empty.json()["runs"], empty.json()["by_project"], empty.json()["transcript_found"]], [0, {}, false]);
});

test("receipts --session counts stored keys such as __proto__ or constructor as plain keys and leaves Object.prototype alone", async () => {
  const dataDir = tempDir();
  const dir = join(dataDir, "receipts", "aaaaaaaaaaa1");
  mkdirSync(dir, { recursive: true });
  const rows = [
    receipt("x1", "__proto__", { session_id: "proto-sess", command: "__proto__", verdict: "met" }),
    receipt("x2", "constructor", { session_id: "proto-sess", command: "constructor", verdict: "met" }),
    receipt("x3", "toString", { session_id: "proto-sess", command: "done", verdict: "missing" }),
    receipt("x4", "aaaaaaaaaaa1", { session_id: "proto-sess", command: "judge", verdict: "no" }),
    receipt("x5", "aaaaaaaaaaa1", { session_id: "proto-sess", command: "done", verdict: "met" }),
  ];
  writeFileSync(join(dir, "2026-09.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  appendStop(dataDir, stop("ps1", { session_id: "proto-sess", project: "__proto__" }));
  appendStop(dataDir, stop("ps2", { session_id: "proto-sess", project: "hasOwnProperty" }));
  const polluted = () => ["met", "missing", "no", "receipts", "stops"].filter((k) => Object.hasOwn(Object.prototype, k) || Object.hasOwn(Object, k));
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir, CLAUDE_CONFIG_DIR: tempDir() }, cwd: tempDir(), home: tempDir() });
  try {
    assert.equal(await run(["receipts", "--session", "proto-sess", "--pretty"], io, commands), 0);
    assert.deepEqual(polluted(), []);
  } finally {
    for (const k of polluted()) {
      delete (Object.prototype as unknown as Record<string, unknown>)[k];
      delete (Object as unknown as Record<string, unknown>)[k];
    }
  }
  const out = io.json();
  const entries = (value: unknown) => Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
  assert.equal(out["runs"], 5);
  assert.deepEqual(entries(out["by_command"]), [["__proto__", 1], ["constructor", 1], ["done", 2], ["judge", 1]]);
  assert.deepEqual(entries(out["by_verdict"]).map(([k, v]) => [k, entries(v)]), [
    ["__proto__", [["met", 1]]],
    ["constructor", [["met", 1]]],
    ["done", [["met", 1], ["missing", 1]]],
    ["judge", [["no", 1]]],
  ]);
  assert.deepEqual(entries(out["by_project"]).map(([k, v]) => [k, entries(v)]), [
    ["__proto__", [["receipts", 1], ["stops", 1]]],
    ["aaaaaaaaaaa1", [["receipts", 2], ["stops", 0]]],
    ["constructor", [["receipts", 1], ["stops", 0]]],
    ["hasOwnProperty", [["receipts", 0], ["stops", 1]]],
    ["toString", [["receipts", 1], ["stops", 0]]],
  ]);
});

test("receipts --session without --pretty: a line past 1,500 characters goes to the details file, and neither holds the transcript's path or text", async () => {
  const dataDir = tempDir();
  const config = tempDir();
  const home = tempDir();
  transcript(join(config, "projects"), "-transcript-folder-name", "long-sess");
  for (let i = 0; i < 8; i++) {
    appendStop(dataDir, stop(`ls${i}`, { session_id: "long-sess", project: "aaaaaaaaaaa1", ts: `2026-09-29T09:0${i}:00.000Z`, task_excerpt: `task ${i} `.repeat(30) }));
  }
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir, CLAUDE_CONFIG_DIR: config }, cwd: tempDir(), home });
  assert.equal(await run(["receipts", "--session", "long-sess"], io, commands), 0);
  const line = io.out.join("");
  const out = io.json();
  assert.equal(typeof out["details"], "string", "the line passed 1,500 characters and was summarized");
  assert.equal(out["transcript_found"], true);
  assert.equal(out["transcript_lines"], 3);
  assert.equal(out["stops"], undefined, "lists stay in the details file");
  const details = readFileSync(String(out["details"]), "utf8");
  assert.equal((JSON.parse(details) as { stops: unknown[] }).stops.length, 8);
  for (const text of [line, details]) {
    for (const hidden of ["secret-transcript-words", "transcript-folder-name", "long-sess.jsonl", config, home]) assert.ok(!text.includes(hidden), hidden);
  }
});

test("receipts --session current without CLAUDE_CODE_SESSION_ID, a bad id or a mixed flag is bad_input with a next step", async () => {
  const env = { REFEREE_DATA_DIR: tempDir() };
  const cases: [string[], Record<string, string>][] = [
    [["--session", "current"], {}],
    [["--session", "current"], { CLAUDE_CODE_SESSION_ID: "" }],
    [["--session", "current"], { CLAUDE_CODE_SESSION_ID: "../x" }],
    [["--session", "../evil"], {}],
    [["--session", ""], {}],
    [["--session", "z".repeat(65)], {}],
    [["--session", "s", "--stops"], {}],
    [["--session", "s", "--all"], {}],
    [["--session", "s", "--days", "0"], {}],
  ];
  for (const [args, extra] of cases) {
    const io = memoryIo({ env: { ...env, ...extra } });
    assert.equal(await run(["receipts", ...args], io, commands), 1, args.join(" "));
    const out = io.json();
    assert.equal(out["error"], "bad_input", args.join(" "));
    if (args[1] !== "s" || args[2] !== "--days") assert.equal(typeof out["next_step"], "string", args.join(" "));
  }
  const io = memoryIo({ env });
  await run(["receipts", "--session", "current"], io, commands);
  assert.match(String(io.json()["message"]), /CLAUDE_CODE_SESSION_ID/);
  assert.match(String(io.json()["next_step"]), /Claude Code/);
});
