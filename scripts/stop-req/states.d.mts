// Type declarations for scripts/stop-req/states.mjs so tests can import it under strict TypeScript.

export const STATES: string[];
export const WORDINGS: Record<number, string>;
export const ANSWER_KEY: Record<number, string>;
export const REPS: number[];
export const BASELINE: { id: string; state: string; wording: number; family: string };
export function configs(): { id: string; state: string; wording: number; family: string }[];
export function allConfigs(): { id: string; state: string; wording: number; family: string }[];
export function lineCount(text: unknown): number;
export function editStats(transcript: string): { file: string; added: number; removed: number }[];
export function buildState(cfg: { state: string }, f: any): Record<string, unknown>;
export function scoreOf(cfg: { wording: number }, answers: unknown): number | null;
export function meanScore(scores: (number | null | undefined)[]): number | null;
