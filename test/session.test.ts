// Session: in-flight merging, cache, --fresh, credential stops, dry runs and receipts.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { RefereeError } from "../src/engine/errors.ts";
import { Session, type Planned } from "../src/engine/session.ts";
import { fakeJev, type FakeJev } from "./fake-jev.ts";
import { FAKE, tempDir } from "./helpers.ts";

const pack = { name: "generic", version: "0.1.0" };

function session(server: FakeJev | null, dataDir: string, extra: { fresh?: boolean; deadlineMs?: number } = {}): Session {
  const home = tempDir("referee-home-");
  return new Session({
    command: "test",
    env: { TYPESAFE_API_KEY: "ts_test_key", ...(server ? { TYPESAFE_BASE_URL: server.url } : {}) },
    cwd: home,
    home,
    platform: "linux",
    now: () => Date.now(),
    pack,
    dataDir,
    ...extra,
  });
}

const noul = (id: string, text: string): Planned => ({ id, state: { text }, questions: { q: { type: "noul", instructions: "Is it fine?" } } });

test("session merges identical in-flight requests into one call", async () => {
  const server = await fakeJev();
  try {
    const s = session(server, tempDir());
    const out = await s.run([noul("a", "same"), noul("b", "same")]);
    assert.equal(server.requests.length, 1);
    assert.equal(out.length, 2);
    assert.deepEqual(s.stats(), { requests: 1, cached: 1 });
  } finally {
    await server.close();
  }
});

test("session serves repeats from the cache and --fresh bypasses it", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  try {
    await session(server, dataDir).run([noul("a", "x")]);
    const again = session(server, dataDir);
    const [hit] = await again.run([noul("a", "x")]);
    assert.equal(hit?.cached, true);
    assert.equal(server.requests.length, 1);
    await session(server, dataDir, { fresh: true }).run([noul("a", "x")]);
    assert.equal(server.requests.length, 2);
  } finally {
    await server.close();
  }
});

test("session never shares a cache entry between option orders", async () => {
  const server = await fakeJev();
  try {
    const choice = (id: string, labels: string[]): Planned => ({
      id,
      state: { decision: "d" },
      questions: { best: { type: "choice", instructions: "Which?", criteria: Object.fromEntries(labels.map((l) => [l, l])) } },
    });
    await session(server, tempDir()).run([choice("w", ["a", "b"]), choice("r", ["b", "a"])]);
    assert.equal(server.requests.length, 2);
  } finally {
    await server.close();
  }
});

test("session stops a single request with a credential before any call", async () => {
  const server = await fakeJev();
  try {
    await assert.rejects(session(server, tempDir()).run([noul("a", FAKE.aws)]), (e: unknown) => e instanceof RefereeError && e.code === "credential_in_state");
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("session skips a stopped batch item and answers the rest", async () => {
  const server = await fakeJev();
  try {
    const out = await session(server, tempDir()).run([noul("a", FAKE.aws), noul("b", "fine")], { batch: true });
    assert.equal(out[0]?.answers, null);
    assert.equal(out[0]?.stopped[0]?.kind, "aws_access_key");
    assert.ok(out[1]?.answers);
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
  }
});

test("session dry run sends nothing and writes nothing", async () => {
  const dataDir = tempDir();
  const s = session(null, dataDir);
  const result = s.dryRun([noul("a", "mail ops@acme.io")]);
  assert.equal(result["requests"], 1);
  assert.match(JSON.stringify(result["sent"]), /\[REDACTED:email\]/);
  assert.deepEqual(readdirSync(dataDir), []);
  assert.throws(() => session(null, dataDir).dryRun([noul("a", FAKE.aws)]), RefereeError);
});

test("session receipt totals the run without paths or request text", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  try {
    const s = session(server, dataDir);
    await s.run([noul("a", "secret-free text")]);
    const receipt = s.record({ verdict: "met" });
    assert.equal(receipt.requests, 1);
    assert.equal(receipt.input_tokens, 100);
    assert.equal(receipt.cost_usd, 0.0000042);
    assert.deepEqual(receipt.request_ids, ["req_1"]);
    const dir = join(dataDir, "receipts", receipt.project);
    assert.ok(existsSync(dir));
    const text = readFileSync(join(dir, readdirSync(dir)[0] ?? ""), "utf8");
    assert.ok(!text.includes("secret-free text") && !text.includes(dataDir) && !text.includes("/Users/"));
  } finally {
    await server.close();
  }
});

const text = (r: { state: unknown }) => (r.state as { text: string }).text;

test("session batch keeps the other answers when one item fails", async () => {
  const server = await fakeJev(undefined, { behave: (r) => (text(r) === "bad" ? { status: 400 } : undefined) });
  try {
    const out = await session(server, tempDir()).run([noul("a", "ok"), noul("b", "bad"), noul("c", "fine")], { batch: true });
    assert.deepEqual(
      out.map((o) => [o.id, o.answers !== null, o.error ?? null]),
      [
        ["a", true, null],
        ["b", false, "bad_request"],
        ["c", true, null],
      ],
    );
  } finally {
    await server.close();
  }
});

test("session batch stops at the deadline and marks the rest unanswered", async () => {
  const server = await fakeJev(undefined, { behave: (r) => (text(r) === "slow" ? { hang: true } : undefined) });
  const started = Date.now();
  try {
    const out = await session(server, tempDir(), { deadlineMs: 400 }).run([noul("a", "ok"), noul("b", "slow")], { batch: true });
    assert.notEqual(out[0]?.answers, null);
    assert.equal(out[1]?.answers, null);
    assert.equal(out[1]?.error, "timeout");
    assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
  } finally {
    await server.close();
  }
});

test("session batch still fails when no item got an answer", async () => {
  const server = await fakeJev(undefined, { status: 401 });
  try {
    await assert.rejects(session(server, tempDir()).run([noul("a", "x"), noul("b", "y")], { batch: true }), (e) => e instanceof RefereeError && e.code === "auth_failed");
  } finally {
    await server.close();
  }
});
