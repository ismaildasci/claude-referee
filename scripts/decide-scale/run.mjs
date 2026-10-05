// Runs the option-order scale study through the repo's Session (redaction, cache, retry budget, one receipt per batch); appends answers to jev-evals/decide-scale/recorded-<stage>.jsonl.
// Usage: node scripts/decide-scale/run.mjs --stage main|rename [--only <src>] [--limit n] [--dry-run] [--batch 240]; resumable: recorded requests are skipped.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadPack, packDirs } from "../../src/engine/pack.ts";
import { Session } from "../../src/engine/session.ts";
import { DEFAULT_MODEL } from "../../src/engine/config.ts";
import { ROOT, key, loadCases, neutralNames, orderPlan } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const stage = flag("--stage", "main");
const only = flag("--only", null);
const limit = Number(flag("--limit", "0"));
const batchSize = Number(flag("--batch", "240"));
const dry = args.includes("--dry-run");
if (!["main", "rename"].includes(stage)) throw new Error("--stage must be main or rename");

const dir = join(ROOT, "jev-evals", "decide-scale");
const recordedPath = join(dir, `recorded-${stage}.jsonl`);
const receiptsPath = join(dir, `receipts-${stage}.json`);
mkdirSync(dir, { recursive: true });

const pack = loadPack("generic", packDirs(process.env));
const best = pack.questions["decide.best"];
const packRef = { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact };

let cases = loadCases();
if (only) cases = cases.filter((c) => c.src === only);
if (stage === "rename") cases = cases.filter((c) => ["close", "a", "b"].includes(c.src));
if (limit > 0) cases = cases.slice(0, limit);

const done = new Set(existsSync(recordedPath) ? readFileSync(recordedPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => `${r.case}|${r.naming}|${r.order.join(",")}`) : []);

const tasks = [];
for (const c of cases) {
  const plan = orderPlan(c);
  const naming = stage === "rename" ? "neutral" : "orig";
  const orders = stage === "rename" ? plan.pool : [...plan.pool, ...plan.extra];
  const map = naming === "neutral" ? neutralNames(c) : null;
  for (const order of orders) {
    const id = `${c.id}|${naming}|${key(order)}`;
    if (done.has(id)) continue;
    const criteria = Object.fromEntries(order.map((name) => [map ? map[name] : name, c.options[name]]));
    const part = plan.pool.some((o) => key(o) === key(order)) ? "pool" : "fixed";
    tasks.push({ map, meta: { case: c.id, naming, order, part }, planned: { id, state: { decision: c.raw.decision, context: c.raw.context }, questions: { best: { ...best, criteria } } } });
  }
}
console.log(`${cases.length} decisions, ${tasks.length} requests to send (${done.size} already recorded), stage ${stage}`);

const sessionOptions = () => ({ command: `decide-scale-${stage}`, env: process.env, cwd: ROOT, home: homedir(), platform: process.platform, now: () => Date.now(), pack: packRef, deadlineMs: 900_000 });

if (dry) {
  const session = new Session(sessionOptions());
  const sample = tasks.map((t) => t.planned);
  const out = session.dryRun(sample);
  console.log(JSON.stringify({ requests: tasks.length, est_tokens: out.est_tokens, replaced: out.replaced }));
  process.exit(0);
}

const receipts = existsSync(receiptsPath) ? JSON.parse(readFileSync(receiptsPath, "utf8")) : [];
let sent = 0;
let failed = 0;
for (let at = 0; at < tasks.length; at += batchSize) {
  let batch = tasks.slice(at, at + batchSize);
  for (let round = 0; round < 4 && batch.length > 0; round++) {
    const session = new Session(sessionOptions());
    const outcomes = await session.run(batch.map((t) => t.planned), { partial: true, concurrency: 6 });
    const retry = [];
    outcomes.forEach((o, i) => {
      const t = batch[i];
      const answer = o.answers?.["best"];
      if (answer?.type === "choice" && o.stopped.length === 0) {
        const back = t.map ? Object.fromEntries(Object.entries(t.map).map(([orig, neutral]) => [orig, answer.probabilities[neutral] ?? 0])) : answer.probabilities;
        appendFileSync(recordedPath, JSON.stringify({ ...t.meta, p: back, cached: o.cached }) + "\n");
        sent++;
      } else retry.push(t);
    });
    const r = session.record({ verdict: `stage-${stage}` });
    receipts.push({ id: r.id, ts: r.ts, requests: r.requests, cached: r.cached, input_tokens: r.input_tokens, cost_usd: r.cost_usd, replaced: r.replaced ?? 0, stopped: r.stopped ?? 0, ms: r.ms });
    writeFileSync(receiptsPath, JSON.stringify(receipts, null, 1) + "\n");
    batch = retry;
    if (retry.length > 0) console.log(`round ${round + 1}: ${retry.length} unanswered, retrying`);
  }
  failed += batch.length;
  console.log(`${Math.min(at + batchSize, tasks.length)}/${tasks.length} requests handled, ${sent} recorded, ${failed} failed`);
}
console.log(`done: ${sent} recorded, ${failed} failed, model ${DEFAULT_MODEL}`);
