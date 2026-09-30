// Jev client: answers, budgets and error classification against a local fake server.

import assert from "node:assert/strict";
import { test } from "node:test";
import { classify } from "../src/engine/classify.ts";
import { callJev } from "../src/engine/client.ts";
import { PROFILES } from "../src/engine/config.ts";
import { RefereeError } from "../src/engine/errors.ts";
import { fakeJev } from "./fake-jev.ts";

const call = { state: { text: "hello" }, questions: { q: { type: "noul" as const, instructions: "Is it a greeting?" } }, model: "jev-1.13.0" };

test("client returns answers, tokens and the request id", async () => {
  const server = await fakeJev();
  try {
    const reply = await callJev(call, { key: "ts_test", budget: PROFILES.cli, baseURL: server.url });
    assert.equal(reply.answers["q"]?.type, "noul");
    assert.equal(reply.inputTokens, 100);
    assert.equal(reply.requestId, "req_1");
    assert.equal(server.requests[0]?.model, "jev-1.13.0");
  } finally {
    await server.close();
  }
});

test("client hook profile gives up on a silent server within 2.1 s", async () => {
  const server = await fakeJev(undefined, { hang: true });
  const started = Date.now();
  try {
    await callJev(call, { key: "ts_test", budget: PROFILES.hook, baseURL: server.url });
    assert.fail("expected timeout");
  } catch (error) {
    assert.ok(error instanceof RefereeError);
    assert.equal(error.code, "timeout");
    assert.ok(Date.now() - started <= 2100, `took ${Date.now() - started} ms`);
  } finally {
    await server.close();
  }
});

test("client maps HTTP 401 to auth_failed without echoing the body", async () => {
  const server = await fakeJev(undefined, { status: 401 });
  try {
    await callJev(call, { key: "ts_test", budget: PROFILES.hook, baseURL: server.url });
    assert.fail("expected auth_failed");
  } catch (error) {
    assert.ok(error instanceof RefereeError);
    assert.equal(error.code, "auth_failed");
    assert.equal(error.details.status, 401);
    assert.ok(!error.message.includes("fake"));
  } finally {
    await server.close();
  }
});

test("client reports rate_limited at once when Retry-After is longer than the budget", async () => {
  const server = await fakeJev(undefined, { status: 429, retryAfter: "5" });
  const started = Date.now();
  try {
    await callJev(call, { key: "ts_test", budget: { budgetMs: 3000, perAttemptMs: 1000, maxRetries: 2 }, baseURL: server.url });
    assert.fail("expected rate_limited");
  } catch (error) {
    assert.ok(error instanceof RefereeError);
    assert.equal(error.code, "rate_limited");
    assert.equal(error.details.retry_after_ms, 5000);
    assert.equal(server.requests.length, 1);
    assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
  } finally {
    await server.close();
  }
});

test("client waits out a Retry-After that fits the budget, then answers", async () => {
  let calls = 0;
  const server = await fakeJev(undefined, { behave: () => (++calls === 1 ? { status: 429, retryAfter: "1" } : undefined) });
  const started = Date.now();
  try {
    const reply = await callJev(call, { key: "ts_test", budget: { budgetMs: 3000, perAttemptMs: 1000, maxRetries: 2 }, baseURL: server.url });
    assert.equal(reply.answers["q"]?.type, "noul");
    assert.equal(server.requests.length, 2);
    assert.ok(Date.now() - started >= 900, `took ${Date.now() - started} ms`);
  } finally {
    await server.close();
  }
});

test("client backs off on a 429 without Retry-After, then reports rate_limited", async () => {
  const server = await fakeJev(undefined, { status: 429 });
  try {
    await callJev(call, { key: "ts_test", budget: { budgetMs: 5000, perAttemptMs: 1000, maxRetries: 2 }, baseURL: server.url });
    assert.fail("expected rate_limited");
  } catch (error) {
    assert.ok(error instanceof RefereeError);
    assert.equal(error.code, "rate_limited");
    assert.equal(server.requests.length, 3);
  } finally {
    await server.close();
  }
});

test("client names the model and points to doctor --online when TypeSafe doesn't know it", async () => {
  const cases: [number, unknown, boolean][] = [
    [400, { detail: "Unknown model: jev-nope" }, true],
    [400, { detail: "questions must not be empty" }, false],
    [422, { detail: "questions must not be empty" }, false],
    [404, { error: "not found" }, false],
  ];
  for (const [status, body, hinted] of cases) {
    const server = await fakeJev(undefined, { behave: () => ({ status, body }) });
    try {
      await callJev({ ...call, model: "jev-nope" }, { key: "ts_test", budget: PROFILES.hook, baseURL: server.url });
      assert.fail("expected bad_request");
    } catch (error) {
      assert.ok(error instanceof RefereeError);
      assert.equal(error.code, "bad_request");
      const next = error.details.next_step ?? "";
      assert.equal(next.includes("jev-nope") && next.includes("doctor --online"), hinted, `${status}: ${next}`);
      assert.ok(!/unknown model/i.test(error.message) && !/unknown model/i.test(next));
    } finally {
      await server.close();
    }
  }
});

test("classify uses the error name, then status, then message", () => {
  const named = (name: string, extra: object = {}) => Object.assign(new Error("x"), { name }, extra);
  assert.equal(classify(named("APITimeoutError")).code, "timeout");
  assert.equal(classify(named("APIConnectionError")).code, "service_unavailable");
  assert.equal(classify(named("AuthenticationError")).code, "auth_failed");
  assert.equal(classify(named("PermissionDeniedError")).code, "auth_failed");
  assert.equal(classify(named("UnprocessableEntityError")).code, "bad_request");
  const limited = classify(named("RateLimitError", { status: 429, retryAfterMs: 1500 }));
  assert.equal(limited.code, "rate_limited");
  assert.equal(limited.details.retry_after_ms, 1500);
  assert.equal(classify({ status: 503 }).code, "service_unavailable");
  assert.equal(classify(new Error("Request timed out after 300ms.")).code, "timeout");
  assert.equal(classify(new Error("fetch failed")).code, "service_unavailable");
  assert.equal(classify(new Error("something odd")).code, "internal");
});
