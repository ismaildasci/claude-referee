// Local store of the Stop done-gate in shadow mode: one JSON line per stop in <dataDir>/stops.jsonl.
// Best-effort writes that never throw; labels are appended to labels.jsonl and merged on read, so labelling never rewrites the stops; stats feed the precision measurement.
// Past 2 MB, a stop whose oldest record is a day beyond the 90-day retention prunes the file: under a lock taken without waiting (skip on contention),
// via temp file + rename, copying lines other sessions appended meanwhile. Pruning leaves no record older than the retention, so it runs at most about once a day.
// An append that reached the renamed-away file is written again; the copy that may cause is collapsed by id on read and on pruning (first wins).

import { appendFileSync, chmodSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { StopRecord } from "./types.ts";

const MAX_BYTES = 2_000_000;
const RETENTION_MS = 90 * 86_400_000;
const SLACK_MS = 86_400_000;
const HEAD_BYTES = 16_384;
const LOCK_STALE_MS = 30_000;

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
  readonly errors: number;
  readonly error_rate: number | null;
  readonly p95_all_ms: number | null;
  readonly unlabelled_would_block: number;
}

export function stopsFile(dataDir: string): string {
  return join(dataDir, "stops.jsonl");
}

export function labelsFile(dataDir: string): string {
  return join(dataDir, "labels.jsonl");
}

export function newStopId(now: number, random: () => number = Math.random): string {
  const tail = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `s${now.toString(36)}${tail}`;
}

function parseLines(text: string): StopRecord[] {
  const out: StopRecord[] = [];
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (value === null || typeof value !== "object" || Array.isArray(value) || typeof (value as StopRecord).id !== "string" || seen.has((value as StopRecord).id)) continue;
      seen.add((value as StopRecord).id);
      out.push(value as StopRecord);
    } catch {
      continue;
    }
  }
  return out;
}

function readRange(fd: number, from: number, to: number): Buffer {
  const buf = Buffer.alloc(Math.max(0, to - from));
  let got = 0;
  while (got < buf.length) {
    const n = readSync(fd, buf, got, buf.length - got, from + got);
    if (n <= 0) break;
    got += n;
  }
  return buf.subarray(0, got);
}

function copyTail(fd: number, dest: string, from: number): number {
  const tail = readRange(fd, from, fstatSync(fd).size);
  const end = tail.lastIndexOf(10) + 1;
  if (end > 0) appendFileSync(dest, tail.subarray(0, end));
  return from + end;
}

function pruneDue(file: string, before: string): boolean {
  const fd = openSync(file, "r");
  try {
    const head = readRange(fd, 0, HEAD_BYTES).toString("utf8");
    const end = head.lastIndexOf("\n");
    if (end < 0) return false;
    const first = parseLines(head.slice(0, end + 1))[0];
    return typeof first?.ts !== "string" || first.ts < before;
  } finally {
    closeSync(fd);
  }
}

function compact(file: string, now: number): void {
  const lock = `${file}.lock`;
  let held: number;
  try {
    held = openSync(lock, "wx", 0o600);
  } catch {
    if (now - statSync(lock).mtimeMs > LOCK_STALE_MS) unlinkSync(lock);
    return;
  }
  const tmp = `${file}.${process.pid}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(file, "r");
    const all = readRange(fd, 0, fstatSync(fd).size);
    const end = all.lastIndexOf(10) + 1;
    const cutoff = new Date(now - RETENTION_MS).toISOString();
    const kept = parseLines(all.subarray(0, end).toString("utf8")).filter((r) => typeof r.ts === "string" && r.ts >= cutoff);
    writeFileSync(tmp, kept.map((r) => JSON.stringify(r) + "\n").join(""), { mode: 0o600 });
    const copied = copyTail(fd, tmp, end);
    // Windows refuses to replace a file this process still holds open, so there the descriptor is closed first and the post-rename tail copy is skipped.
    if (process.platform === "win32") {
      closeSync(fd);
      fd = undefined;
    }
    renameSync(tmp, file);
    if (fd !== undefined) copyTail(fd, file, copied);
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(tmp)) unlinkSync(tmp);
    closeSync(held);
    unlinkSync(lock);
  }
}

export function appendStop(dataDir: string, record: StopRecord): void {
  try {
    mkdirSync(dataDir, { recursive: true });
    const file = stopsFile(dataDir);
    const line = JSON.stringify(record) + "\n";
    const fd = openSync(file, "a", 0o600);
    let ino: number;
    try {
      writeSync(fd, line);
      ino = fstatSync(fd).ino;
    } finally {
      closeSync(fd);
    }
    if (statSync(file).ino !== ino) appendFileSync(file, line, { mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      void 0;
    }
    if (statSync(file).size <= MAX_BYTES) return;
    const now = Date.now();
    if (pruneDue(file, new Date(now - RETENTION_MS - SLACK_MS).toISOString())) compact(file, now);
  } catch {
    return;
  }
}

interface LabelLine {
  readonly id: string;
  readonly label: "right" | "wrong";
  readonly labelled_at: string;
}

function readLabels(dataDir: string): Map<string, LabelLine> {
  const out = new Map<string, LabelLine>();
  try {
    const file = labelsFile(dataDir);
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const v = JSON.parse(line) as Partial<LabelLine> | null;
        if (v && typeof v.id === "string" && (v.label === "right" || v.label === "wrong") && typeof v.labelled_at === "string") out.set(v.id, v as LabelLine);
      } catch {
        continue;
      }
    }
  } catch {
    return out;
  }
  return out;
}

export function readStops(dataDir: string): StopRecord[] {
  const file = stopsFile(dataDir);
  try {
    if (!existsSync(file)) return [];
    const labels = readLabels(dataDir);
    return parseLines(readFileSync(file, "utf8")).map((r) => {
      const l = labels.get(r.id);
      return l ? { ...r, label: l.label, labelled_at: l.labelled_at } : r;
    });
  } catch {
    return [];
  }
}

export function labelStop(dataDir: string, id: string, label: "right" | "wrong", nowIso: string): boolean {
  if (!readStops(dataDir).some((r) => r.id === id)) return false;
  try {
    appendFileSync(labelsFile(dataDir), JSON.stringify({ id, label, labelled_at: nowIso }) + "\n", { mode: 0o600 });
  } catch {
    return false;
  }
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
  const errors = records.filter((r) => r.skipped === "jev_error" || r.skipped === "breaker_open").length;
  const allTimes = [...asked, ...records.filter((r) => r.skipped === "jev_error")].map((r) => r.ms).sort((a, b) => a - b);
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
    errors,
    error_rate: asked.length + errors ? errors / (asked.length + errors) : null,
    p95_all_ms: allTimes.length ? (allTimes[Math.ceil(0.95 * allTimes.length) - 1] ?? null) : null,
    unlabelled_would_block: blocks.length - labelledBlocks.length,
  };
}
