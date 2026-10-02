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
export const CHUNK_SIZE: number;
export const TODO_QUESTION: string;
export function TASK_TEXT(n: number | string, repo: string): string;
export const ALONE_SUFFIX: string;
export function delegateSuffix(plugin: string): string;
export const DELEGATE_REFEREE_JSON: string;
export function chunkFiles(items: { id: string; text: string }[]): Record<string, string>;
export interface DelegationTask { id?: string; repo: string; items: { id: string; text: string }[] }
export interface DelegationArm { id: string; label: string; plugin: boolean; files: (task: DelegationTask) => Record<string, string>; prompt: (task: DelegationTask, ctx?: { plugin?: string }) => string }
export const DELEGATION_ARMS: Record<string, DelegationArm>;
export const DELEGATION_ARM_IDS: string[];
