// P0-K K1: probes the TypeSafe API's edge cases with raw fetch and records status, body head and response headers.
// The key comes from TYPESAFE_API_KEY or the macOS Keychain; it is never printed or written. Usage: node scripts/probe-api.mjs [--out file]

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : `results/probe-${new Date().toISOString().slice(0, 10)}.json`;

function apiKey() {
  const own = process.env.REFEREE_BASE_URL_KEY?.trim();
  if (!/^https:\/\/api\.typesafe\.ai(\/|$)/.test(BASE)) {
    if (own) return own;
    throw new Error("TYPESAFE_BASE_URL points away from api.typesafe.ai: set REFEREE_BASE_URL_KEY; the TypeSafe key is never sent to another host.");
  }
  const fromEnv = process.env.TYPESAFE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

const noul = { type: "noul", instructions: "Does `text` describe a passing test run?", criteria: { true: "It says the tests passed.", false: "It does not." } };
const state = { text: "PASS src/app.test.ts (12 tests)" };
const levels = (n) => Array.from({ length: n }, (_, i) => `Level ${i + 1} of ${n}: ${"x".repeat(3)} description ${i + 1}`);
const options = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`opt${String.fromCharCode(97 + (i % 26))}${Math.floor(i / 26)}`, `Option number ${i + 1}`]));

const CASES = [
  { id: "baseline", note: "valid Noul request, control", body: { model: MODEL, state, questions: { q: noul } } },
  { id: "state_null", note: "state: null", body: { model: MODEL, state: null, questions: { q: noul } } },
  { id: "score_null_level", note: "Score criteria with a null level", body: { model: MODEL, state, questions: { q: { type: "score", instructions: "How long is `text`?", criteria: ["short", null, "long"] } } } },
  { id: "score_1_level", note: "Score with one level", body: { model: MODEL, state, questions: { q: { type: "score", instructions: "How long is `text`?", criteria: ["only level"] } } } },
  { id: "score_11_levels", note: "Score with eleven levels", body: { model: MODEL, state, questions: { q: { type: "score", instructions: "How long is `text`?", criteria: levels(11) } } } },
  { id: "choice_256_options", note: "Choice with 256 options", body: { model: MODEL, state, questions: { q: { type: "choice", instructions: "Which option best matches `text`?", criteria: options(256) } } } },
  { id: "unknown_model", note: 'model "no-such-model"', body: { model: "no-such-model", state, questions: { q: noul } } },
];

function pickHeaders(headers) {
  const keep = {};
  for (const [k, v] of headers) {
    if (k === "retry-after" || k === "retry-after-ms" || k === "x-typesafe-request-id" || k.startsWith("x-ratelimit")) keep[k] = v;
  }
  return keep;
}

const key = apiKey();
const results = [];
let inputTokens = 0;
for (const c of CASES) {
  const started = performance.now();
  let status = null;
  let body = "";
  let headers = {};
  let error = null;
  try {
    const res = await fetch(`${BASE}/v1/systemone`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(c.body),
      signal: AbortSignal.timeout(30_000),
    });
    status = res.status;
    headers = pickHeaders(res.headers);
    body = await res.text();
    try {
      inputTokens += JSON.parse(body)?.usage?.input_tokens ?? 0;
    } catch {}
  } catch (e) {
    error = e instanceof Error ? e.name + ": " + e.message : String(e);
  }
  const ms = Math.round(performance.now() - started);
  results.push({ id: c.id, note: c.note, status, ms, headers, body_head: body.slice(0, 2000), ...(error ? { error } : {}) });
  console.log(`${c.id}: ${status ?? error} (${ms} ms)`);
}

const report = {
  date: new Date().toISOString(),
  endpoint: `${BASE}/v1/systemone`,
  model: MODEL,
  requests: CASES.length,
  input_tokens: inputTokens,
  cost_usd: Number(((inputTokens * 0.042) / 1_000_000).toFixed(8)),
  results,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`wrote ${out}; input tokens ${inputTokens}, cost $${report.cost_usd}`);
