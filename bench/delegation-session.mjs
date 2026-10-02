// Delegation A/B (bench/PREREG.md D2 to D10): plans, one session (work tree, `claude -p`, transcript, Jev receipts, scoring), the analysis and the pilot rule.
// Resumable: a session with ground.json is never rerun and its spend is in ledger.jsonl before anything else can fail. Labels are rebuilt from the items in memory and never written to disk.

import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { DELEGATION_ARMS } from "./arms.mjs";
import { accountTranscript, reconcile, sessionCost } from "./cost.mjs";
import { armItemsJsonl, extractItems, fetchRepo, itemsHash, sha256 } from "./delegation-items.mjs";
import { SEED as ITEM_SEED } from "./snapshot-delegation.mjs";
import { harvestTranscripts, ledgerFile, mayStart, parseRun, paths, readLedger, runClaude, spentUsd, makeWorkTree } from "./session.mjs";
import { clopperPearson, clusterBootstrap, mulberry32, newcombeDiff } from "./stats.mjs";

export const DRY_CAP_USD = 1;
export const PILOT_CAP_USD = 4;
export const MAIN_CAP_USD = 15;
export const PER_SESSION_USD = 0.4;
export const SESSION_TIMEOUT_MS = 600_000;
export const SEED = 20261002;
export const MODEL = "haiku";
export const PILOT_REPS = 2;
export const MAIN_REPS = 2;
export const MARGIN = 0.1;
export const K_MAX = 12;

const readJson = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1) + "\n");
  renameSync(tmp, path);
};
const r3 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const r5 = (v) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100000) / 100000);
const sum = (rows, f) => rows.reduce((s, g) => s + (f(g) ?? 0), 0);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// ---- Cases and plans

export function loadDelegationCases(file) {
  const data = readJson(file);
  if (!data?.cases) throw new Error(`cannot read cases from ${file}`);
  const hash = sha256(JSON.stringify(data.cases));
  if (hash !== data.hash) throw new Error(`cases-delegation.json does not match its recorded hash (${hash.slice(0, 12)} vs ${String(data.hash).slice(0, 12)})`);
  return { hash, cases: data.cases, byId: Object.fromEntries(data.cases.map((c) => [c.id, c])) };
}

// Fetches each repository at its pinned commit and rebuilds items and labels; refuses a case whose label hash or counts differ from the file.
export function buildItems({ cacheDir, cases, fetch = fetchRepo }) {
  const byCase = {};
  for (const c of cases.cases) {
    const items = extractItems(fetch({ cacheDir, repo: c.repo, sha: c.sha }), { ...c, seed: ITEM_SEED });
    const nTracked = items.filter((i) => i.label).length;
    if (itemsHash(items) !== c.items_sha256 || items.length !== c.n_items || nTracked !== c.n_tracked) throw new Error(`${c.id}: items or labels differ from cases-delegation.json`);
    byCase[c.id] = items;
  }
  return byCase;
}

export const sessionId = (c, arm, rep) => `${c}__${arm}__r${rep}`;

