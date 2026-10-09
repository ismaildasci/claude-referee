// Circuit breaker: three Jev failures in a row silence the hook's Jev calls for the rest of that session.
// One file per session, so parallel sessions never lose each other's counts.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
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

test("breaker prunes sessions older than a day, keeps files it cannot read and removes the old breaker.json", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "breaker.json"), JSON.stringify({ sessions: { s0: { failures: 2, ts: NOW } } }));
  recordBreaker(dir, "old", false, NOW - 25 * 3_600_000);
  writeFileSync(join(dir, "breaker", "half-written"), "");
  recordBreaker(dir, "new", false, NOW);
  const files = readdirSync(join(dir, "breaker")).sort();
  assert.equal(files.length, 2);
  assert.ok(files.includes("half-written"));
  const own = files.find((f) => f !== "half-written") ?? "";
  assert.match(own, /^[0-9a-f]{32}$/);
  assert.equal(readFileSync(join(dir, "breaker", own), "utf8"), `1 ${NOW}`);
  assert.equal(existsSync(join(dir, "breaker.json")), false);
  recordBreaker(dir, "new", true, NOW);
  assert.deepEqual(readdirSync(join(dir, "breaker")), ["half-written"]);
});

test("a success with no breaker state creates nothing", () => {
  const dir = tempDir();
  recordBreaker(dir, "s1", true, NOW);
  assert.deepEqual(readdirSync(dir), []);
});

test("parallel sessions keep every failure count: 16 sessions failing three times each all open", async () => {
  const dir = tempDir();
  const worker = join(tempDir(), "fail.ts");
  const breaker = fileURLToPath(new URL("../src/engine/breaker.ts", import.meta.url));
  writeFileSync(worker, `import { recordBreaker } from ${JSON.stringify(pathToFileURL(breaker).href)};\nconst [dir, id] = process.argv.slice(2);\nfor (let i = 0; i < 3; i++) recordBreaker(dir, id, false, ${NOW});\n`);
  const ids = Array.from({ length: 16 }, (_, i) => `s${i}`);
  const codes = await Promise.all(ids.map((id) => new Promise<number | null>((resolve) => spawn(process.execPath, [worker, dir, id], { stdio: "ignore" }).on("close", resolve))));
  assert.deepEqual(codes, ids.map(() => 0));
  for (const id of ids) assert.equal(breakerOpen(dir, id), true, id);
  assert.equal(readdirSync(join(dir, "breaker")).filter((f) => f.endsWith(".tmp")).length, 0);
});

test("recordBreaker never throws on an unwritable data directory", () => {
  const base = tempDir();
  writeFileSync(join(base, "file"), "x");
  assert.doesNotThrow(() => recordBreaker(join(base, "file", "sub"), "s1", false, NOW));
  assert.equal(breakerOpen(join(base, "file", "sub"), "s1"), false);
});

const planned: Planned = { id: "p", state: { text: "x" }, questions: { q: { type: "noul", instructions: "Is it fine?" } } };

function hookSession(url: string, dataDir: string, sessionId: string): Session {
  const home = tempDir("referee-home-");
  return new Session({
    command: "hook",
    env: { TYPESAFE_API_KEY: "ts_test_key", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: url },
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
    const cli = new Session({ command: "done", env: { TYPESAFE_API_KEY: "ts_test_key", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url }, cwd: home, home, platform: "linux", now: () => NOW, pack: { name: "generic", version: "0.1.0" }, dataDir, sessionId: "s1" });
    assert.notEqual(await errorCode(cli.run([planned])), "breaker_open");
    assert.ok(server.requests.length >= 1);
  } finally {
    await server.close();
  }
});
