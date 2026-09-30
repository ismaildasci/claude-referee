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
