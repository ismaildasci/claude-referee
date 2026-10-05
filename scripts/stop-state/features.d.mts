// Type declarations for scripts/stop-state/features.mjs so tests can import it under strict TypeScript.

export function classifyClaim(text: string): "claim" | "no_claim" | "ambiguous";
export function splitTasks(rows: { task: string; class: string }[], seed?: number): Record<string, "dev" | "holdout">;
export function extractTurn(transcript: string): { calls: any[]; results: Map<string, { text: string; error: boolean }>; files: { file: string; content: string | null; hunks: string[] }[] };
export function changes(files: { file: string; content: string | null; hunks: string[] }[], n: number): { file: string; content?: string; hunks?: string[] }[];
export function configs(): { id: string; cand: string; n?: number }[];
export function scoreOf(cfg: { cand: string }, answers: unknown): number | null;
