// Type declarations for bench/pilot.mjs so tests can import it under strict TypeScript.

export const FULL_CAP_USD: number;
export const PILOT_CAP_USD: number;
export const DRY_CAP_USD: number;
export const REPS_MAX: number;
export const COST_SAFETY: number;
export const MIN_PILOT_EVENTS: number;
export function sizeFromPilot(grounds: Record<string, any>[], options?: { cases?: number; tasks?: number; arms?: number; capUsd?: number; repsMax?: number }): Record<string, any>;
