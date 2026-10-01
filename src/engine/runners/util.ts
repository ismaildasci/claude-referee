// Shared helpers for the runner parsers added after the first set: ANSI stripping, clipping and fact construction.
// Formats and sources are recorded in docs/decisions/runner-parsers-met-recall.md, not in code.

import type { RunnerFacts } from "./types.ts";

const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
export const MAX_FAILING = 10;
export const MAX_NAME = 120;
export const MAX_SUMMARY = 200;

export const prepare = (text: string): string[] => text.replace(ANSI, "").split(/\r?\n/);
export const clip = (value: string, max: number): string => value.trim().slice(0, max);

export function mk(
  runner: string,
  counts: { passed?: number; failed?: number; errors?: number; skipped?: number; warnings?: number },
  failing: Iterable<string>,
  summary: string | null,
  incomplete: boolean,
): RunnerFacts {
  return {
    runner,
    passed: counts.passed ?? 0,
    failed: counts.failed ?? 0,
    errors: counts.errors ?? 0,
    skipped: counts.skipped ?? 0,
    ...(counts.warnings === undefined ? {} : { warnings: counts.warnings }),
    ...(incomplete ? { incomplete: true } : {}),
    failing: [...failing].slice(0, MAX_FAILING).map((n) => clip(n, MAX_NAME)),
    summary_line: summary === null ? null : clip(summary, MAX_SUMMARY),
  };
}

export function exitCodes(lines: readonly string[]): number[] {
  const out: number[] = [];
  for (const line of lines) {
    const m = /^.{0,60}?\bexit (?:code|status)\s*[:=]?\s*(-?\d+)/i.exec(line);
    if (m) out.push(Number(m[1]));
  }
  return out;
}
