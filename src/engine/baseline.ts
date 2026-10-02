// Baseline ratchet for judge: stores only hashes of flagged items (question id + normalised text) with a count.
// Line moves keep a hash, edits change it; the file holds no source text, ids or paths and is safe to commit.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RefereeError } from "./errors.ts";

export const BASELINE_VERSION = 1;

export interface Baseline {
  readonly version: number;
  readonly pack: string;
  readonly entries: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

const HASH = /^[0-9a-f]{16}$/;

export function normalise(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function itemHash(question: string, text: string): string {
  return createHash("sha256").update(`v${BASELINE_VERSION}\0${question}\0${normalise(text)}`).digest("hex").slice(0, 16);
}

export function parseBaseline(text: string): Baseline {
  const bad = (why: string) => new RefereeError("bad_input", `The baseline file is not valid: ${why}.`, { next_step: "Record it again with --baseline-write." });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw bad("not JSON");
  }
  const { version, pack, entries } = (raw ?? {}) as { version?: unknown; pack?: unknown; entries?: unknown };
  if (version !== BASELINE_VERSION) throw bad(`version ${String(version)} is not supported, expected ${BASELINE_VERSION}`);
  if (typeof pack !== "string" || typeof entries !== "object" || entries === null || Array.isArray(entries)) throw bad("missing pack or entries");
  const checked: Record<string, Record<string, number>> = {};
  for (const [question, hashes] of Object.entries(entries)) {
    if (typeof hashes !== "object" || hashes === null || Array.isArray(hashes)) throw bad(`entries.${question} is not an object`);
    const counts: Record<string, number> = {};
    for (const [hash, count] of Object.entries(hashes)) {
      if (!HASH.test(hash) || typeof count !== "number" || !Number.isInteger(count) || count < 1) throw bad(`entries.${question} holds a bad hash or count`);
      counts[hash] = count;
    }
    checked[question] = counts;
  }
  return { version, pack, entries: checked };
}

export function readBaseline(path: string): Baseline | null {
  if (!existsSync(path)) return null;
  try {
    return parseBaseline(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof RefereeError) throw error;
    throw new RefereeError("bad_input", "Cannot read the baseline file.");
  }
}

export function buildBaseline(pack: string, flagged: readonly { question: string; hash: string }[]): Baseline {
  const entries: Record<string, Record<string, number>> = {};
  for (const { question, hash } of flagged) {
    const counts = (entries[question] ??= {});
    counts[hash] = (counts[hash] ?? 0) + 1;
  }
  return { version: BASELINE_VERSION, pack, entries };
}

export function writeBaseline(path: string, baseline: Baseline): void {
  const sorted = Object.fromEntries(
    Object.keys(baseline.entries)
      .sort()
      .map((q) => [q, Object.fromEntries(Object.entries(baseline.entries[q] ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)))]),
  );
  const body = JSON.stringify({ version: baseline.version, pack: baseline.pack, entries: sorted }, null, 2) + "\n";
  try {
    mkdirSync(dirname(path), { recursive: true });
    const temp = `${path}.tmp-${process.pid}`;
    writeFileSync(temp, body);
    renameSync(temp, path);
  } catch {
    throw new RefereeError("bad_input", "Cannot write the baseline file.", { next_step: "Check the path and permissions; the answers are cached, so running again is free." });
  }
}

export function total(baseline: Baseline | null, questions?: readonly string[]): number {
  if (!baseline) return 0;
  return Object.entries(baseline.entries)
    .filter(([q]) => !questions || questions.includes(q))
    .reduce((sum, [, counts]) => sum + Object.values(counts).reduce((a, b) => a + b, 0), 0);
}

export interface Split {
  readonly fresh: boolean[];
  readonly gone: number;
}

// Multiset match in item order: the first N copies of a hash (N = recorded count) are known, later copies are new.
export function split(baseline: Baseline, questions: readonly string[], flagged: readonly { question: string; hash: string }[]): Split {
  const left = new Map<string, number>();
  for (const q of questions) for (const [hash, count] of Object.entries(baseline.entries[q] ?? {})) left.set(`${q}:${hash}`, count);
  const fresh = flagged.map(({ question, hash }) => {
    const key = `${question}:${hash}`;
    const remaining = left.get(key) ?? 0;
    if (remaining > 0) {
      left.set(key, remaining - 1);
      return false;
    }
    return true;
  });
  let gone = 0;
  for (const remaining of left.values()) gone += remaining;
  return { fresh, gone };
}