function shuffle(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Block = one case and one repetition, both arms back to back; blocks in seeded order; `alone` goes first when (rep + case index) is even.
export function planDelegation({ caseIds, reps, stage, seed = SEED }) {
  const blocks = [];
  for (let rep = 1; rep <= reps; rep++) caseIds.forEach((c, ci) => blocks.push({ c, rep, alonefirst: (rep + ci) % 2 === 0 }));
  const out = [];
  shuffle(blocks, mulberry32(seed)).forEach((b, block) => {
    (b.alonefirst ? ["alone", "delegate"] : ["delegate", "alone"]).forEach((arm, position) => out.push({ id: sessionId(b.c, arm, b.rep), case: b.c, arm, rep: b.rep, model: MODEL, block, position, stage }));
  });
  return out;
}

export const planDry = (caseId = "d-pytest") => ["alone", "delegate"].map((arm, position) => ({ id: sessionId(caseId, arm, 1), case: caseId, arm, rep: 1, model: MODEL, block: 0, position, stage: "dry" }));

// ---- Preparation: pins, the plugin copy with the bench pack

export function prepareDelegation({ out, repoRoot, cases, itemsByCase }) {
  mkdirSync(out, { recursive: true });
  const packFile = join(repoRoot, "bench/pack/bench-todo/questions/judge.json");
  const cliFile = join(repoRoot, "plugins/claude-referee/dist/cli.mjs");
  const pins = { cases_hash: cases.hash, pack_sha256: sha256(readFileSync(packFile)), cli_sha256: existsSync(cliFile) ? sha256(readFileSync(cliFile)) : null };
  const pinned = readJson(join(out, "manifest.json"));
  if (pinned) {
    for (const k of Object.keys(pins)) if (pinned[k] !== pins[k]) throw new Error(`${k} changed since the run started; refusing to continue`);
  } else writeJson(join(out, "manifest.json"), { ...pins, pinned_at: new Date().toISOString() });
  const plugin = join(out, "plugin");
  if (!existsSync(plugin) && existsSync(join(repoRoot, "plugins/claude-referee"))) {
    cpSync(join(repoRoot, "plugins/claude-referee"), plugin, { recursive: true });
    cpSync(join(repoRoot, "bench/pack/bench-todo"), join(plugin, "packs/bench-todo"), { recursive: true });
    const hooksPath = join(plugin, "hooks/hooks.json");
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    for (const groups of Object.values(hooks.hooks)) for (const group of groups) for (const hook of group.hooks) {
      hook.args = ["-u", "CLAUDE_PLUGIN_DATA", hook.command, ...hook.args];
      hook.command = "env";
    }
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  }
  return pins;
}

// ---- Scoring

export function readFindings(workDir) {
  const file = join(workDir, "findings.json");
  if (!existsSync(file)) return { status: "missing", raw: [] };
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(value) ? { status: "ok", raw: value } : { status: "unparsable", raw: [] };
  } catch {
    return { status: "unparsable", raw: [] };
  }
}

// Found ids against the labels: ids that are not strings, not in the item set, or repeated are counted apart and dropped.
export function scoreFindings(items, raw) {
  const valid = new Map(items.map((i) => [i.id, i.label]));
  const seen = new Set();
  let invalid = 0;
  let duplicates = 0;
  for (const v of raw) {
    if (typeof v !== "string" || !valid.has(v)) invalid++;
    else if (seen.has(v)) duplicates++;
    else seen.add(v);
  }
  const tracked = items.filter((i) => i.label).map((i) => i.id);
  const tp = tracked.filter((id) => seen.has(id)).length;
  return { tp, fp: seen.size - tp, fn: tracked.length - tp, invalid, duplicates, found: seen.size, positives: tracked.length, items: items.length };
}

// ---- Transcript and receipts

export function transcriptTools(transcript) {
  const uses = new Map();
  const results = new Map();
  for (const raw of String(transcript).split("\n")) {
    if (!raw.includes("tool_use") && !raw.includes("tool_result")) continue;
    let e;
    try {
      e = JSON.parse(raw);
    } catch {
      continue;
    }
    const content = e?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type === "tool_use" && !uses.has(b.id)) uses.set(b.id, { id: b.id, order: uses.size, name: b.name, input: b.input ?? {} });
      if (b?.type === "tool_result") results.set(b.tool_use_id, typeof b.content === "string" ? b.content : Array.isArray(b.content) ? b.content.map((c) => c?.text ?? "").join("\n") : "");
    }
  }
  return { uses: [...uses.values()], results };
}

