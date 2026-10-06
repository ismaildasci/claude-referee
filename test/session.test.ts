// Session: in-flight merging, cache, --fresh, credential stops, dry runs and receipts.

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { writeCache } from "../src/engine/cache.ts";
import { RefereeError } from "../src/engine/errors.ts";
import { endpointOf } from "../src/engine/key.ts";
import { Session, type Planned } from "../src/engine/session.ts";
import { fakeJev, type FakeJev } from "./fake-jev.ts";
import { FAKE, tempDir } from "./helpers.ts";

const pack = { name: "generic", version: "0.1.0" };

function session(server: FakeJev | null, dataDir: string, extra: { fresh?: boolean; deadlineMs?: number } = {}, env: Record<string, string> = {}): Session {
  const home = tempDir("referee-home-");
  return new Session({
    command: "test",
    env: { TYPESAFE_API_KEY: "ts_test_key", ...(server ? { REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url } : {}), ...env },
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

test("session receipt records the cost as unknown, not 0, when the answering model has no known price", async () => {
  const server = await fakeJev();
  try {
    const s = session(server, tempDir(), {}, { TYPESAFE_MODEL: "jev-unpriced" });
    await s.run([noul("a", "some text")]);
    const receipt = s.record({ verdict: "met" });
    assert.equal(receipt.requests, 1);
    assert.equal(receipt.input_tokens, 100);
    assert.equal(receipt.cost_usd, null);
  } finally {
    await server.close();
  }
});

const text = (r: { state: unknown }) => (r.state as { text: string }).text;

test("session waits for the requests still in flight when one fails, so the receipt counts every billed request", async () => {
  const server = await fakeJev(undefined, { behave: (r) => (text(r) === "a" ? { status: 400 } : { delayMs: 200 }) });
  try {
    const s = session(server, tempDir());
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"].map((t) => noul(t, t));
    const error = await s.run(items).then(
      () => assert.fail("run should reject"),
      (e: unknown) => e,
    );
    assert.ok(error instanceof RefereeError);
    assert.equal(error.code, "bad_request");
    const receipt = s.record({ error });
    assert.equal(receipt.requests, 5);
    assert.equal(receipt.input_tokens, 500);
    assert.equal(receipt.request_ids?.length, 5);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(server.requests.length, 6);
  } finally {
    await server.close();
  }
});

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

test("the answer cache is kept per endpoint, and the default endpoint keeps the cache keys it always had", async () => {
  const yes = await fakeJev(() => ({ q: { type: "noul", noul: 0.97 } }));
  const no = await fakeJev(() => ({ q: { type: "noul", noul: 0.02 } }));
  const dataDir = tempDir();
  try {
    await session(yes, dataDir).run([noul("x", "same")]);
    const [other] = await session(no, dataDir).run([noul("x", "same")]);
    assert.equal(no.requests.length, 1);
    assert.equal(other?.cached, false);
    assert.deepEqual(other?.answers?.["q"], { type: "noul", noul: 0.02 });
    const [again] = await session(yes, dataDir).run([noul("x", "same")]);
    assert.equal(again?.cached, true);
    assert.equal(yes.requests.length, 1);
  } finally {
    await yes.close();
    await no.close();
  }
  const pinned = "3aa5cb85f58ebcac208a9e0fece05dc6f5ab4afaf6e2c995a1da74ba6d64bcfa";
  for (const base of [undefined, "", "https://api.typesafe.ai", "https://api.typesafe.ai/"]) {
    const cacheDir = tempDir();
    writeCache(cacheDir, pinned, { ts: Date.now(), model: "jev-1.13.0", answers: { q: { type: "noul", noul: 0.5 } }, inputTokens: 1 });
    const home = tempDir("referee-home-");
    const offline = new Session({ command: "test", env: base === undefined ? {} : { TYPESAFE_BASE_URL: base }, cwd: home, home, platform: "linux", now: () => Date.now(), pack, dataDir: cacheDir });
    const [hit] = await offline.run([noul("a", "same")]);
    assert.equal(hit?.cached, true, String(base));
  }
  assert.equal(endpointOf("https://user:pass@proxy.example/v1/?token=x#frag"), "https://proxy.example/v1");
});
