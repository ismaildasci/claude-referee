// Part B: live re-ask. B1 direct API (raw p), B2/B4 built CLI with --fresh and own data dir. Key is never printed. Hard cap 80 counted requests.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const D = new URL(".", import.meta.url).pathname;
const BASE = "https://api.typesafe.ai", CAP = 80;
let count = 0;
const key = execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const sel = JSON.parse(readFileSync(D + "selection.json", "utf8"));
const L = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const best = JSON.parse(readFileSync("plugins/evidence-referee/packs/generic/questions/decide.json", "utf8"))["decide.best"];
const log = (o) => appendFileSync(D + "live.jsonl", JSON.stringify(o) + "\n");
async function ask(state, questions) {
  if (count >= CAP) throw new Error("cap");
  count++;
  for (let a = 0; ; a++) {
    const res = await fetch(`${BASE}/v1/systemone`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: "jev-1.13.0", state, questions }), signal: AbortSignal.timeout(30000) });
    if (res.status === 429 && a < 5) { await sleep(1000 * 2 ** a); count++; continue; }
    if (res.status !== 200) throw new Error("status " + res.status);
    return (await res.json()).answers;
  }
}
// B1: top 8 by recorded rule
const cases = L("jev-evals/decide-close/cases.jsonl");
const ids = ["ba1-iac-apply", "bb1-flaky-tests", "bb1-recovery-policy", "vb1-secrets-norot", "bb1-advisory-handling", "ba1-mysql-postgres"];
// two more by the same rule: recompute
const j = JSON.parse(readFileSync("jev-evals/decide-close/order-2026-10-01.json", "utf8"));
const sc = cases.map((c) => { const d = j.raw.find((x) => x.id === c.id); const m = new Map(d.orders.map((o) => [o.order.join(","), o.p])); const w = m.get(c.options.map((o) => o.name).join(",")), r = m.get([...c.options].reverse().map((o) => o.name).join(",")); const mean = c.options.map((o) => (w[o.name] + r[o.name]) / 2).sort((a, b) => b - a); return { id: c.id, dist: Math.abs(mean[0] - mean[1] - 0.1) }; }).sort((a, b) => a.dist - b.dist || a.id.localeCompare(b.id)).slice(0, 8);
writeFileSync(D + "selection-b1.json", JSON.stringify(sc));
const b1 = sc.map((s) => cases.find((c) => c.id === s.id));
const tasks = [];
for (const c of b1) for (let r = 0; r < 6; r++) tasks.push(c);
// interleave repeats across cases (round-robin) so drift in time is not confounded with case
tasks.sort((x, y) => 0);
for (let r = 0; r < 6; r++) {
  await Promise.all(b1.map(async (c) => {
    const a = await ask({ decision: c.decision, context: c.context }, { best: { ...best, criteria: Object.fromEntries(c.options.map((o) => [o.name, o.text])) } });
    log({ part: "B1", id: c.id, rep: r, p: a.best.probabilities });
  }));
}
console.log("B1 done, requests", count);
// B2 via CLI
const done = L("jev-evals/done-v2/cases-dev.jsonl"), rec = L("jev-evals/done-v2/recorded.jsonl").filter((r) => r.split === "dev");
const seen = new Set(); const b2 = [];
for (const r of rec.map((r) => ({ case: r.case, p: r.answers.c1.noul, dist: Math.min(Math.abs(r.answers.c1.noul - 0.7), Math.abs(r.answers.c1.noul - 0.5)) })).sort((a, b) => a.dist - b.dist || a.case.localeCompare(b.case))) { if (!seen.has(r.case) && b2.length < 4) { seen.add(r.case); b2.push(r); } }
writeFileSync(D + "selection-b2.json", JSON.stringify(b2));
const cli = (args, input) => JSON.parse(execFileSync("node", ["plugins/evidence-referee/dist/cli.mjs", ...args, "--fresh", "--data-dir", D + "data"], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }));
for (let r = 0; r < 5; r++) for (const s of b2) {
  const c = done.find((x) => x.id === s.case);
  if (count >= CAP) break; count++;
  const out = cli(["done", "--criteria", c.criterion], c.evidence);
  log({ part: "B2", id: s.case, rep: r, p: out.p, verdict: out.verdict });
}
console.log("B2 done, requests", count);
// B4: one CLI decide call, closest case
const c = b1[0]; if (count + 2 <= CAP) { count += 2;
  const out = cli(["decide"], JSON.stringify({ decision: c.decision, context: c.context, options: c.options }));
  log({ part: "B4", id: c.id, out });
}
console.log("total counted", count);
