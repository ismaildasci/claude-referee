// Type declarations for bench/arms.mjs so tests can import it under strict TypeScript.

export interface Arm { id: string; label: string; plugin: boolean; files: (task: { id: string }) => Record<string, string>; prompt: (task: { prompt: string }) => string }
export const TEST_HOOK: string;
export const TEST_HOOK_SETTINGS: string;
export function testHookActs(files: Record<string, string> | undefined): boolean;
export const TEST_HOOK_LINES: number;
export const GOAL_CONDITION: string;
export const REFEREE_SOFT_JSON: string;
export const ARMS: Record<string, Arm>;
export const ARM_IDS: string[];
export const UNAVAILABLE_ARMS: { id: string; reason: string }[];
