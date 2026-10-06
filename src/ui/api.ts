// Data side of the local dashboard: reads the JSON lines in the data directory and shapes them for the page.
// Labels go through labelStop (labels.jsonl); nothing here touches the network or rewrites a store.

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Env } from "../engine/config.ts";
import { dirSize, projectId, tildify } from "../engine/datadir.ts";
import { readReceipts, type Receipt } from "../engine/receipts.ts";
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
