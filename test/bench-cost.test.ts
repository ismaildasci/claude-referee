// Cost accountant of the A/B: grouping by request id, 1h and 5m cache writes priced apart, unknown models, odd input, reconciliation. Fixtures are built from the shape of real transcript lines.

import assert from "node:assert/strict";
import { test } from "node:test";
import { accountTranscript, collectRequests, reconcile, sessionCost } from "../bench/cost.mjs";
import { PRICES, UnknownModelError, priceFor } from "../bench/pricing.mjs";

const usage = (over: Record<string, unknown> = {}) => ({
  input_tokens: 6,
  cache_creation_input_tokens: 14652,
  cache_read_input_tokens: 21218,
  output_tokens: 1739,
  output_tokens_details: { thinking_tokens: 1472 },
  server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
  service_tier: "standard",
  cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 14652 },
  inference_geo: "not_available",
  speed: "standard",
  ...over,
});
const line = (requestId: string | null, model: string, u: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ parentUuid: "p", isSidechain: false, message: { id: `msg_${requestId ?? "x"}`, model, usage: u, content: [{ type: "text", text: "t" }], stop_reason: "end_turn" }, ...(requestId ? { requestId } : {}), type: "assistant", uuid: `u-${Math.random()}`, ...extra });

test("prices come from the pinned table and an unknown model id throws", () => {
  assert.deepEqual(priceFor("claude-haiku-4-5-20251001"), { key: "claude-haiku-4-5", ...PRICES["claude-haiku-4-5"] });
  assert.equal(priceFor("claude-sonnet-5-5").key, "claude-sonnet-5-5");
  assert.equal(priceFor("claude-sonnet-5-20260101").key, "claude-sonnet-5");
  assert.equal(priceFor("claude-opus-4-1-20250805").key, "claude-opus-4-1");
  assert.equal(PRICES["claude-haiku-4-5"]!.cacheWrite1h, 2);
  assert.equal(PRICES["claude-sonnet-5-5"]!.cacheWrite5m, 2.5);
  assert.throws(() => priceFor("claude-banana-9"), UnknownModelError);
  assert.throws(() => accountTranscript(line("req_1", "gpt-9", usage())), UnknownModelError);
});

test("one request written as several content-block lines is counted once", () => {
  const u = usage();
  const text = [line("req_a", "claude-haiku-4-5-20251001", u), line("req_a", "claude-haiku-4-5-20251001", u), line("req_a", "claude-haiku-4-5-20251001", u), line("req_a", "claude-haiku-4-5-20251001", u)].join("\n");
  const found = collectRequests(text);
  assert.equal(found.requests.length, 1);
  assert.equal(found.lines, 4);
  const account = accountTranscript(text);
  assert.equal(account.requests, 1);
  assert.equal(account.usd, 0.029138);
  assert.deepEqual(account.tokens, { input: 6, output: 1739, cache5m: 14652, cache1h: 0, cacheRead: 21218 });
});

test("partial counts on an early line never lower the request: each field takes its largest value", () => {
  const early = usage({ output_tokens: 3, cache_read_input_tokens: 0 });
  const text = [line("req_b", "claude-haiku-4-5", early), line("req_b", "claude-haiku-4-5", usage())].join("\n");
  assert.equal(accountTranscript(text).tokens["output"], 1739);
  assert.equal(accountTranscript(text).tokens["cacheRead"], 21218);
});

test("1h and 5m cache writes are priced at their own rates", () => {
  const u = usage({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 3000, cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 2000 } });
  const account = accountTranscript(line("req_c", "claude-sonnet-5-5", u));
  assert.equal(account.usdBy["cache5m"], 0.0025);
  assert.equal(account.usdBy["cache1h"], 0.008);
  assert.equal(account.usd, 0.0105);
  assert.deepEqual(account.warnings, []);
});

