// Type declarations for scripts/session-study/hard-breakdown.mjs.

type Ci = ((k: number, n: number) => { lower: number; upper: number }) | null;
export function sweep(sessions: unknown[], ci: Ci): Record<string, any>;
export function activeCriteria(report: Record<string, any>, options?: { abRun?: boolean }): { criterion: string; value: unknown; interval?: unknown; met: boolean }[];
export function hardBreakdown(sessions: unknown[], ci: Ci): Record<string, any>;
