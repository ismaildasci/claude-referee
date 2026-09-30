// P0-K K3: asks decide.best for every decision in jev-evals/decide in all 24 option orders, plus one re-ask and one
// same-request pair (written and reversed criteria as two questions), and compares order policies with the all-24 leader.
// Usage: node scripts/order-sensitivity.mjs [--in jev-evals/decide/cases.jsonl] [--out file] [--limit n]

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const input = flag("--in", "jev-evals/decide/cases.jsonl");
const out = flag("--out", `results/order-${new Date().toISOString().slice(0, 10)}.json`);
const limit = Number(flag("--limit", "0"));
const CONCURRENCY = 6;

function apiKey() {
  const fromEnv = process.env.TYPESAFE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

const best = JSON.parse(readFileSync("plugins/claude-referee/packs/generic/questions/decide.json", "utf8"))["decide.best"];
let cases = readFileSync(input, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
if (limit > 0) cases = cases.slice(0, limit);

function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}
const question = (opts) => ({ ...best, criteria: Object.fromEntries(opts.map((o) => [o.name, o.text])) });

const key = apiKey();
let inputTokens = 0;
let requests = 0;
let retries429 = 0;
async function ask(state, questions) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/v1/systemone`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: AbortSignal.timeout(30_000),
    });
    requests++;
    const text = await res.text();
    if (res.status === 429 && attempt < 6) {
      retries429++;
      const after = Number(res.headers.get("retry-after-ms")) || Number(res.headers.get("retry-after")) * 1000 || Math.min(500 * 2 ** attempt, 8000);
      await sleep(after);
      continue;
    }
    if (res.status !== 200) throw new Error(`status ${res.status}: ${text.slice(0, 200)}`);
    const body = JSON.parse(text);
    inputTokens += body.usage?.input_tokens ?? 0;
    return body.answers;
  }
}

const tasks = [];
const raw = cases.map((c) => ({ id: c.id, orders: [], reask: null, pair: null }));
cases.forEach((c, ci) => {
  const state = { decision: c.decision, context: c.context };
  const perms = permutations(c.options);
  perms.forEach((perm, oi) => tasks.push(async () => {
    const a = await ask(state, { best: question(perm) });
    raw[ci].orders[oi] = { order: perm.map((o) => o.name), p: a.best.probabilities };
  }));
  tasks.push(async () => {
    const a = await ask(state, { best: question(c.options) });
    raw[ci].reask = a.best.probabilities;
  });
  tasks.push(async () => {
    const a = await ask(state, { best_written: question(c.options), best_reversed: question([...c.options].reverse()) });
    raw[ci].pair = { written: a.best_written.probabilities, reversed: a.best_reversed.probabilities };
  });
});

let next = 0;
let done = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < tasks.length) {
    const t = tasks[next++];
    await t();
    if (++done % 60 === 0) console.log(`${done}/${tasks.length}`);
  }
}));

const argmax = (p) => Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
const mean = (ps, names) => Object.fromEntries(names.map((n) => [n, ps.reduce((s, p) => s + (p[n] ?? 0), 0) / ps.length]));
const round = (x) => Number(x.toFixed(4));

const perDecision = raw.map((r, ci) => {
  const names = cases[ci].options.map((o) => o.name);
  const written = r.orders[0].p;
  const reversedIndex = r.orders.findIndex((o) => o.order.join() === [...names].reverse().join());
  const reversed = r.orders[reversedIndex].p;
  const all = mean(r.orders.map((o) => o.p), names);
  const leader = argmax(all);
  const spread = Object.fromEntries(names.map((n) => {
    const vals = r.orders.map((o) => o.p[n] ?? 0);
    return [n, round(Math.max(...vals) - Math.min(...vals))];
  }));
  const rotations = [0, 1, 2, 3].map((k) => [...names.slice(k), ...names.slice(0, k)].join());
  const rotationPs = r.orders.filter((o) => rotations.includes(o.order.join())).map((o) => o.p);
  const slotResidual = [0, 1, 2, 3].map((slot) => r.orders.reduce((s, o) => s + ((o.p[o.order[slot]] ?? 0) - all[o.order[slot]]), 0) / r.orders.length);
  const reaskDelta = Math.max(...names.map((n) => Math.abs((r.reask[n] ?? 0) - (written[n] ?? 0))));
  const k3Reversed = Math.max(...names.map((n) => Math.abs((r.pair.reversed[n] ?? 0) - (reversed[n] ?? 0))));
  const k3Written = Math.max(...names.map((n) => Math.abs((r.pair.written[n] ?? 0) - (written[n] ?? 0))));
  const pairLeader = argmax(mean([r.pair.written, r.pair.reversed], names));
  return {
    id: r.id,
    leader_all24: leader,
    p_leader_all24: round(all[leader]),
    max_spread: round(Math.max(...Object.values(spread))),
    spread,
    distinct_argmax: new Set(r.orders.map((o) => argmax(o.p))).size,
    orders_leader_differs: r.orders.filter((o) => argmax(o.p) !== leader).length,
    policy: {
      written: argmax(written) === leader,
      written_reversed: argmax(mean([written, reversed], names)) === leader,
      rotations4: argmax(mean(rotationPs, names)) === leader,
      same_request_pair: pairLeader === leader,
    },
    slot_residual: slotResidual.map(round),
    reask_max_delta: round(reaskDelta),
    k3_same_request_vs_separate: { reversed_max_delta: round(k3Reversed), written_max_delta: round(k3Written) },
  };
});

const n = perDecision.length;
const count = (f) => perDecision.filter(f).length;
const spreads = perDecision.map((d) => d.max_spread);
const allSlot = perDecision.flatMap((d) => d.slot_residual.map(Math.abs));
const summary = {
  decisions: n,
  requests,
  retries_429: retries429,
  input_tokens: inputTokens,
  cost_usd: Number(((inputTokens * 0.042) / 1_000_000).toFixed(6)),
  max_spread_mean: round(spreads.reduce((a, b) => a + b, 0) / n),
  max_spread_max: round(Math.max(...spreads)),
  decisions_spread_ge_0_24: count((d) => d.max_spread >= 0.24),
  decisions_with_leader_change_across_orders: count((d) => d.orders_leader_differs > 0),
  policy_agreement_with_all24: {
    written: count((d) => d.policy.written),
    written_reversed: count((d) => d.policy.written_reversed),
    rotations4: count((d) => d.policy.rotations4),
    same_request_pair: count((d) => d.policy.same_request_pair),
  },
  slot_bias_abs_mean: round(allSlot.reduce((a, b) => a + b, 0) / allSlot.length),
  slot_bias_abs_max: round(Math.max(...allSlot)),
  reask_max_delta: round(Math.max(...perDecision.map((d) => d.reask_max_delta))),
  k3_reversed_max_delta: round(Math.max(...perDecision.map((d) => d.k3_same_request_vs_separate.reversed_max_delta))),
  k3_reversed_mean_delta: round(perDecision.reduce((s, d) => s + d.k3_same_request_vs_separate.reversed_max_delta, 0) / n),
  k3_written_max_delta: round(Math.max(...perDecision.map((d) => d.k3_same_request_vs_separate.written_max_delta))),
};

const report = {
  date: new Date().toISOString(),
  model: MODEL,
  input,
  method: "Each decision's decide.best Choice asked in all 24 option orders (one request each), the written order once more (re-ask), and once as a single request holding two questions: the written and the reversed criteria. Leader = argmax of the mean over the 24 orders. Spread = max - min of one option's probability across orders; per decision the largest over options. Slot residual = mean over orders of p(option in slot) - that option's all-orders mean.",
  summary,
  decisions: perDecision,
  raw,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
console.log(JSON.stringify(summary, null, 1));
console.log(`wrote ${out}`);
