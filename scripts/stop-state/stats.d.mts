// Type declarations for scripts/stop-state/stats.mjs so tests can import it under strict TypeScript.

export const SEED: number;
export function mulberry32(seed: number): () => number;
export function auc(wrong: number[], right: number[]): number | null;
export function permutationP(wrong: number[], right: number[]): number | null;
export function devThreshold(rows: { cls: string; score: number }[], minRecall?: number): number | null;
export function bootstrap(rows: { task: string; cls: string; score: number }[], unit: "task" | "session", options?: { resamples?: number; seed?: number }): { ci95: [number, number] | null; discarded: number };
export function tally(rows: { cls: string; score: number }[], t: number): Record<string, any>;
