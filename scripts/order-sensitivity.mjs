// Order-sensitivity measurement for decide.best (docs/decisions/decide-order.md): full run, --analyze (offline recompute), --screen (close-call filter).
// Usage: node scripts/order-sensitivity.mjs [--in jev-evals/decide-close/cases.jsonl] [--out file] [--limit n] [--margin 0.08] [--subsets file] | --analyze report.json [--cases file] [--out file] [--subsets file]
//        | --screen --in cands.jsonl --out report.json --keep cases.jsonl --max n   (registered: true only for margin 0.08, the default --in and no --limit)

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { REGISTERED_CASES, TIE_MARGIN, analyzeDecision, costUsd, isRegistered, leaderOf, permutations, preflight, screenKeep, screenOrder, selectKept, sideBySide, subsetSummaries, summarize, validateCandidate, validateSubsets } from "./order-analysis.mjs";

const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const flag = (name, fallback) => (has(name) ? args[args.indexOf(name) + 1] : fallback);
const CONCURRENCY = 6;
const tieMargin = Number(flag("--margin", String(TIE_MARGIN)));
if (!Number.isFinite(tieMargin) || tieMargin < 0) {
  console.error("--margin must be a non-negative number");
  process.exit(2);
}

function apiKey() {
  const fromEnv = process.env.TYPESAFE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

const jsonl = (path) => readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
const loadBest = () => JSON.parse(readFileSync("plugins/claude-referee/packs/generic/questions/decide.json", "utf8"))["decide.best"];
const makeQuestion = (best) => (opts) => ({ ...best, criteria: Object.fromEntries(opts.map((o) => [o.name, o.text])) });

let key;
let inputTokens = 0;
let requests = 0;
let retries429 = 0;
async function ask(state, questions) {
  key ??= apiKey();
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

async function pool(tasks, every) {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < tasks.length) {
      const t = tasks[next++];
      await t();
      if (++done % every === 0) console.log(`${done}/${tasks.length}`);
    }
  }));
}

const loadSubsets = () => (has("--subsets") ? JSON.parse(readFileSync(flag("--subsets"), "utf8")) : null);

function reportSets(perDecision, summary, subsetsFile, registered) {
  if (!subsetsFile) return null;
  const subsets = subsetSummaries(perDecision, subsetsFile, tieMargin, registered);
  console.log(sideBySide({ full: summary, ...subsets }).join("\n"));
  return subsets;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 1) + "\n");
}

async function runFull() {
  const input = flag("--in", REGISTERED_CASES);
  const out = flag("--out", `results/order-${new Date().toISOString().slice(0, 10)}.json`);
  const limit = Number(flag("--limit", "0"));
  const registered = isRegistered({ tieMargin, input, limitUsed: has("--limit") });
  const question = makeQuestion(loadBest());
  let cases = jsonl(input).map((l) => JSON.parse(l));
  const invalid = cases.map((c, i) => [c?.id ?? `line ${i + 1}`, validateCandidate(c)]).filter(([, reason]) => reason);
  if (invalid.length) {
    for (const [id, reason] of invalid) console.error(`invalid case ${id}: ${reason}`);
    process.exit(2);
  }
  if (limit > 0) cases = cases.slice(0, limit);
  const subsetsFile = loadSubsets();
  if (subsetsFile) validateSubsets(subsetsFile, cases.map((c) => c.id));

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
  await pool(tasks, 60);

  const perDecision = raw.map((r, ci) => analyzeDecision(r.id, cases[ci].options.map((o) => o.name), r, tieMargin));
  const summary = summarize(perDecision, { requests, retries_429: retries429, input_tokens: inputTokens, cost_usd: costUsd(inputTokens) }, tieMargin, registered);
  const report = {
    date: new Date().toISOString(),
    model: MODEL,
    input: basename(input),
    method: "Each decision's decide.best Choice asked in all 24 option orders (one request each), the written order once more (re-ask), and once as a single request holding two questions: the written and the reversed criteria. Leader = argmax of the mean over the 24 orders. Spread = max - min of one option's probability across orders; per decision the largest over options. Slot residual = mean over orders of p(option in slot) - that option's all-orders mean.",
    summary,
    decisions: perDecision,
    raw,
  };
  writeJson(out, report);
  console.log(`wrote ${out}`);
  const subsets = reportSets(perDecision, summary, subsetsFile, registered);
  if (subsets) {
    writeJson(out, { ...report, subsets });
    console.log(`wrote ${out} with subsets`);
  }
  console.log(JSON.stringify(summary, null, 1));
}

