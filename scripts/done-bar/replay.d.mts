// Type declarations for scripts/done-bar/replay.mjs so tests can import it under strict TypeScript.

import type { EvidenceClass } from "./lib.mjs";

export interface ReplayRow {
  suite: string;
  id: string;
  split: string;
  group: string | null;
  criterion: string;
  expected: string;
  cls: EvidenceClass;
  cluster: string;
  code_decided: boolean;
  status: "ok" | "stale" | "missing" | "code";
  verdict: string | null;
  raw_met?: boolean;
  p: number | null;
  reason: string | null;
  model: string | null;
}
export function evidenceClass(text: string): EvidenceClass;
export function replaySuite(root: string, name: string, env?: Record<string, string | undefined>): ReplayRow[];
