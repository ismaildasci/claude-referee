// Gate 2 of docs/decisions/decide-balanced-near-ties.md: runs the built decide --fresh on the 8 replay candidates and compares its mean with the recorded mean over the same orders.
// Usage: node scripts/decide-scale/live-check.mjs ROOT OUT (about 60 Jev requests; needs the TypeSafe key).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const ROOT = process.argv[2], OUT = process.argv[3];
const ids = JSON.parse(readFileSync(`${ROOT}/jev-evals/decide-scale/results-adaptive.json`, "utf8")).gate2_candidates;
const cases = new Map(readFileSync(`${ROOT}/jev-evals/decide-close/cases.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((c) => [`close/${c.id}`, c]));
const rec = new Map();
for (const f of ["main"]) for (const l of readFileSync(`${ROOT}/jev-evals/decide-scale/recorded-${f}.jsonl`, "utf8").trim().split("\n")) { const r = JSON.parse(l); if (!rec.has(r.case)) rec.set(r.case, new Map()); rec.get(r.case).set(r.order.join(","), r.p); }
const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;
const rows = [];
for (const id of ids) {
  const c = cases.get(id);
  const input = JSON.stringify({ decision: c.decision, context: c.context, options: c.options });
  const out = JSON.parse(execFileSync("node", [`${ROOT}/plugins/claude-referee/dist/cli.mjs`, "decide", "--fresh"], { input, encoding: "utf8" }));
  const names = c.options.map((o) => o.name), n = names.length;
  const rot = (i) => [...names.slice(i), ...names.slice(0, i)];
  const orders = out.orders === 2 * n ? [...Array(n).keys()].flatMap((i) => [rot(i), [...rot(i)].reverse()]) : [rot(0), [...rot(0)].reverse()];
  const ans = rec.get(id);
  const mean = Object.fromEntries(names.map((nm) => [nm, orders.reduce((s, o) => s + (ans.get(o.join(","))?.[nm] ?? 0), 0) / orders.length]));
  const maeFloor = names.reduce((s, nm) => s + Math.abs(out.p[nm] - floor2(mean[nm])), 0) / n;
  const maeRaw = names.reduce((s, nm) => s + Math.abs(out.p[nm] - mean[nm]), 0) / n;
  const recLeader = names.reduce((b, nm) => (mean[nm] > mean[b] + 1e-9 ? nm : b), names[0]);
  rows.push({ id, orders: out.orders, triggered: out.orders === 2 * n, live_lean: out.lean, recorded_lean: recLeader, verdict: out.verdict, mae_floored: +maeFloor.toFixed(4), mae_raw: +maeRaw.toFixed(4), requests: out.requests, cached: out.cached, receipt: out.receipt });
}
const avg = (k) => +(rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(4);
const result = { rows, mean_mae_floored: avg("mae_floored"), mean_mae_raw: avg("mae_raw"), triggered: rows.filter((r) => r.triggered).length, same_leader: rows.filter((r) => r.live_lean === r.recorded_lean).length, pass: avg("mae_floored") <= 0.02 && avg("mae_raw") <= 0.02 };
writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify(result, null, 1));