function runAnalyze(path) {
  const source = JSON.parse(readFileSync(path, "utf8"));
  const casesPath = has("--cases") ? flag("--cases") : [join(dirname(path), basename(source.input)), source.input].find((candidate) => existsSync(candidate));
  if (!casesPath || !existsSync(casesPath)) throw new Error(`cases file for ${path} not found; pass --cases`);
  const byId = new Map(jsonl(casesPath).map((l) => JSON.parse(l)).map((c) => [c.id, c]));
  const perDecision = source.raw.map((r) => {
    const c = byId.get(r.id);
    if (!c) throw new Error(`case ${r.id} not found in ${casesPath}`);
    return analyzeDecision(r.id, c.options.map((o) => o.name), r, tieMargin);
  });
  const { requests: rq, retries_429: rt, input_tokens: it, cost_usd: cu } = source.summary;
  const registered = source.summary.registered === true && isRegistered({ tieMargin, input: casesPath, limitUsed: false });
  const summary = summarize(perDecision, { requests: rq, retries_429: rt, input_tokens: it, cost_usd: cu }, tieMargin, registered);
  const subsets = reportSets(perDecision, summary, loadSubsets(), registered);
  console.log(JSON.stringify(summary, null, 1));
  if (has("--out")) {
    const out = flag("--out");
    writeJson(out, { date: new Date().toISOString(), model: source.model, input: basename(source.input), analyzed_from: basename(path), method: source.method, summary, ...(subsets ? { subsets } : {}), decisions: perDecision, raw: source.raw });
    console.log(`wrote ${out}`);
  }
}

async function runScreen() {
  const input = flag("--in");
  const out = flag("--out");
  const keepPath = flag("--keep");
  const max = Number(flag("--max"));
  if (!input || !out || !keepPath || !Number.isInteger(max) || max < 1) {
    console.error("usage: --screen --in <cands.jsonl> --out <report.json> --keep <cases.jsonl> --max <n>");
    process.exit(2);
  }
  const question = makeQuestion(loadBest());
  const lines = jsonl(input);
  const cands = lines.map((l) => JSON.parse(l));
  const existingText = existsSync(keepPath) ? readFileSync(keepPath, "utf8") : "";
  const existingLines = existingText.split("\n").filter((l) => l.trim());
  const pre = preflight(cands, new Set(existingLines.map((l) => JSON.parse(l).id)));
  pre.forEach((p, i) => {
    if (p.status !== "pending") console.log(`${p.status} ${cands[i]?.id ?? `line ${i + 1}`}: ${p.reason}`);
  });

  const answers = cands.map(() => ({}));
  const tasks = [];
  cands.forEach((c, ci) => {
    if (pre[ci].status !== "pending") return;
    const state = { decision: c.decision, context: c.context };
    for (const order of ["badc", "cadb"]) {
      tasks.push(async () => {
        const a = await ask(state, { best: question(screenOrder(c.options, order)) });
        answers[ci][order] = a.best.probabilities;
      });
    }
  });
  await pool(tasks, 20);

  const entries = pre.map((p, ci) => ({ status: p.status, keep: p.status === "pending" ? screenKeep(answers[ci].badc, answers[ci].cadb) : null }));
  const outcomes = selectKept(entries, existingLines.length, max);
  const side = (ci, order) => ({ order, ...leaderOf(answers[ci][order]), probabilities: answers[ci][order] });
  const results = cands.map((c, ci) => {
    const base = { id: c?.id ?? null, outcome: outcomes[ci] };
    if (pre[ci].status !== "pending") return { ...base, reason: pre[ci].reason, keep: null };
    const p1 = side(ci, "badc");
    const p2 = side(ci, "cadb");
    return { ...base, keep: entries[ci].keep, p1: { order: p1.order, leader: p1.leader, p_leader: p1.p, probabilities: p1.probabilities }, p2: { order: p2.order, leader: p2.leader, p_leader: p2.p, probabilities: p2.probabilities } };
  });

  const keptLines = lines.filter((_, ci) => outcomes[ci] === "kept");
  mkdirSync(dirname(keepPath), { recursive: true });
  if (keptLines.length) appendFileSync(keepPath, (existingText && !existingText.endsWith("\n") ? "\n" : "") + keptLines.join("\n") + "\n");
  const countOf = (o) => outcomes.filter((x) => x === o).length;
  const summary = {
    tested: pre.filter((p) => p.status === "pending").length,
    kept: keptLines.length,
    total_in_cases: existingLines.length + keptLines.length,
    requests,
    input_tokens: inputTokens,
    cost_usd: costUsd(inputTokens),
    rejected: countOf("rejected"),
    capped: countOf("capped"),
    refused: countOf("refused"),
    duplicates: countOf("duplicate"),
    retries_429: retries429,
    max,
  };
  writeJson(out, { date: new Date().toISOString(), model: MODEL, input: basename(input), keep_file: isAbsolute(keepPath) ? basename(keepPath) : keepPath, rule: "keep when the leader probability is below 0.70 in both fixed orders badc and cadb (options indexed a,b,c,d in written order)", summary, candidates: results });
  console.log(JSON.stringify(summary, null, 1));
  console.log(`wrote ${out}`);
}

if (has("--analyze")) runAnalyze(flag("--analyze"));
else if (has("--screen")) await runScreen();
else await runFull();
