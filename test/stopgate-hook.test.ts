// Stop hook in shadow mode: records its decision, never blocks or prints, and fails open on every error.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { stopGate } from "../src/hooks/stop.ts";
import { readStops } from "../src/engine/stopgate/stops.ts";
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

async function run(options: { transcript?: string | null; stopGate?: string | null; input?: object; env?: Record<string, string>; answer?: Answerer; status?: number; message?: string } = {}) {
  const root = tempDir();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude/referee.json"), JSON.stringify({ pack: "generic", hooks: options.stopGate === null ? {} : { stopGate: options.stopGate ?? "shadow" } }));
  const transcript = join(root, "t.jsonl");
  if (options.transcript !== null) writeFileSync(transcript, options.transcript ?? EDITED);
  const home = tempDir("referee-home-");
  const dataDir = join(home, "data");
  const server: FakeJev = await fakeJev(options.answer ?? answers(0.95, 0.1, 0.9), options.status ? { status: options.status } : undefined);
  try {
    const stdin = JSON.stringify({ hook_event_name: "Stop", cwd: root, session_id: "s1", transcript_path: transcript, ...(options.message ? { last_assistant_message: options.message } : {}), ...options.input });
    const returned = await stopGate({ env: { REFEREE_DATA_DIR: dataDir, TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, ...options.env }, home, now: () => Date.parse("2026-10-01T12:00:00Z"), readStdin: async () => stdin }, root);
    return { stops: readStops(dataDir), requests: server.requests, printed: returned === undefined ? "" : "output", dataDir };
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
  assert.equal((await run({ env: { REFEREE_HOOKS: "off" } })).stops.length, 0);
  assert.equal((await run({ env: { CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED: "false" } })).stops.length, 0);
});

test("a Jev error fails open and is recorded, with nothing printed", async () => {
  const r = await run({ status: 500 });
  assert.equal(r.printed, "");
  assert.equal(r.stops[0]?.skipped, "jev_error");
  assert.equal(r.stops[0]?.decision, undefined);
});

test("a credential in the final message stops the request and nothing is sent", async () => {
  const r = await run({ message: `Done. Deployed with ${FAKE.aws} as the key.` });
  assert.equal(r.requests.length, 0);
  assert.equal(r.stops[0]?.skipped, "jev_error");
  assert.ok(!JSON.stringify(r.stops).includes(FAKE.aws));
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
    assert.equal(server.requests.length, 3);
  } finally {
    await server.close();
  }
  assert.ok(existsSync(join(dataDir, "stops.jsonl")));
  assert.ok(readFileSync(join(dataDir, "stops.jsonl"), "utf8").length > 0);
});
