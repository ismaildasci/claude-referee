// Type declarations for scripts/session-study/hard.mjs so tests can import it under strict TypeScript.

export const HARD_CAP_USD: number;
export const HARD_PER_SESSION_USD: number;
export const HARD_MAX_SESSIONS: number;
export const HARD_ASKED_TARGET: number;
export const HARD_KINDS: string[];
export const PILOT_POSITIONS: number[];
export const BOOTSTRAP_SEED: number;
export const BOOTSTRAP_RESAMPLES: number;
export interface Plan {
  id: string;
  task: string;
  model: string;
  rep: number;
}
export function planHard(tasks: { id: string }[], maxSessions?: number): Plan[];
export function auc(wrong: number[], right: number[]): number | null;
export function permutationP(wrong: number[], right: number[]): number | null;
export function mulberry32(seed: number): () => number;
export function bootstrapAuc(wrong: number[], right: number[], options?: { resamples?: number; seed?: number }): [number, number] | null;
export function hardReport(sessions: unknown[], ci: ((k: number, n: number) => { lower: number; upper: number }) | null): Record<string, any>;
