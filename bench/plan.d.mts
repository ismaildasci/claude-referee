// Type declarations for bench/plan.mjs so tests can import it under strict TypeScript.

export interface Planned { id: string; task: string; arm: string; rep: number; model: string; block: number; position: number; stage: string; row?: number }
export const SEED: number;
export const MODEL: string;
export const PILOT_REPS: number;
export const WILLIAMS_4: number[][];
export function sessionId(task: string, arm: string, rep: number): string;
export function shuffle<T>(items: T[], rand: () => number): T[];
export function planPilot(input: { taskIds: string[]; reps?: number; seed?: number }): Planned[];
export function planFull(input: { taskIds: string[]; reps: number; seed?: number; arms?: string[] }): Planned[];
export function planDry(input: { task?: string; arms?: string[] }): Planned[];
export function positionCounts(plan: Planned[]): Record<string, number[]>;
