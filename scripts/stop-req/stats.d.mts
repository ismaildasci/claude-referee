// Type declarations for scripts/stop-req/stats.mjs so tests can import it under strict TypeScript.

export const SEED: number;
export function summarize(rows: { task: string; cls: string; score: number }[], options?: { withBootstrap?: boolean }): Record<string, any>;
export function withinTaskAuc(rows: { task: string; cls: string; score: number }[]): { tasks: number; auc: number | null };
export function pairedDiff(rows: { id: string; task: string; cls: string; score: number }[], base: { id: string; score: number }[], options?: { resamples?: number; seed?: number }): { diff: number | null; ci95: [number, number] | null };
export function adoption(input: { summary: any; tally: any; baselineAuc: number; keywordB: any; sig?: number }): { judged: boolean; rules: Record<string, boolean>; verdict: string };
export function devThreshold(rows: { cls: string; score: number }[], minRecall?: number): number | null;
