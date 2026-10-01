// Local store of the Stop done-gate in shadow mode: one JSON line per stop in <dataDir>/stops.jsonl.
// Best-effort writes that never throw; labels are rewritten atomically; stats feed the precision measurement.

import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StopRecord } from "./types.ts";

const MAX_BYTES = 2_000_000;
const RETENTION_MS = 90 * 86_400_000;

export interface StopStats {
  readonly stops: number;
  readonly skipped_by_reason: Readonly<Record<string, number>>;
  readonly asked: number;
  readonly would_block: number;
  readonly labelled: number;
  readonly right: number;
  readonly wrong: number;
  readonly precision: number | null;
  readonly false_block_rate: number | null;
  readonly p95_ms: number | null;
  readonly unlabelled_would_block: number;
}

export function stopsFile(dataDir: string): string {
  return join(dataDir, "stops.jsonl");
}

export function newStopId(now: number, random: () => number = Math.random): string {
  const tail = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `s${now.toString(36)}${tail}`;
}

function parseLines(text: string): StopRecord[] {
  const out: StopRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof (value as StopRecord).id === "string") out.push(value as StopRecord);
    } catch {
      continue;
    }
  }
  return out;
}

function writeAtomic(file: string, records: readonly StopRecord[]): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""), { mode: 0o600 });
  renameSync(tmp, file);
}

export function appendStop(dataDir: string, record: StopRecord): void {
  try {
    mkdirSync(dataDir, { recursive: true });
    const file = stopsFile(dataDir);
    appendFileSync(file, JSON.stringify(record) + "\n", { mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      void 0;
    }
    if (statSync(file).size > MAX_BYTES) {
      const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
      writeAtomic(file, parseLines(readFileSync(file, "utf8")).filter((r) => r.ts >= cutoff));
    }
  } catch {
    return;
  }
}

export function readStops(dataDir: string): StopRecord[] {
  const file = stopsFile(dataDir);
  try {
    if (!existsSync(file)) return [];
    return parseLines(readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

export function labelStop(dataDir: string, id: string, label: "right" | "wrong", nowIso: string): boolean {
  const records = readStops(dataDir);
  if (!records.some((r) => r.id === id)) return false;
  writeAtomic(
    stopsFile(dataDir),
    records.map((r) => (r.id === id ? { ...r, label, labelled_at: nowIso } : r)),
  );
  return true;
}

export function stopStats(records: readonly StopRecord[]): StopStats {
  const skipped: Record<string, number> = {};
  for (const r of records) if (r.skipped) skipped[r.skipped] = (skipped[r.skipped] ?? 0) + 1;
  const asked = records.filter((r) => r.decision !== undefined);
  const blocks = asked.filter((r) => r.decision?.would_block === true);
  const labelledBlocks = blocks.filter((r) => r.label !== undefined);
  const right = labelledBlocks.filter((r) => r.label === "right").length;
  const wrong = labelledBlocks.filter((r) => r.label === "wrong").length;
  const times = asked.map((r) => r.ms).sort((a, b) => a - b);
  return {
    stops: records.length,
    skipped_by_reason: skipped,
    asked: asked.length,
    would_block: blocks.length,
    labelled: labelledBlocks.length,
    right,
    wrong,
    precision: labelledBlocks.length ? right / labelledBlocks.length : null,
    false_block_rate: labelledBlocks.length ? wrong / labelledBlocks.length : null,
    p95_ms: times.length ? (times[Math.ceil(0.95 * times.length) - 1] ?? null) : null,
    unlabelled_would_block: blocks.length - labelledBlocks.length,
  };
}
