// Type declarations for bench/stats.mjs so tests can import it under strict TypeScript.

export function clopperPearson(x: number, n: number, confidence?: number): { readonly lower: number; readonly upper: number };
export function mulberry32(seed: number): () => number;
export function wilson(k: number, n: number, z?: number): { lower: number; upper: number };
export function newcombeDiff(k1: number, n1: number, k2: number, n2: number): { diff: number; lower: number; upper: number };
export function fisherLess(k1: number, n1: number, k2: number, n2: number): number;
export function holm(ps: number[]): number[];
export function minEventsForZero(n: number, alpha?: number): number | null;
export function requiredN(p0: number, nMax: number, alpha?: number): number | null;
export function clusterBootstrap<T extends { task: string }>(rows: T[], statistic: (rows: T[]) => number | null, options?: { resamples?: number; seed?: number }): { lower: number | null; upper: number | null; resamples: number; dropped: number };
