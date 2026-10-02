// Type declarations for scripts/session-study/runner.mjs so tests can import it under strict TypeScript.

import type { Ground, Plan } from "./lib.mjs";

export const ALLOWED_TOOLS: string;
export const ALLOWED_TOOLS_HARD: string;
export interface RunOpts { claude?: string; projectsDir?: string; perSessionUsd?: number; timeoutMs?: number; allowedTools?: string }
export function paths(out: string, id: string): { work: string; data: string; session: string };
export function readLedger(out: string): { id: string; usd: number; estimated?: boolean }[];
export function prepare(input: { out: string; repoRoot: string; tasks?: { id: string }[] }): { hash: string; count: number; ids: string[] };
export function runSession(input: { out: string; plan: Plan; opts?: RunOpts }): Promise<{ id: string; skipped?: boolean; ground?: Ground & Record<string, any> }>;
export function runAll(input: { out: string; plans: Plan[]; capUsd?: number; perSessionUsd?: number; opts?: RunOpts; shouldStop?: () => boolean; log?: (line: string) => void }): Promise<{ ran: number; skipped: number; stopped: string | null; spent_usd: number }>;
export function readGrounds(out: string): (Ground & Record<string, any>)[];
export function writeLabels(out: string): { labelled: number; merged: string };
export function ambiguousPending(out: string): (Ground & Record<string, any>)[];
export function setManual(out: string, id: string, value: "claim" | "no_claim"): void;
export function findProjectDir(projectsDir: string, workDir: string, id: string, sessionId?: string): string | null;
export function askedCount(out: string): number;
