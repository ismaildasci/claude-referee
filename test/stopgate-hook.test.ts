// Stop hook in shadow mode: records its decision, never blocks or prints, and fails open on every error.
// A failure keeps its error code on the stop record and writes a receipt once a Session exists; local refusals are not Jev errors.
// A project file that does not load records nothing (the mode is unknown): the hook entry exits 0 in silence, doctor reports it.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { stopGate } from "../src/hooks/stop.ts";
import { projectId } from "../src/engine/datadir.ts";
import { readReceipts } from "../src/engine/receipts.ts";
import { readStops, stopStats } from "../src/engine/stopgate/stops.ts";
import { fakeJev, type Answerer, type FakeJev } from "./fake-jev.ts";
import { FAKE, tempDir } from "./helpers.ts";

const lines = (...entries: object[]) => entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
const user = (text: string) => ({ type: "user", message: { role: "user", content: text } });
const tool = (id: string, name: string, input: object) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
const result = (id: string, content: string, isError = false) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, ...(isError ? { is_error: true } : {}) }] } });
const said = (text: string) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });

const EDITED = lines(user("Fix the login bug"), tool("e1", "Edit", { file_path: "src/login.ts" }), result("e1", "ok"), said("All done, the login bug is fixed."));
const EDITED_AND_PASSED = lines(user("Fix the login bug"), tool("e1", "Edit", { file_path: "src/login.ts" }), result("e1", "ok"), tool("b1", "Bash", { command: "npm test" }), result("b1", "=== 12 passed in 1s ===\nexit code: 0"), said("Done."));
const NO_EDITS = lines(user("Explain the login flow"), said("It works like this."));

const answers = (done: number, verified: number, applies: number, blocked = 0.02): Answerer => () => ({
  claims_done: { type: "noul", noul: done },
  claims_verified: { type: "noul", noul: verified },
  verification_applies: { type: "noul", noul: applies },
  outcome: { type: "choice", probabilities: { complete: 0.9 - blocked, partial: 0.05, blocked, other: 0.05 } },
});