// D8: a transcript that names ground.json or the labels dir, or touches a path outside its own work tree (the plugin copy excepted), is leaked.
const insideOf = (dir, f) => f === dir || f.startsWith(dir + sep);
export function detectLeak(transcript, { out, work, plugin }) {
  const text = String(transcript);
  if (text.includes("ground.json") || text.includes(join(out, "labels"))) return true;
  const root = resolve(out);
  const w = resolve(work);
  const ok = (f) => insideOf(w, f) || insideOf(resolve(plugin), f);
  for (const u of transcriptTools(text).uses) {
    const refs = [];
    if (typeof u.input.file_path === "string") refs.push(u.input.file_path);
    if (typeof u.input.path === "string") refs.push(u.input.path);
    if (typeof u.input.command === "string") refs.push(...(u.input.command.match(/(?:\.\.?\/|\/)[^\s'"`;|&<>)(]*/g) ?? []));
    for (const r of refs) {
      const f = resolve(w, r);
      if (!ok(f) && (insideOf(root, f) || /(^|\/)\.\.(\/|$)/.test(r))) return true;
    }
  }
  return false;
}

// Leak exclusion is by block, (case, rep): both arms of a leaked block leave the analysis so the arms stay paired.
export function dropLeakedBlocks(grounds) {
  const key = (g) => `${g.case}|${g.rep}`;
  const bad = new Set(grounds.filter((g) => g.leaked).map(key));
  return grounds.filter((g) => !bad.has(key(g)));
}

const bashCommand = (u) => (u.name === "Bash" && typeof u.input.command === "string" ? u.input.command : "");
const writesFindings = (u) => (u.name === "Write" || u.name === "Edit" ? String(u.input.file_path ?? "").endsWith("findings.json") : bashCommand(u).includes("findings.json"));

export function toolStats({ uses }) {
  const counts = { Read: 0, Write: 0, Edit: 0, Bash: 0, other: 0 };
  for (const u of uses) counts[u.name in counts ? u.name : "other"]++;
  // scripted: a node or python3 Bash call at or before the last call that wrote findings.json
  const last = uses.filter(writesFindings).at(-1)?.order ?? -1;
  const scripted = uses.some((u) => u.order <= last && /^\s*(node|python3?)\b/.test(bashCommand(u)) && !/cli\.mjs\s+judge/.test(bashCommand(u)));
  return { counts, scripted };
}

export function judgeStats({ uses, results }) {
  const calls = uses.filter((u) => /cli\.mjs\s+judge\b/.test(bashCommand(u)));
  const chunks = new Set();
  const agg = { calls: calls.length, chunks_judged: 0, answered: 0, yes: 0, no: 0, review: 0, unanswered: 0, stopped: 0, errors: [] };
  for (const u of calls) {
    const chunk = /--items\s+(\S+)/.exec(bashCommand(u))?.[1];
    const text = results.get(u.id) ?? "";
    let parsed = null;
    for (const line of text.split("\n")) {
      try {
        const o = JSON.parse(line);
        if (o && typeof o === "object" && "ok" in o) parsed = o;
      } catch {
        continue;
      }
    }
    if (!parsed) continue;
    if (parsed.ok === true) {
      agg.answered++;
      if (chunk) chunks.add(chunk);
      agg.yes += parsed.yes ?? 0;
      agg.no += parsed.no ?? 0;
      agg.review += parsed.review ?? 0;
      agg.unanswered += parsed.unanswered?.length ?? 0;
      agg.stopped += parsed.stopped?.length ?? 0;
    } else agg.errors.push(String(parsed.error ?? "error"));
  }
  agg.chunks_judged = chunks.size;
  return agg;
}

// Jev's own bill from the receipts the CLI wrote into the session's data directory (what `receipts --tokens` totals).
export function jevCost(dataDir) {
  const out = { cost_usd: 0, input_tokens: 0, requests: 0, cached: 0, receipts: 0 };
  const root = join(dataDir, "receipts");
  if (!existsSync(root)) return out;
  for (const project of readdirSync(root)) {
    const dir = join(root, project);
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
      for (const line of readFileSync(join(dir, f), "utf8").split("\n").filter((l) => l.trim())) {
        try {
          const r = JSON.parse(line);
          out.cost_usd += r.cost_usd ?? 0;
          out.input_tokens += r.input_tokens ?? 0;
          out.requests += r.requests ?? 0;
          out.cached += r.cached ?? 0;
          out.receipts++;
        } catch {
          continue;
        }
      }
    }
  }
  out.cost_usd = Math.round(out.cost_usd * 1e6) / 1e6;
  return out;
}

// ---- One session

export async function runDelegationSession({ out, plan, cases, itemsByCase, opts = {} }) {
  const { claude = "claude", projectsDir, perSessionUsd = PER_SESSION_USD, timeoutMs = SESSION_TIMEOUT_MS, extraEnv = {} } = opts;
  const c = cases.byId[plan.case];
  const arm = DELEGATION_ARMS[plan.arm];
  const items = itemsByCase[plan.case];
  if (!c || !arm || !items) throw new Error(`unknown case or arm in ${plan.id}`);
  const p = paths(out, plan.id);
  if (existsSync(join(p.session, "ground.json"))) return { id: plan.id, skipped: true };
  mkdirSync(p.session, { recursive: true });
  const runFile = join(p.session, "run.json");
  const task = { id: c.id, repo: c.repo, items, files: { "items.jsonl": armItemsJsonl(items) } };
  const plugin = join(out, "plugin");
  let run = readJson(runFile);
  if (!run) {
    makeWorkTree(p.work, task, arm);
    rmSync(p.data, { recursive: true, force: true });
    mkdirSync(p.data, { recursive: true });
    const r = await runClaude({ claude, prompt: arm.prompt(task, { plugin }), cwd: p.work, model: plan.model, plugin: arm.plugin ? plugin : null, dataDir: p.data, perSessionUsd, timeoutMs, extraEnv: arm.plugin ? extraEnv : {} });
    const parsed = parseRun(r.stdout);
    const reported = parsed && Number.isFinite(parsed.total_cost_usd);
    appendFileSync(ledgerFile(out), JSON.stringify({ id: plan.id, usd: reported ? parsed.total_cost_usd : perSessionUsd, estimated: !reported, ts: new Date().toISOString() }) + "\n");
    run = { plan, ran_at: new Date().toISOString(), status: r.status, timed_out: r.timedOut, ms: r.ms, stderr_tail: r.stderr.slice(-500), result: parsed };
    writeJson(runFile, run);
  }
  const parsed = run.result;
  const sessionUuid = typeof parsed?.session_id === "string" ? parsed.session_id : "";
  const transcriptFile = join(p.session, "transcript.jsonl");
  if (!existsSync(transcriptFile) && projectsDir) harvestTranscripts({ projectsDir, workDir: p.work, id: plan.id, sessionId: sessionUuid, dest: transcriptFile });
  const transcript = existsSync(transcriptFile) ? readFileSync(transcriptFile, "utf8") : "";
  const extras = readdirSync(p.session).filter((f) => f.startsWith("extra-"));
  const all = [transcript, ...extras.map((f) => readFileSync(join(p.session, f), "utf8"))].join("\n");
  const warnings = [];
  if (!transcript) warnings.push(projectsDir ? "no_transcript_found_in_projects_dir" : "no_projects_dir");
  if (extras.length) warnings.push("extra_transcript_files");
  let account = null;
  try {
    account = accountTranscript(all);
  } catch (e) {
    warnings.push(`cost_error:${String(e.message).slice(0, 120)}`);
  }
  const cost = sessionCost({ account, result: parsed, capUsd: perSessionUsd });
  const found = readFindings(p.work);
  const score = scoreFindings(items, found.raw);
  const tools = transcriptTools(all);
  const stats = toolStats(tools);
  const judge = judgeStats(tools);
  const jev = jevCost(p.data);
  const ground = {
    id: plan.id,
    case: plan.case,
    arm: plan.arm,
    model: plan.model,
    model_id: parsed?.modelUsage ? Object.keys(parsed.modelUsage).join(",") : null,
    rep: plan.rep,
    block: plan.block ?? null,
    position: plan.position ?? null,
    stage: plan.stage ?? null,
    session_id: sessionUuid || null,
    n_chunks: Math.ceil(items.length / 20),
    findings_status: found.status,
    score,
    final_message: typeof parsed?.result === "string" ? parsed.result : "",
    run_failed: !parsed || parsed.is_error === true || run.timed_out === true,
    timed_out: run.timed_out === true,
    leaked: detectLeak(all, { out, work: p.work, plugin }),
    has_transcript: transcript !== "",
    warnings: [...warnings, ...(account?.warnings ?? [])],
    tool_counts: stats.counts,
    scripted: stats.scripted,
    judge,
    jev,
    claude_usd: cost.usd,
    cost_source: cost.source,
    combined_usd: Math.round((cost.usd + jev.cost_usd) * 1e6) / 1e6,
    cost_account: account,
    cost_reconcile: account ? reconcile(account, parsed) : null,
    duration_ms: parsed?.duration_ms ?? run.ms,
    turns: parsed?.num_turns ?? null,
  };
  writeJson(join(p.session, "ground.json"), ground);
  return { id: plan.id, ground };
}

export async function runAllDelegation({ out, plans, cases, itemsByCase, capUsd, perSessionUsd = PER_SESSION_USD, opts = {}, log = () => {} }) {
  const summary = { ran: 0, skipped: 0, stopped: null };
  for (const plan of plans) {
    if (existsSync(join(paths(out, plan.id).session, "ground.json"))) {
      summary.skipped++;
      continue;
    }
    const ledger = readLedger(out);
    if (!mayStart(ledger, capUsd, perSessionUsd)) {
      summary.stopped = "budget";
      log(`budget cap reached: spent ${spentUsd(ledger).toFixed(4)} of ${capUsd} USD, the next session could cost up to ${perSessionUsd}`);
      break;
    }
    const r = await runDelegationSession({ out, plan, cases, itemsByCase, opts: { ...opts, perSessionUsd } });
    summary.ran++;
    log(`${plan.id}: claude ${r.ground?.claude_usd} USD (${r.ground?.cost_source}), jev ${r.ground?.jev.cost_usd} USD, tp ${r.ground?.score.tp} fp ${r.ground?.score.fp} fn ${r.ground?.score.fn}${r.ground?.run_failed ? " RUN_FAILED" : ""}`);
  }
  summary.spent_usd = Math.round(spentUsd(readLedger(out)) * 10000) / 10000;
  return summary;
}

export function readDelegationGrounds(out) {
  const dir = join(out, "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((id) => readJson(join(dir, id, "ground.json"))).filter(Boolean);
}

// ---- Analysis (D6, D10)

const ci = (k, n) => (n < 1 ? null : [r3(clopperPearson(k, n).lower), r3(clopperPearson(k, n).upper)]);
const ARMS = ["alone", "delegate"];

function pooled(rows) {
  const tp = sum(rows, (g) => g.score.tp);
  const fp = sum(rows, (g) => g.score.fp);
  const fn = sum(rows, (g) => g.score.fn);
  const items = sum(rows, (g) => g.score.items);
  const pos = tp + fn;
  const pred = tp + fp;
  return {
    sessions: rows.length,
    tp,
    fp,
    fn,
    precision: pred ? r3(tp / pred) : null,
    precision_ci95: ci(tp, pred),
    recall: pos ? r3(tp / pos) : null,
    recall_ci95: ci(tp, pos),
    f1: 2 * tp + fp + fn ? r3((2 * tp) / (2 * tp + fp + fn)) : null,
    flag_all_baseline: items ? { precision: r3(pos / items), recall: pos ? 1 : null } : null,
    invalid_ids: sum(rows, (g) => g.score.invalid),
    duplicate_ids: sum(rows, (g) => g.score.duplicates),
    findings_missing_or_unparsable: rows.filter((g) => g.findings_status !== "ok").length,
  };
}

const metric = (rows, which) => {
  const tp = sum(rows, (g) => g.score.tp);
  const den = which === "recall" ? tp + sum(rows, (g) => g.score.fn) : tp + sum(rows, (g) => g.score.fp);
  return den ? tp / den : null;
};

const kindTotal = (g) => Object.values(g.cost_account?.tokens ?? {}).reduce((s, v) => s + v, 0);

export function analyzeDelegation(grounds) {
  const rows = dropLeakedBlocks(grounds);
  const by = Object.fromEntries(ARMS.map((a) => [a, rows.filter((g) => g.arm === a)]));
  const accuracy = Object.fromEntries(ARMS.map((a) => [a, pooled(by[a])]));
  const d = by.delegate;
  const diff = (which) => {
    const x = which === "recall" ? [accuracy.delegate.tp, accuracy.delegate.tp + accuracy.delegate.fn, accuracy.alone.tp, accuracy.alone.tp + accuracy.alone.fn] : [accuracy.delegate.tp, accuracy.delegate.tp + accuracy.delegate.fp, accuracy.alone.tp, accuracy.alone.tp + accuracy.alone.fp];
    if (x[1] < 1 || x[3] < 1) return null;
    const n = newcombeDiff(...x);
    const boot = clusterBootstrap(rows.map((g) => ({ ...g, task: g.case })), (rs) => {
      const m1 = metric(rs.filter((g) => g.arm === "delegate"), which);
      const m2 = metric(rs.filter((g) => g.arm === "alone"), which);
      return m1 === null || m2 === null ? null : m1 - m2;
    }, { resamples: 10000, seed: 11 });
    return { diff: r3(n.diff), newcombe95: [r3(n.lower), r3(n.upper)], cluster_bootstrap95: [r3(boot.lower), r3(boot.upper)] };
  };
  const recall = diff("recall");
  const precision = diff("precision");
  const gate = recall && precision ? { margin: -MARGIN, recall_lower: recall.newcombe95[0], precision_lower: precision.newcombe95[0], passes: recall.newcombe95[0] > -MARGIN && precision.newcombe95[0] > -MARGIN } : null;

  const totals = (rs) => ({ sessions: rs.length, claude_usd: r5(sum(rs, (g) => g.claude_usd)), jev_usd: r5(sum(rs, (g) => g.jev.cost_usd)), combined_usd: r5(sum(rs, (g) => g.combined_usd)), cli_total_usd: r5(sum(rs, (g) => g.cost_reconcile?.reported_usd)), claude_tokens: sum(rs, kindTotal), tokens_by_kind: Object.fromEntries(["input", "output", "cache5m", "cache1h", "cacheRead"].map((k) => [k, sum(rs, (g) => g.cost_account?.tokens?.[k])])), jev_input_tokens: sum(rs, (g) => g.jev.input_tokens), jev_requests: sum(rs, (g) => g.jev.requests) });
  const cost = Object.fromEntries(ARMS.map((arm) => [arm, totals(by[arm])]));
  const ratioOf = (f) => (rs) => {
    const num = sum(rs.filter((g) => g.arm === "delegate"), f);
    const den = sum(rs.filter((g) => g.arm === "alone"), f);
    return den > 0 && rs.some((g) => g.arm === "delegate") ? num / den : null;
  };
  const ratio = (f) => {
    const point = ratioOf(f)(rows);
    const boot = clusterBootstrap(rows.map((g) => ({ ...g, task: g.case })), ratioOf(f), { resamples: 10000, seed: 11 });
    return { ratio: r3(point), cluster_bootstrap95: [r3(boot.lower), r3(boot.upper)], dropped: boot.dropped };
  };
  const ratios = { combined_usd: ratio((g) => g.combined_usd), claude_usd: ratio((g) => g.claude_usd), claude_tokens: ratio(kindTotal) };

  const perCase = {};
  for (const g of rows) {
    const cell = (perCase[g.case] ??= {});
    (cell[g.arm] ??= []).push(g);
  }
  const perCaseOut = Object.fromEntries(Object.entries(perCase).map(([c, cell]) => [c, Object.fromEntries(Object.entries(cell).map(([arm, rs]) => [arm, { sessions: rs.length, tp: sum(rs, (g) => g.score.tp), fp: sum(rs, (g) => g.score.fp), fn: sum(rs, (g) => g.score.fn), mean_claude_usd: r5(sum(rs, (g) => g.claude_usd) / rs.length), mean_combined_usd: r5(sum(rs, (g) => g.combined_usd) / rs.length), median_wall_ms: median(rs.map((g) => g.duration_ms)) }]))]));

  const delegation = {
    sessions: d.length,
    called_judge_on_every_chunk: d.filter((g) => g.judge.chunks_judged >= g.n_chunks).length,
    judge_calls: sum(d, (g) => g.judge.calls),
    yes: sum(d, (g) => g.judge.yes),
    no: sum(d, (g) => g.judge.no),
    review: sum(d, (g) => g.judge.review),
    unanswered: sum(d, (g) => g.judge.unanswered),
    stopped: sum(d, (g) => g.judge.stopped),
    judge_errors: d.flatMap((g) => g.judge.errors),
  };
  const classes = Object.fromEntries(ARMS.map((arm) => [arm, { run_failed: by[arm].filter((g) => g.run_failed).length, timed_out: by[arm].filter((g) => g.timed_out).length, no_transcript: by[arm].filter((g) => !g.has_transcript).length, scripted: by[arm].filter((g) => g.scripted).length }]));
  const other = Object.fromEntries(ARMS.map((arm) => [arm, { median_wall_ms: median(by[arm].map((g) => g.duration_ms)), mean_turns: by[arm].length ? r3(sum(by[arm], (g) => g.turns) / by[arm].length) : null, tool_calls: Object.fromEntries(["Read", "Write", "Edit", "Bash", "other"].map((k) => [k, sum(by[arm], (g) => g.tool_counts?.[k])])) }]));
  return { sessions: grounds.length, leaked: grounds.filter((g) => g.leaked).length, excluded_sessions: grounds.length - rows.length, accuracy, recall_diff: recall, precision_diff: precision, gate, cost, ratios, per_case: perCaseOut, delegation, classes, other };
}

// ---- Pilot rule (D5)

const Z = 1.959964 + 0.841621;
export function sizeDelegationPilot(grounds) {
  const rows = dropLeakedBlocks(grounds);
  const by = Object.fromEntries(ARMS.map((arm) => [arm, rows.filter((g) => g.arm === arm)]));
  const bad = (rs) => rs.filter((g) => g.run_failed || g.findings_status !== "ok").length;
  const reasons = [];
  for (const arm of ARMS) if (by[arm].length && bad(by[arm]) / by[arm].length > 0.25) reasons.push(`more than a quarter of the ${arm} sessions failed or have no usable findings.json`);
  const gap = (which) => {
    const x = metric(by.delegate, which);
    const y = metric(by.alone, which);
    return x === null || y === null ? null : x - y;
  };
  const rd = gap("recall");
  const pd = gap("precision");
  if (rd === null || pd === null) reasons.push("precision or recall is not computable for an arm");
  if (rd !== null && rd < -MARGIN) reasons.push(`recall of delegate is ${r3(-rd)} below alone`);
  if (pd !== null && pd < -MARGIN) reasons.push(`precision of delegate is ${r3(-pd)} below alone`);
  const ratio = ratioTotal(rows);
  if (ratio === null || ratio >= 1) reasons.push(`combined cost ratio is ${ratio === null ? "not computable" : r3(ratio)}`);
  const logs = [];
  for (const c of new Set(rows.map((g) => g.case))) {
    const x = rows.filter((g) => g.case === c && g.arm === "delegate");
    const y = rows.filter((g) => g.case === c && g.arm === "alone");
    if (x.length && y.length && sum(y, (g) => g.combined_usd) > 0 && sum(x, (g) => g.combined_usd) > 0) logs.push(Math.log(sum(x, (g) => g.combined_usd) / x.length / (sum(y, (g) => g.combined_usd) / y.length)));
  }
  let s = null;
  if (logs.length >= 2) {
    const m = logs.reduce((t, v) => t + v, 0) / logs.length;
    s = Math.sqrt(logs.reduce((t, v) => t + (v - m) ** 2, 0) / (logs.length - 1));
  } else reasons.push("K cannot be computed (fewer than 2 cases with both arms)");
  const kRaw = s === null ? null : Math.ceil(((Z * s) / Math.log(0.8)) ** 2);
  const base = { cases_with_both_arms: logs.length, sd_log_ratio: s === null ? null : r3(s), k_needed: kRaw === null ? null : Math.max(4, kRaw), cost_ratio: r3(ratio), recall_diff: r3(rd), precision_diff: r3(pd) };
  if (reasons.length) return { ...base, decision: "stop", reasons };
  const k = Math.max(4, kRaw);
  return k > K_MAX ? { ...base, decision: "run_underpowered", cases: K_MAX, reps: MAIN_REPS, reasons: [`K ${k} is above ${K_MAX}`] } : { ...base, decision: "run", cases: k, reps: MAIN_REPS, reasons: [] };
}

function ratioTotal(rows) {
  const num = sum(rows.filter((g) => g.arm === "delegate"), (g) => g.combined_usd);
  const den = sum(rows.filter((g) => g.arm === "alone"), (g) => g.combined_usd);
  return den > 0 && num >= 0 ? num / den : null;
}
