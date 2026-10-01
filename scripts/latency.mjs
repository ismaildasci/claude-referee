// P0-K K2: measures Jev latency for a ~500-token and a ~8K-token request at concurrency 1, 6 and 8.
// Each request carries a unique run line so no answer can come from a cache. Usage: node scripts/latency.mjs [--out file]

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : `results/latency-${new Date().toISOString().slice(0, 10)}.json`;
const PLAN = [
  { concurrency: 1, requests: 15 },
  { concurrency: 6, requests: 36 },
  { concurrency: 8, requests: 40 },
];

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

function testLog(lines) {
  const out = [];
  for (let i = 0; i < lines; i++) out.push(`PASS src/modules/feature_${i}/handler.test.ts (${(i % 9) + 3} tests) ${(i * 7) % 90 + 4} ms`);
  out.push(`Test Suites: ${lines} passed, ${lines} total`, `Tests: ${lines * 6} passed, ${lines * 6} total`, "npm test exit code: 0");
  return out.join("\n");
}

const SIZES = [
  { id: "small", evidence: testLog(8) },
  { id: "large", evidence: testLog(430) },
];
const question = {
  type: "noul",
  instructions: { question: "Does `evidence` show that `criterion` holds?", criterion: "all tests pass" },
  criteria: { true: "The output shows the criterion holds.", false: "The output does not show it, or shows that it fails." },
};

const key = apiKey();
let seq = 0;
async function one(size) {
  const body = { model: MODEL, state: { run: `latency probe ${Date.now()}-${seq++}`, evidence: size.evidence }, questions: { met: question } };
  const started = performance.now();
  try {
    const res = await fetch(`${BASE}/v1/systemone`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    const ms = performance.now() - started;
    let tokens = 0;
    try {
      tokens = JSON.parse(text)?.usage?.input_tokens ?? 0;
    } catch {}
    return { status: res.status, ms, tokens, retry_after: res.headers.get("retry-after") };
  } catch (e) {
    return { status: null, ms: performance.now() - started, tokens: 0, error: e instanceof Error ? e.name : String(e) };
  }
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)].toFixed(1));
}

const runs = [];
let totalTokens = 0;
let totalRequests = 0;
for (const size of SIZES) {
  for (const step of PLAN) {
    const samples = [];
    let next = 0;
    const started = performance.now();
    const worker = async () => {
      while (next < step.requests) {
        next++;
        samples.push(await one(size));
      }
    };
    await Promise.all(Array.from({ length: step.concurrency }, worker));
    const wall = performance.now() - started;
    const ok = samples.filter((s) => s.status === 200);
    const lat = ok.map((s) => s.ms).sort((a, b) => a - b);
    const tokens = samples.reduce((t, s) => t + s.tokens, 0);
    totalTokens += tokens;
    totalRequests += samples.length;
    const row = {
      size: size.id,
      concurrency: step.concurrency,
      requests: samples.length,
      ok: ok.length,
      status_429: samples.filter((s) => s.status === 429).length,
      other_errors: samples.filter((s) => s.status !== 200 && s.status !== 429).length,
      mean_input_tokens: ok.length ? Math.round(ok.reduce((t, s) => t + s.tokens, 0) / ok.length) : null,
      p50_ms: pct(lat, 50),
      p95_ms: pct(lat, 95),
      max_ms: lat.length ? Number(lat[lat.length - 1].toFixed(1)) : null,
      wall_s: Number((wall / 1000).toFixed(2)),
      requests_per_s: Number((samples.length / (wall / 1000)).toFixed(2)),
    };
    runs.push(row);
    console.log(JSON.stringify(row));
  }
}

const report = {
  date: new Date().toISOString(),
  endpoint: `${BASE}/v1/systemone`,
  model: MODEL,
  note: "Latency is measured client-side from this machine, including network. Every request has a unique run line; no retries.",
  requests: totalRequests,
  input_tokens: totalTokens,
  cost_usd: Number(((totalTokens * 0.042) / 1_000_000).toFixed(6)),
  runs,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`wrote ${out}; ${totalRequests} requests, input tokens ${totalTokens}, cost $${report.cost_usd}`);