test("a cache total with no split is priced as 5m writes and flagged; a split that disagrees with the total is flagged", () => {
  const { cache_creation: _drop, ...bare } = usage({ cache_creation_input_tokens: 1000, input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 });
  const a = accountTranscript(line("req_d", "claude-haiku-4-5", bare));
  assert.equal(a.usd, 0.00125);
  assert.deepEqual(a.warnings, ["cache_split_assumed_5m"]);
  const mismatch = usage({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1000, cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 100 } });
  assert.deepEqual(accountTranscript(line("req_e", "claude-haiku-4-5", mismatch)).warnings, ["cache_split_mismatch"]);
});

test("lines without a request id fall back to the message id, then count one by one and are flagged", () => {
  const text = [line(null, "claude-haiku-4-5", usage()), line(null, "claude-haiku-4-5", usage())].join("\n");
  const found = collectRequests(text);
  assert.equal(found.requests.length, 1);
  const noIds = [
    JSON.stringify({ type: "assistant", uuid: "a", message: { model: "claude-haiku-4-5", usage: usage() } }),
    JSON.stringify({ type: "assistant", uuid: "b", message: { model: "claude-haiku-4-5", usage: usage() } }),
  ].join("\n");
  const second = collectRequests(noIds);
  assert.equal(second.requests.length, 2);
  assert.ok(second.warnings.includes("request_without_id"));
});

test("synthetic lines, user lines, unparsable lines and sidechain requests", () => {
  const text = [
    line("req_f", "<synthetic>", usage({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } })),
    JSON.stringify({ type: "user", message: { role: "user", content: "hi", usage: usage() } }),
    '{"type":"assistant","usage": broken',
    line("req_g", "claude-haiku-4-5", usage(), { isSidechain: true }),
  ].join("\n");
  const account = accountTranscript(text);
  assert.equal(account.requests, 2);
  assert.equal(account.byModel["<synthetic>"]!.usd, 0);
  assert.ok(account.warnings.includes("unparsable_line"));
  assert.equal(collectRequests(text).requests.find((r) => r.key === "r:req_g")!.sidechain, true);
});

test("two requests are summed; web search is priced per request and the multi-iteration rule is flagged", () => {
  const u2 = usage({ input_tokens: 100, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 }, server_tool_use: { web_search_requests: 2 }, iterations: [{ type: "message" }, { type: "message" }] });
  const text = [line("req_h", "claude-haiku-4-5", usage()), line("req_i", "claude-haiku-4-5", u2)].join("\n");
  const account = accountTranscript(text);
  assert.equal(account.requests, 2);
  assert.equal(account.usd, 0.049738);
  assert.ok(account.warnings.includes("multi_iteration_top_level_used"));
});

test("an empty or failed run still produces a figure, and the session cost falls back in a fixed order", () => {
  const empty = accountTranscript("");
  assert.equal(empty.requests, 0);
  assert.equal(empty.usd, 0);
  assert.deepEqual(sessionCost({ account: empty, result: { total_cost_usd: 0.07 }, capUsd: 0.4 }), { usd: 0.07, source: "result_json" });
  assert.deepEqual(sessionCost({ account: empty, result: null, capUsd: 0.4 }), { usd: 0.4, source: "cap_upper_bound" });
  assert.deepEqual(sessionCost({ account: accountTranscript(line("r", "claude-haiku-4-5", usage())), result: { total_cost_usd: 9 }, capUsd: 0.4 }), { usd: 0.029138, source: "transcript" });
});

test("reconcile reports the gap between the transcript and the CLI total and the models only the CLI saw", () => {
  const account = accountTranscript(line("req_j", "claude-haiku-4-5", usage()));
  const r = reconcile(account, { total_cost_usd: 0.04, modelUsage: { "claude-haiku-4-5-20251001": {}, "claude-other": {} } });
  assert.equal(r.reported_usd, 0.04);
  assert.equal(r.gap_usd, 0.010862);
  assert.deepEqual(r.reported_models, ["claude-haiku-4-5-20251001", "claude-other"]);
  assert.deepEqual(r.extra_models, ["claude-other"]);
  assert.deepEqual(reconcile(account, null).gap_usd, null);
});
