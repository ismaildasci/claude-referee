// Data side of the local dashboard: reads the JSON lines in the data directory and shapes them for the page.
// Labels go through labelStop (labels.jsonl); nothing here touches the network or rewrites a store.

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { readCache } from "../engine/cache.ts";
import type { Answer } from "../engine/client.ts";
import type { Env } from "../engine/config.ts";
import { dirSize, projectId, tildify } from "../engine/datadir.ts";
import { readOverruled, readReceipts, type Receipt } from "../engine/receipts.ts";
import { loadPack, packDirs, threshold } from "../engine/pack.ts";
import { loadProject } from "../engine/project.ts";
import { clopperPearson, suggestThreshold } from "../engine/stopgate/interval.ts";
import { labelStop, readStops, stopStats } from "../engine/stopgate/stops.ts";
import type { StopRecord } from "../engine/stopgate/types.ts";
import { suggestForStops } from "../engine/stopgate/weak.ts";
import { projectTranscriptDirs } from "../engine/usage.ts";

export interface UiContext {
  readonly dataDir: string;
  readonly cwd: string;
  readonly home: string;
  readonly env: Env;
  readonly now: () => number;
}

export const EXPORT_KINDS = ["receipts", "stops", "labels"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const QUEUE_LIMIT = 50;
const EXCERPT_CHARS = 2000;
const STOP_ID = /^[A-Za-z0-9_-]{1,40}$/;
const BIDI_CONTROL = /[؜‎‏‪-‮⁦-⁩]/g;

function visible(text: string): string {
  return text.replace(BIDI_CONTROL, (c) => `[U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}]`);
}

function projectStops(ctx: UiContext): StopRecord[] {
  const project = projectId(ctx.cwd);
  return readStops(ctx.dataDir).filter((r) => r.project === project);
}

function interval(x: number, n: number): [number, number] | null {
  if (n < 1) return null;
  const ci = clopperPearson(x, n);
  return [ci.lower, ci.upper];
}

export function queue(ctx: UiContext) {
  const unlabelled = projectStops(ctx)
    .filter((r) => r.decision?.would_block === true && r.label === undefined)
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  const picked = unlabelled.slice(0, QUEUE_LIMIT);
  const hints = suggestForStops(projectTranscriptDirs(ctx.env, ctx.home, ctx.cwd), picked);
  return {
    total: unlabelled.length,
    stops: picked.map((r) => ({
      id: r.id,
      ts: r.ts,
      edits: r.edits,
      checks: r.checks,
      claims_done: r.decision?.claims_done ?? null,
      claims_verified: r.decision?.claims_verified ?? null,
      task_excerpt: visible(r.task_excerpt?.slice(0, EXCERPT_CHARS) ?? ""),
      final_excerpt: visible(r.final_excerpt?.slice(0, EXCERPT_CHARS) ?? ""),
      suggestion: hints.get(r.id) ?? null,
      marks: { truncated_checks: r.truncated_checks ?? 0, subagent_calls: r.subagent_calls ?? 0, subagent_reports: r.subagent_reports ?? 0, stale_pass: r.stale_pass === true },
    })),
  };
}

export function label(ctx: UiContext, id: unknown, value: unknown): "ok" | "bad_input" | "not_found" {
  if (typeof id !== "string" || !STOP_ID.test(id) || (value !== "right" && value !== "wrong")) return "bad_input";
  const stop = projectStops(ctx).find((r) => r.id === id);
  if (!stop || stop.decision?.would_block !== true) return "not_found";
  return labelStop(ctx.dataDir, id, value, new Date(ctx.now()).toISOString()) ? "ok" : "not_found";
}

function sum(receipts: readonly Receipt[], key: "requests" | "cached" | "input_tokens" | "cost_usd"): number {
  return receipts.reduce((total, r) => total + (r[key] ?? 0), 0);
}

export function overview(ctx: UiContext) {
  const since = new Date(ctx.now() - WINDOW_DAYS * DAY_MS).toISOString();
  const project = projectId(ctx.cwd);
  const receipts = readReceipts(ctx.dataDir, project).filter((r) => r.ts >= since);
  const byCommand: Record<string, number> = {};
  for (const r of receipts) byCommand[r.command] = (byCommand[r.command] ?? 0) + 1;
  const stops = projectStops(ctx).filter((r) => r.ts >= since);
  const stats = stopStats(stops);
  let current = 0.7;
  try {
    const config = loadProject(ctx.cwd);
    if (config) current = threshold(loadPack(config.pack, packDirs(ctx.env)), config.thresholds, "stop.gate", "claims_done", 0.7);
  } catch {
    void 0;
  }
  return {
    days: WINDOW_DAYS,
    receipts: {
      runs: receipts.length,
      requests: sum(receipts, "requests"),
      cached: sum(receipts, "cached"),
      input_tokens: sum(receipts, "input_tokens"),
      cost_usd: sum(receipts, "cost_usd"),
      by_command: byCommand,
    },
    stops: { ...stats, precision_ci95: interval(stats.right, stats.labelled), false_block_rate_ci95: interval(stats.wrong, stats.labelled) },
    threshold_suggestion: suggestThreshold(stops, current),
  };
}

export const FLOW_DAYS = [1, 7, 30] as const;
const FLOW_LIMIT = 200;
const FLOW_ANSWERS = 40;
const FLOW_OPTIONS = 6;
const CACHE_KEY = /^[0-9a-f]{64}$/;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function answerView(id: string, a: Answer) {
  const base = { id: visible(id), type: a.type };
  if (a.type === "noul") {
    const yes = num(a.noul);
    if (yes === null) return { ...base, value: "?", p: null, options: [] };
    return { ...base, value: yes >= 0.5 ? "yes" : "no", p: yes >= 0.5 ? yes : Math.round((1 - yes) * 10_000) / 10_000, options: [] };
  }
  if (a.type === "score") return { ...base, value: num(a.score)?.toFixed(2) ?? "?", p: num(a.confidence), options: [] };
  if (a.type === "choice") {
    const options = Object.entries(a.probabilities ?? {})
      .flatMap(([label, p]) => (num(p) === null ? [] : [{ label: visible(label), p: p as number }]))
      .sort((x, y) => y.p - x.p)
      .slice(0, FLOW_OPTIONS);
    return { ...base, value: visible(String(a.choice)), p: num(a.confidence), options };
  }
  return null;
}

function jevAnswers(ctx: UiContext, keys: readonly string[] | undefined) {
  const found: { model: string; answered_at: string; questions: NonNullable<ReturnType<typeof answerView>>[] }[] = [];
  let missing = 0;
  for (const key of keys ?? []) {
    const entry = CACHE_KEY.test(key) ? readCache(ctx.dataDir, key, ctx.now(), Number.POSITIVE_INFINITY) : null;
    if (!entry || typeof entry.answers !== "object" || entry.answers === null) {
      missing++;
      continue;
    }
    const questions = Object.entries(entry.answers)
      .slice(0, FLOW_ANSWERS)
      .flatMap(([id, a]) => (a && typeof a === "object" ? (answerView(id, a) ?? []) : []));
    found.push({ model: visible(String(entry.model)), answered_at: new Date(entry.ts).toISOString(), questions });
  }
  return { answers: found, answers_missing: missing };
}

function shortSession(id: string | undefined): string | null {
  return typeof id === "string" && id !== "unknown" && id !== "" ? visible(id.slice(0, 8)) : null;
}

export function flow(ctx: UiContext, query: { days?: unknown; command?: unknown } = {}) {
  const days = (FLOW_DAYS as readonly number[]).includes(Number(query.days)) ? Number(query.days) : 7;
  const since = new Date(ctx.now() - days * DAY_MS).toISOString();
  const receipts = readReceipts(ctx.dataDir, projectId(ctx.cwd)).filter((r) => r.ts >= since);
  const stops = projectStops(ctx).filter((r) => r.ts >= since);
  const commands = [...new Set(receipts.map((r) => r.command))].sort();
  if (stops.length) commands.push("stop");
  const command = typeof query.command === "string" && commands.includes(query.command) ? query.command : "all";
  const voided = readOverruled(ctx.dataDir);
  const calls = command === "stop" ? [] : receipts.filter((r) => command === "all" || r.command === command);
  const stopRows = command === "all" || command === "stop" ? stops : [];
  const rows = [...calls.map((r) => ({ ts: r.ts, r })), ...stopRows.map((s) => ({ ts: s.ts, s }))].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  const events = rows.slice(0, FLOW_LIMIT).map((row) => {
    if ("r" in row) {
      const r = row.r;
      return {
        kind: "call" as const,
        id: r.id,
        ts: r.ts,
        command: visible(r.command),
        pack: r.pack === undefined ? null : visible(r.pack),
        model: r.model === undefined ? null : visible(r.model),
        verdict: r.verdict === undefined ? null : visible(r.verdict),
        error: r.error === undefined ? null : visible(r.error),
        requests: r.requests,
        cached: r.cached,
        input_tokens: r.input_tokens,
        cost_usd: r.cost_usd,
        ms: r.ms,
        session: shortSession(r.session_id),
        overruled: voided.has(r.id),
        ...jevAnswers(ctx, r.cache_keys),
      };
    }
    const s = row.s;
    return {
      kind: "stop" as const,
      id: s.id,
      ts: s.ts,
      mode: s.mode,
      session: shortSession(s.session_id),
      skipped: s.skipped ?? null,
      edits: s.edits,
      checks: s.checks,
      ms: s.ms,
      claims_done: s.decision?.claims_done ?? null,
      claims_verified: s.decision?.claims_verified ?? null,
      would_block: s.decision?.would_block ?? null,
      label: s.label ?? null,
    };
  });
  return { days, command, commands, total: rows.length, shown: events.length, events };
}

const SENT = [
  { when: "Every call that asks Jev", what: "The pack's question text and the input it asks about, redacted first" },
  { when: "done", what: "Your criterion and the output you pipe in; recognised runner output is parsed in code and only counts, exit code and failing test names go out" },
  { when: "decide", what: "The decision, inline context, option texts and context_files contents, asked in two option orders" },
  { when: "judge, claims and verify", what: "The items, claims and source text you pass in" },
  { when: "Done-gate in shadow or soft mode", what: "Prompt start (1,500 chars), final message end (2,000 chars), check commands with pass/fail and edited file paths" },
  { when: "This dashboard", what: "Nothing: no network call leaves this process, no telemetry, no external fonts or scripts" },
] as const;

function fileInfo(dataDir: string, name: string): { name: string; bytes: number } | null {
  const path = join(dataDir, name);
  if (!existsSync(path)) return null;
  try {
    const st = statSync(path);
    return { name, bytes: st.isDirectory() ? dirSize(path) : st.size };
  } catch {
    return null;
  }
}

export function privacy(ctx: UiContext) {
  const project = projectId(ctx.cwd);
  const stops = readStops(ctx.dataDir);
  const stored = ["receipts", "cache", "results", "stops.jsonl", "labels.jsonl", "overruled.jsonl"].flatMap((n) => fileInfo(ctx.dataDir, n) ?? []);
  return {
    data_dir: tildify(ctx.dataDir, ctx.home),
    total_bytes: dirSize(ctx.dataDir),
    stored,
    counts: {
      receipts_this_project: readReceipts(ctx.dataDir, project).length,
      receipts_all_projects: readReceipts(ctx.dataDir).length,
      stops_this_project: stops.filter((r) => r.project === project).length,
      stops_all_projects: stops.length,
      labelled_this_project: stops.filter((r) => r.project === project && r.label !== undefined).length,
    },
    stores_text: [
      { name: "stops.jsonl", holds: "Prompt and final-message excerpts of done-gate stops, scores, your labels" },
      { name: "receipts", holds: "Counts, tokens, cost, latency and hashes per run; no request text" },
      { name: "cache", holds: "Jev's answers keyed by hashes; expires after 30 days" },
    ],
    would_be_sent: SENT,
  };
}

export function exportKind(ctx: UiContext, kind: unknown): { filename: string; body: string } | null {
  if (typeof kind !== "string" || !(EXPORT_KINDS as readonly string[]).includes(kind)) return null;
  const project = projectId(ctx.cwd);
  const rows: unknown[] =
    kind === "receipts"
      ? readReceipts(ctx.dataDir, project)
      : kind === "stops"
        ? projectStops(ctx)
        : projectStops(ctx).flatMap((r) => (r.label !== undefined ? [{ id: r.id, label: r.label, labelled_at: r.labelled_at }] : []));
  return { filename: `claude-referee-${kind}.jsonl`, body: rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "") };
}
