// Type declarations for scripts/stop-req/sessions.mjs so tests can import it under strict TypeScript.

export const FRESH_SEED: number;
export const FRESH_CAP_USD: number;
export const FRESH_MAX: number;
export function planFresh(taskIds: string[], seed?: number): { id: string; task: string; model: string; rep: number }[];
