// Collector for the one-request pilot: rounds of pair (one request, two question keys) and two-request (parallel) arms. Appends to raw.jsonl.
// Usage: node run.mjs  (cwd = repo root). Resumable; hard request cap 470 for this script.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const S = "<scratchpad>/both-orders-one-request";
const RAW = `${S}/raw.jsonl`;
const MODEL = "jev-1.13.0";
const CAP = 470;
const key = process.env.TYPESAFE_API_KEY?.trim() || execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const best = JSON.parse(readFileSync("plugins/evidence-referee/packs/generic/questions/decide.json", "utf8"))["decide.best"];
const q = (opts) => ({ ...best, criteria: Object.fromEntries(opts.map((o) => [o.name, o.text])) });
const cases = readFileSync("jev-evals/decide-close/cases.jsonl", "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const done = new Set(existsSync(RAW) ? readFileSync(RAW, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.id}|${r.round}|${r.arm}`; }) : []);
let requests = existsSync(RAW) ? readFileSync(RAW, "utf8").split("\n").filter(Boolean).reduce((n, l) => n + JSON.parse(l).requests, 0) : 0;
let retries = 0;

async function call(state, questions) {
  for (let attempt = 0; ; attempt++) {
    if (requests >= CAP) throw new Error("request cap reached");
    const t0 = performance.now();
    const res = await fetch("https://api.typesafe.ai/v1/systemone", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: MODEL, state, questions }), signal: AbortSignal.timeout(30000) });
    requests++;
    const text = await res.text();
    const ms = performance.now() - t0;
    if (res.status === 429 && attempt < 5) {
      retries++;
      await sleep(Number(res.headers.get("retry-after-ms")) || Number(res.headers.get("retry-after")) * 1000 || Math.min(500 * 2 ** attempt, 8000));
      continue;
    }
    if (res.status !== 200) throw new Error(`status ${res.status}: ${text.slice(0, 160)}`);
    const body = JSON.parse(text);
    return { answers: body.answers, tokens: body.usage?.input_tokens ?? 0, ms, retried: attempt };
  }
}
const save = (r) => appendFileSync(RAW, JSON.stringify(r) + "\n");

async function pair(c, round) {
  if (done.has(`${c.id}|${round}|pair`)) return;
  const t0 = performance.now(); const r0 = requests;
  const r = await call({ decision: c.decision, context: c.context }, { best_written: q(c.options), best_reversed: q([...c.options].reverse()) });
  save({ id: c.id, round, arm: "pair", written: r.answers.best_written, reversed: r.answers.best_reversed, tokens: r.tokens, wall_ms: performance.now() - t0, retried: r.retried, requests: requests - r0 });
}
async function two(c, round) {
  if (done.has(`${c.id}|${round}|two`)) return;
  const state = { decision: c.decision, context: c.context };
  const t0 = performance.now(); const r0 = requests;
  const [w, v] = await Promise.all([call(state, { best: q(c.options) }), call(state, { best: q([...c.options].reverse()) })]);
  save({ id: c.id, round, arm: "two", written: w.answers.best, reversed: v.answers.best, tokens: w.tokens + v.tokens, wall_ms: performance.now() - t0, each_ms: [w.ms, v.ms], retried: w.retried + v.retried, requests: requests - r0 });
}
if (!done.has("warmup|0|pair")) { const c = cases[0]; const r0 = requests; await call({ decision: c.decision, context: c.context }, { best: q(c.options) }); save({ id: "warmup", round: 0, arm: "pair", requests: requests - r0 }); console.log("warm-up done (counted, excluded from analysis)"); }
for (const round of [1, 2, 3]) {
  for (const [i, c] of cases.entries()) {
    const pairFirst = round === 1 ? i % 2 === 0 : i % 2 === 1;
    if (round === 3) { await pair(c, 3); continue; }
    if (pairFirst) { await pair(c, round); await two(c, round); } else { await two(c, round); await pair(c, round); }
  }
  console.log(`round ${round} done, requests ${requests}, 429 retries ${retries}`);
}
