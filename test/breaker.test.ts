// Circuit breaker: three Jev failures in a row silence the hook's Jev calls for the rest of that session.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { breakerOpen, recordBreaker } from "../src/engine/breaker.ts";
import { isRefereeError } from "../src/engine/errors.ts";
import { Session, type Planned } from "../src/engine/session.ts";
import { fakeJev } from "./fake-jev.ts";
import { tempDir } from "./helpers.ts";

const NOW = Date.parse("2026-10-01T12:00:00Z");

test("breaker opens after three failures in a row and a success resets it", () => {
  const dir = tempDir();
  for (let i = 0; i < 2; i++) recordBreaker(dir, "s1", false, NOW);
  assert.equal(breakerOpen(dir, "s1"), false);
  recordBreaker(dir, "s1", true, NOW);
  for (let i = 0; i < 2; i++) recordBreaker(dir, "s1", false, NOW);
  assert.equal(breakerOpen(dir, "s1"), false);
  recordBreaker(dir, "s1", false, NOW);
  assert.equal(breakerOpen(dir, "s1"), true);
  assert.equal(breakerOpen(dir, "s2"), false);
});

test("breaker prunes sessions older than a day", () => {
  const dir = tempDir();
  recordBreaker(dir, "old", false, NOW - 25 * 3_600_000);
  recordBreaker(dir, "new", false, NOW);
  const state = JSON.parse(readFileSync(join(dir, "breaker.json"), "utf8")) as { sessions: Record<string, unknown> };
  assert.deepEqual(Object.keys(state.sessions), ["new"]);
});

const planned: Planned = { id: "p", state: { text: "x" }, questions: { q: { type: "noul", instructions: "Is it fine?" } } };

function hookSession(url: string, dataDir: string, sessionId: string): Session {
  const home = tempDir("referee-home-");
  return new Session({
    command: "hook",
    env: { TYPESAFE_API_KEY: "ts_test_key", TYPESAFE_BASE_URL: url },
    cwd: home,
    home,
    platform: "linux",
    now: () => NOW,
    pack: { name: "generic", version: "0.1.0" },
    dataDir,
    profile: "hook",
    sessionId,
  });
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "none";
  } catch (error) {
    return isRefereeError(error) ? error.code : "other";
  }
}

test("a hook session skips Jev after three failures; other sessions still call it", async () => {
  const server = await fakeJev(undefined, { status: 503 });
  const dataDir = tempDir();
  try {
    for (let i = 0; i < 3; i++) assert.equal(await errorCode(hookSession(server.url, dataDir, "s1").run([planned])), "service_unavailable");
    assert.equal(server.requests.length, 3);
    assert.equal(await errorCode(hookSession(server.url, dataDir, "s1").run([planned])), "breaker_open");
    assert.equal(server.requests.length, 3);
    assert.equal(await errorCode(hookSession(server.url, dataDir, "s2").run([planned])), "service_unavailable");
    assert.equal(server.requests.length, 4);
  } finally {
    await server.close();
  }
});

test("the CLI profile never uses the breaker", async () => {
  const server = await fakeJev(undefined, { status: 503 });
  const dataDir = tempDir();
  try {
    for (let i = 0; i < 3; i++) recordBreaker(dataDir, "s1", false, NOW);
    const home = tempDir("referee-home-");
    const cli = new Session({ command: "done", env: { TYPESAFE_API_KEY: "ts_test_key", TYPESAFE_BASE_URL: server.url }, cwd: home, home, platform: "linux", now: () => NOW, pack: { name: "generic", version: "0.1.0" }, dataDir, sessionId: "s1" });
    assert.notEqual(await errorCode(cli.run([planned])), "breaker_open");
    assert.ok(server.requests.length >= 1);
  } finally {
    await server.close();
  }
});