async function run(options: { transcript?: string | null; stopGate?: string | null; input?: object; env?: Record<string, string>; answer?: Answerer; status?: number; retryAfter?: string; message?: string; pack?: string; noKey?: boolean } = {}) {
  const root = tempDir();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude/referee.json"), JSON.stringify({ pack: options.pack ?? "generic", hooks: options.stopGate === null ? {} : { stopGate: options.stopGate ?? "shadow" } }));
  const transcript = join(root, "t.jsonl");
  if (options.transcript !== null) writeFileSync(transcript, options.transcript ?? EDITED);
  const home = tempDir("referee-home-");
  const dataDir = join(home, "data");
  const server: FakeJev = await fakeJev(options.answer ?? answers(0.95, 0.1, 0.9), options.status ? { status: options.status, ...(options.retryAfter ? { retryAfter: options.retryAfter } : {}) } : undefined);
  try {
    const stdin = JSON.stringify({ hook_event_name: "Stop", cwd: root, session_id: "s1", transcript_path: transcript, ...(options.message ? { last_assistant_message: options.message } : {}), ...options.input });
    const keys = options.noKey ? {} : { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test" };
    const returned = await stopGate({ env: { REFEREE_DATA_DIR: dataDir, ...keys, TYPESAFE_BASE_URL: server.url, ...options.env }, home, now: () => Date.parse("2026-10-01T12:00:00Z"), readStdin: async () => stdin }, root);
    return { stops: readStops(dataDir), receipts: readReceipts(dataDir, projectId(root)), requests: server.requests, printed: returned ?? "", dataDir };
  } finally {
    await server.close();
  }
}

test("stop gate is off unless the project file turns it on", async () => {
  const r = await run({ stopGate: null });
  assert.equal(r.requests.length, 0);
  assert.equal(r.stops.length, 0);
  const off = await run({ stopGate: "off" });
  assert.equal(off.stops.length, 0);
});

test("shadow: edits and no passing check ask Jev once and record would_block, printing nothing", async () => {
  const r = await run();
  assert.equal(r.requests.length, 1);
  assert.deepEqual(Object.keys(r.requests[0]?.questions ?? {}), ["claims_done", "claims_verified", "verification_applies", "outcome"]);
  assert.equal(r.printed, "");
  assert.equal(r.stops.length, 1);
  const stop = r.stops[0]!;
  assert.equal(stop.skipped, undefined);
  assert.equal(stop.edits, 1);
  assert.equal(stop.decision?.would_block, true);
  assert.match(stop.task_excerpt ?? "", /login bug/);
  const state = r.requests[0]?.state as { edits: string[]; final_message: string };
  assert.deepEqual(state.edits, ["src/login.ts"]);
  assert.equal(stop.error, undefined);
  assert.equal("configured" in stop, false);
  assert.equal(r.receipts.length, 1);
  assert.equal(r.receipts[0]?.command, "stop-gate");
  assert.equal(r.receipts[0]?.verdict, "shadow");
  assert.equal(r.receipts[0]?.error, undefined);
  assert.equal(r.receipts[0]?.requests, 1);
});

test("shadow records would_block false when the message is verified, not applicable or blocked", async () => {
  assert.equal((await run({ answer: answers(0.95, 0.9, 0.9) })).stops[0]?.decision?.would_block, false);
  assert.equal((await run({ answer: answers(0.95, 0.1, 0.2) })).stops[0]?.decision?.would_block, false);
  assert.equal((await run({ answer: answers(0.95, 0.1, 0.9, 0.6) })).stops[0]?.decision?.would_block, false);
  assert.equal((await run({ answer: answers(0.3, 0.1, 0.9) })).stops[0]?.decision?.would_block, false);
});

test("stops without edits or after a passing check never reach Jev", async () => {
  const none = await run({ transcript: NO_EDITS });
  assert.equal(none.requests.length, 0);
  assert.equal(none.stops[0]?.skipped, "no_edits");
  const passed = await run({ transcript: EDITED_AND_PASSED });
  assert.equal(passed.requests.length, 0);
  assert.equal(passed.stops[0]?.skipped, "check_passed_after_edit");
});

test("stop_hook_active, background tasks and a missing transcript are skipped and recorded", async () => {
  assert.equal((await run({ input: { stop_hook_active: true } })).stops[0]?.skipped, "stop_hook_active");
  assert.equal((await run({ input: { background_tasks: [{ id: "x" }] } })).stops[0]?.skipped, "background_tasks");
  assert.equal((await run({ transcript: null })).stops[0]?.skipped, "no_transcript");
});

test("REFEREE_HOOKS=off and a hooks_enabled setting of false stop everything", async () => {
  for (const env of [{ REFEREE_HOOKS: "off" }, { CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED: "false" }]) {
    const r = await run({ env });
    assert.equal(r.stops.length, 0);
    assert.equal(r.receipts.length, 0);
    assert.equal(existsSync(r.dataDir) ? readdirSync(r.dataDir).length : 0, 0);
  }
});

test("a Jev error fails open and is recorded with its code and an error receipt, with nothing printed", async () => {
  for (const [status, code] of [[500, "service_unavailable"], [429, "rate_limited"]] as const) {
    const r = await run({ status, retryAfter: "60" });
    assert.equal(r.printed, "");
    assert.equal(r.stops[0]?.skipped, "jev_error", code);
    assert.equal(r.stops[0]?.error, code);
    assert.equal(r.stops[0]?.decision, undefined);
    assert.equal(r.receipts.length, 1, code);
    assert.equal(r.receipts[0]?.command, "stop-gate");
    assert.equal(r.receipts[0]?.error, code);
    assert.equal(r.receipts[0]?.verdict, undefined);
    assert.equal(r.receipts[0]?.requests, 0);
    assert.equal(stopStats(r.stops).errors, 1);
  }
});

test("a credential in the final message stops the request: nothing is sent, and it is not a Jev error", async () => {
  const r = await run({ message: `Done. Deployed with ${FAKE.aws} as the key.` });
  assert.equal(r.requests.length, 0);
  assert.equal(r.stops[0]?.skipped, "credential");
  assert.equal(r.stops[0]?.error, "credential_in_state");
  assert.equal(r.receipts.length, 1);
  assert.equal(r.receipts[0]?.error, "credential_in_state");
  assert.equal(r.receipts[0]?.requests, 0);
  assert.ok(!JSON.stringify(r.stops).includes(FAKE.aws));
  assert.ok(!JSON.stringify(r.receipts).includes(FAKE.aws));
  const stats = stopStats(r.stops);
  assert.equal(stats.errors, 0);
  assert.equal(stats.error_rate, null);
  assert.deepEqual(stats.skipped_by_reason, { credential: 1 });
});

test("no usable key is recorded as no_key, not as a Jev error, with nothing sent", async () => {
  for (const [env, code] of [[{}, "no_api_key"], [{ REFEREE_BASE_URL_KEY: "ts bad key" }, "invalid_api_key"]] as const) {
    const r = await run({ noKey: true, env });
    assert.equal(r.requests.length, 0, code);
    assert.equal(r.printed, "");
    assert.equal(r.stops[0]?.skipped, "no_key", code);
    assert.equal(r.stops[0]?.error, code);
    assert.equal(r.receipts[0]?.error, code);
    assert.equal(stopStats(r.stops).error_rate, null);
  }
});

test("a pack that does not load is a config error: no request, no receipt, no breaker, not a Jev error", async () => {
  const missing = await run({ pack: "does-not-exist" });
  assert.equal(missing.requests.length, 0);
  assert.equal(missing.printed, "");
  assert.equal(missing.stops[0]?.skipped, "config_error");
  assert.equal(missing.stops[0]?.error, "pack_not_found");
  assert.equal(missing.receipts.length, 0);
  assert.equal(stopStats(missing.stops).error_rate, null);
  assert.equal(existsSync(join(missing.dataDir, "breaker")), false);
  const packs = tempDir();
  mkdirSync(join(packs, "mine", "questions"), { recursive: true });
  writeFileSync(join(packs, "mine", "pack.json"), JSON.stringify({ name: "mine", version: "0.1.0" }));
  writeFileSync(join(packs, "mine", "questions", "done.json"), JSON.stringify({ "done.met": { type: "noul", instructions: "Is it done?" } }));
  const partial = await run({ pack: "mine", env: { REFEREE_PACKS_DIR: packs } });
  assert.equal(partial.requests.length, 0);
  assert.equal(partial.stops[0]?.skipped, "config_error");
  assert.equal(partial.stops[0]?.error, "bad_pack");
  assert.equal(partial.receipts.length, 0);
});

test("a project file that does not load records nothing, unlike a pack that does not load; the hook entry exits 0 and prints nothing", () => {
  const entry = fileURLToPath(new URL("../src/hooks/main.ts", import.meta.url));
  const cases: [string, string[]][] = [
    ["{bad", []],
    [JSON.stringify({ hooks: { stopGate: "shadow" } }), []],
    [JSON.stringify({ pack: "does-not-exist", hooks: { stopGate: "shadow" } }), ["config_error"]],
  ];
  for (const [project, skipped] of cases) {
    const root = tempDir();
    mkdirSync(join(root, ".claude"));
    writeFileSync(join(root, ".claude/referee.json"), project);
    writeFileSync(join(root, "t.jsonl"), EDITED);
    const home = tempDir("referee-home-");
    const dataDir = join(home, "data");
    const stdin = JSON.stringify({ hook_event_name: "Stop", cwd: root, session_id: "s1", transcript_path: join(root, "t.jsonl") });
    const env = { PATH: process.env["PATH"] ?? "", HOME: home, REFEREE_DATA_DIR: dataDir, TYPESAFE_BASE_URL: "http://127.0.0.1:9" };
    const r = spawnSync(process.execPath, [entry, "stop"], { input: stdin, encoding: "utf8", env });
    assert.equal(r.status, 0, project);
    assert.equal(r.stdout, "", project);
    assert.equal(r.stderr, "", project);
    assert.deepEqual(readStops(dataDir).map((x) => x.skipped), skipped, project);
  }
});

test("active is not built: it runs as shadow, prints nothing and the record says what was configured", async () => {
  const r = await run({ stopGate: "active" });
  assert.equal(r.requests.length, 1);
  assert.equal(r.printed, "");
  assert.equal(r.stops[0]?.mode, "shadow");
  assert.equal(r.stops[0]?.configured, "active");
  assert.equal(r.stops[0]?.decision?.would_block, true);
  const skipped = await run({ stopGate: "active", transcript: NO_EDITS });
  assert.equal(skipped.stops[0]?.configured, "active");
  assert.equal("configured" in ((await run({ stopGate: "soft" })).stops[0] ?? {}), false);
});

test("three Jev failures in a session open the breaker and later stops skip Jev", async () => {
  const root = tempDir();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude/referee.json"), JSON.stringify({ pack: "generic", hooks: { stopGate: "shadow" } }));
  const transcript = join(root, "t.jsonl");
  writeFileSync(transcript, EDITED);
  const home = tempDir("referee-home-");
  const dataDir = join(home, "data");
  const server = await fakeJev(answers(0.95, 0.1, 0.9), { status: 503 });
  try {
    for (let i = 0; i < 4; i++) {
      await stopGate({ env: { REFEREE_DATA_DIR: dataDir, TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url }, home, now: () => Date.parse("2026-10-01T12:00:00Z") + i, readStdin: async () => JSON.stringify({ cwd: root, session_id: "s9", transcript_path: transcript }) }, root);
    }
    const stops = readStops(dataDir);
    assert.equal(stops.length, 4);
    assert.equal(stops[3]?.skipped, "breaker_open");
    assert.equal(stops[3]?.error, undefined);
    assert.deepEqual(stops.slice(0, 3).map((s) => s.error), ["service_unavailable", "service_unavailable", "service_unavailable"]);
    assert.equal(server.requests.length, 3);
    const receipts = readReceipts(dataDir, projectId(root));
    assert.deepEqual(receipts.map((r) => r.error), ["service_unavailable", "service_unavailable", "service_unavailable"]);
  } finally {
    await server.close();
  }
  assert.ok(existsSync(join(dataDir, "stops.jsonl")));
  assert.ok(readFileSync(join(dataDir, "stops.jsonl"), "utf8").length > 0);
});

test("soft: would_block returns one systemMessage line and records mode soft; no block fields", async () => {
  const r = await run({ stopGate: "soft" });
  const out = JSON.parse(r.printed) as Record<string, unknown>;
  assert.deepEqual(Object.keys(out), ["systemMessage"]);
  assert.match(String(out["systemMessage"]), /no passing check/);
  assert.equal(r.stops[0]?.mode, "soft");
  assert.equal(r.stops[0]?.decision?.would_block, true);
});

test("soft prints nothing when the message is verified or the gate skips", async () => {
  assert.equal((await run({ stopGate: "soft", answer: answers(0.95, 0.9, 0.9) })).printed, "");
  assert.equal((await run({ stopGate: "soft", transcript: NO_EDITS })).printed, "");
  assert.equal((await run({ stopGate: "soft", status: 500 })).printed, "");
});

const PERSISTED = "<persisted-output>\nOutput too large (47.9KB). Full output saved to: /x/y.txt\n\nPreview (first 2KB):\n> tsc\n\n...\n</persisted-output>";
const NOTE = { type: "user", promptSource: "system", origin: { kind: "task-notification" }, message: { role: "user", content: "<task-notification>\n<task-id>a1</task-id>\n<status>completed</status>\n<summary>Agent \"x\" finished</summary>\n</task-notification>" } };

test("a truncated check does not skip the gate; the marks are recorded but never sent to Jev", async () => {
  const transcript = lines(user("Fix it"), tool("e1", "Edit", { file_path: "src/a.ts" }), result("e1", "ok"), tool("b1", "Bash", { command: "npx tsc --noEmit" }), result("b1", PERSISTED), tool("g1", "Agent", { prompt: "review" }), result("g1", "Async agent launched successfully."), NOTE, said("Done, typecheck is clean."));
  const r = await run({ transcript });
  assert.equal(r.requests.length, 1);
  const stop = r.stops[0]!;
  assert.equal(stop.skipped, undefined);
  assert.equal(stop.truncated_checks, 1);
  assert.equal(stop.subagent_calls, 1);
  assert.equal(stop.subagent_reports, 1);
  const sent = JSON.stringify(r.requests[0]?.state);
  assert.deepEqual((r.requests[0]?.state as { checks: unknown[] }).checks, [{ cmd: "npx tsc --noEmit", status: "unknown" }]);
  assert.ok(!/truncated|subagent|stale/i.test(sent));
});

test("marks are recorded on skipped stops too, and absent when zero", async () => {
  const stale = lines(user("first"), tool("e1", "Edit", { file_path: "a.ts" }), result("e1", "ok"), tool("b1", "Bash", { command: "npm test" }), result("b1", "=== 12 passed in 1s ===\nexit code: 0"), said("ok"), user("second"), tool("e2", "Edit", { file_path: "b.ts" }), result("e2", "ok"), said("done"));
  const asked = await run({ transcript: stale });
  assert.equal(asked.stops[0]?.stale_pass, true);
  const plain = await run();
  assert.equal("stale_pass" in (plain.stops[0] ?? {}), false);
  assert.equal("truncated_checks" in (plain.stops[0] ?? {}), false);
  const skipped = await run({ transcript: lines(user("x"), tool("g1", "Agent", { prompt: "r" }), result("g1", "launched"), said("waiting")) });
  assert.equal(skipped.stops[0]?.skipped, "no_edits");
  assert.equal(skipped.stops[0]?.subagent_calls, 1);
});
