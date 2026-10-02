// Offline scoring of recorded Jev answers: case parsing, recording lookup by question and state hash, metrics and sweeps.
// The kill criterion is the count of wrong positives (a "met" or OK that should not be), because that ends Claude's work.

import { RefereeError } from "./errors.ts";

export interface EvalCase {
  readonly id: string;
  readonly split: "dev" | "holdout";
  readonly expected: string;
  readonly [field: string]: unknown;
}

export interface RecordingKey {
  readonly case: string;
  readonly qhash: string;
  readonly shash: string;
  readonly model: string;
  readonly ablation?: string | undefined;
}

export interface Recording extends RecordingKey {
  readonly answers: unknown;
  readonly [field: string]: unknown;
}

export interface Scored {
  readonly id: string;
  readonly split: string;
  readonly expected: string;
  readonly verdict: string;
}

export interface Metrics {
  readonly cases: number;
  readonly verdicts: Record<string, number>;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly automation: number;
  readonly wrong_positive: number;
  readonly wrong_negative: number;
}

export interface SweepRow {
  readonly t: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly wrong_positive: number;
}

const MIN_PER_CLASS = 10;

export function parseCases(text: string): EvalCase[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, i) => {
      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(line) as Record<string, unknown>;
      } catch {
        throw new RefereeError("bad_input", `Eval case line ${i + 1} is not valid JSON.`);
      }
      const { id, split, expected } = raw;
      if (typeof id !== "string" || !id) throw new RefereeError("bad_input", `Eval case line ${i + 1} needs an id.`);
      if (seen.has(id)) throw new RefereeError("bad_input", `Eval case id ${id} appears twice.`);
      if (split !== "dev" && split !== "holdout") throw new RefereeError("bad_input", `Eval case ${id} needs split "dev" or "holdout".`);
      if (typeof expected !== "string" || !expected) throw new RefereeError("bad_input", `Eval case ${id} needs an expected label.`);
      seen.add(id);
      return { ...raw, id, split, expected } as EvalCase;
    });
}

export function parseRecordings(text: string): Recording[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Recording];
      } catch {
        return [];
      }
    });
}

export function findRecording(lines: readonly Recording[], key: RecordingKey): { status: "ok"; line: Recording } | { status: "missing" | "stale" } {
  const forCase = lines.filter((l) => l.case === key.case && l.model === key.model && (l.ablation ?? undefined) === key.ablation);
  const match = [...forCase].reverse().find((l) => l.qhash === key.qhash && l.shash === key.shash);
  if (match) return { status: "ok", line: match };
  return { status: forCase.length > 0 ? "stale" : "missing" };
}

const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);

export function metrics(items: readonly Scored[], positive: string): Metrics {
  const verdicts: Record<string, number> = positive === "yes" ? { yes: 0, review: 0, no: 0 } : positive === "block" ? { block: 0, allow: 0, skipped: 0, unsure: 0 } : { met: 0, unsure: 0, missing: 0 };
  const undecidedVerdict = positive === "yes" ? "review" : "unsure";
  for (const item of items) verdicts[item.verdict] = (verdicts[item.verdict] ?? 0) + 1;
  const predicted = items.filter((i) => i.verdict === positive);
  const actual = items.filter((i) => i.expected === positive);
  const truePositive = predicted.filter((i) => i.expected === positive).length;
  const decided = items.filter((i) => i.verdict !== undecidedVerdict).length;
  return {
    cases: items.length,
    verdicts,
    precision: ratio(truePositive, predicted.length),
    recall: ratio(truePositive, actual.length),
    automation: ratio(decided, items.length) ?? 0,
    wrong_positive: predicted.length - truePositive,
    wrong_negative: items.filter((i) => i.expected === positive && i.verdict !== positive && i.verdict !== undecidedVerdict).length,
  };
}

export function parseSweep(spec: string): number[] {
  const parts = spec.split(":").map(Number);
  const [from, to, step] = parts;
  if (parts.length !== 3 || from === undefined || to === undefined || step === undefined || parts.some((n) => !Number.isFinite(n)) || step <= 0 || from > to) {
    throw new RefereeError("bad_input", "--sweep takes from:to:step, e.g. 0.50:0.95:0.05.");
  }
  const out: number[] = [];
  for (let t = from; t <= to + 1e-9; t += step) out.push(Number(t.toFixed(4)));
  return out;
}

export function sweep(items: readonly { expected: string; p: number }[], positive: string, thresholds: readonly number[]): { rows: SweepRow[]; suggested: number | null; reason?: string } {
  const rows = thresholds.map((t) => {
    const predicted = items.filter((i) => i.p >= t);
    const truePositive = predicted.filter((i) => i.expected === positive).length;
    return { t, precision: ratio(truePositive, predicted.length), recall: ratio(truePositive, items.filter((i) => i.expected === positive).length), wrong_positive: predicted.length - truePositive };
  });
  const positives = items.filter((i) => i.expected === positive).length;
  const negatives = items.length - positives;
  if (positives < MIN_PER_CLASS || negatives < MIN_PER_CLASS) {
    return { rows, suggested: null, reason: `No suggestion: fewer than ${MIN_PER_CLASS} cases in a class (${positives} positive, ${negatives} other).` };
  }
  const safe = rows.find((r) => r.wrong_positive === 0);
  return safe ? { rows, suggested: safe.t } : { rows, suggested: null, reason: "No threshold in the range avoids a wrong positive." };
}

export const DECIDE_VERDICTS = ["clear", "weak", "tie"] as const;

export interface DecideScored {
  readonly id: string;
  readonly split: string;
  readonly expected: string;
  readonly lean: string;
  readonly verdict: string;
  readonly order_disagrees: boolean;
}

export interface DecideMetrics {
  readonly cases: number;
  readonly agree: number;
  readonly agreement: number | null;
  readonly verdicts: Record<string, number>;
  readonly order_disagrees: number;
  readonly by_verdict: Record<string, { cases: number; agree: number }>;
}

export function decideMetrics(items: readonly DecideScored[]): DecideMetrics {
  const verdicts: Record<string, number> = Object.fromEntries(DECIDE_VERDICTS.map((v) => [v, 0]));
  const byVerdict: Record<string, { cases: number; agree: number }> = Object.fromEntries(DECIDE_VERDICTS.map((v) => [v, { cases: 0, agree: 0 }]));
  let agree = 0;
  for (const item of items) {
    const hit = item.lean === item.expected;
    if (hit) agree += 1;
    verdicts[item.verdict] = (verdicts[item.verdict] ?? 0) + 1;
    const group = (byVerdict[item.verdict] ??= { cases: 0, agree: 0 });
    group.cases += 1;
    if (hit) group.agree += 1;
  }
  return { cases: items.length, agree, agreement: ratio(agree, items.length), verdicts, order_disagrees: items.filter((i) => i.order_disagrees).length, by_verdict: byVerdict };
}

export interface DecideShift {
  readonly leader_changed: number;
  readonly agree_delta: number;
  readonly verdict_changed: number;
}

export function decideShift(base: readonly DecideScored[], other: readonly DecideScored[]): DecideShift {
  const byId = new Map(base.map((b) => [b.id, b]));
  const pairs = other.flatMap((o) => (byId.has(o.id) ? [[byId.get(o.id) as DecideScored, o] as const] : []));
  return {
    leader_changed: pairs.filter(([x, y]) => x.lean !== y.lean).length,
    agree_delta: decideMetrics(other).agree - decideMetrics(base).agree,
    verdict_changed: pairs.filter(([x, y]) => x.verdict !== y.verdict).length,
  };
}
