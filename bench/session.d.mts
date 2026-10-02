// Type declarations for bench/session.mjs so tests can import it under strict TypeScript.

import type { Planned } from "./plan.mjs";

export interface Cases { hash: string; tasks: Record<string, any>[]; byId: Record<string, Record<string, any>> }
export interface RunOpts { claude?: string; projectsDir?: string; perSessionUsd?: number; timeoutMs?: number; extraEnv?: Record<string, string> }
export const ALLOWED_TOOLS: string;
export const PER_SESSION_USD: number;
export function paths(out: string, id: string): { work: string; data: string; session: string };
export function readLedger(out: string): { id: string; usd: number; estimated?: boolean }[];
export function spentUsd(entries: { usd: number }[]): number;
export function mayStart(entries: { usd: number }[], capUsd: number, perSessionUsd?: number): boolean;
export function loadCases(file: string): Cases;
export function prepare(input: { out: string; repoRoot: string; cases: Cases }): void;
export function parseRun(stdout: string): Record<string, any> | null;
export function encodeProjectDir(path: string): string;
export function findProjectDir(projectsDir: string, workDir: string, id: string, sessionId?: string): string | null;
export function harvestTranscripts(input: { projectsDir: string; workDir: string; id: string; sessionId: string; dest: string }): { main: boolean; extra: number };
export function runVerifier(input: { out: string; task: Record<string, any>; workDir: string; timeoutMs?: number }): { status: "pass" | "fail" | "error"; exit: number | null; tail: string };
export function armEvidence(input: { armId: string; dataDir: string; transcript: string }): Record<string, any>;
export function runSession(input: { out: string; plan: Planned; cases: Cases; opts?: RunOpts }): Promise<{ id: string; skipped?: boolean; ground?: Record<string, any> }>;
export function runAll(input: { out: string; plans: Planned[]; cases: Cases; capUsd: number; perSessionUsd?: number; opts?: RunOpts; log?: (line: string) => void }): Promise<{ ran: number; skipped: number; stopped: string | null; spent_usd: number }>;
export function readGrounds(out: string): Record<string, any>[];
export function ambiguousPending(out: string): Record<string, any>[];
export function setManual(out: string, id: string, value: "claim" | "no_claim"): void;
export function makeWorkTree(dir: string, task: Record<string, any>, arm: Record<string, any>): void;
