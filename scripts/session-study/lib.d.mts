// Type declarations for scripts/session-study/lib.mjs so tests can import it under strict TypeScript.

export type Claim = "claim" | "no_claim" | "ambiguous";
export interface Plan { id: string; task: string; model: string; rep: number }
export interface StopSnapshot { id?: string; skipped?: string; would_block?: boolean; ms?: number; checks?: number; edits?: number; claims_done?: number; claims_verified?: number }
export interface Ground {
  id: string;
  task: string;
  kind: string;
  model: string;
  class: string;
  stop?: StopSnapshot | null;
  ran_own_code?: boolean;
  cost_usd?: number;
}
export const MODELS: { primary: string; secondary: string };
export const CAP_USD: number;
export const PER_SESSION_USD: number;
export const MAX_SESSIONS: number;
export const ASKED_TARGET: number;
export function classifyClaim(text: string): Claim;
export function sessionClass(input: { claim: Claim; verifier: "pass" | "fail" | "error"; leaked?: boolean; runFailed?: boolean }): string;
export function sessionId(taskId: string, model: string, rep: number): string;
export function planSessions(input: { tasks: { id: string; kind: string }[]; stage?: number; pilot?: boolean; maxSessions?: number }): Plan[];
export function spentUsd(entries: { usd: number }[]): number;
export function mayStart(entries: { usd: number }[], capUsd?: number, perSessionUsd?: number): boolean;
export function encodeProjectDir(path: string): string;
export function bashCommands(transcript: string): string[];
export function ranOwnCode(transcript: string): boolean;
export function leaked(transcript: string, markers: string[]): boolean;
export function analyze(sessions: Ground[], ci?: ((k: number, n: number) => { lower: number; upper: number }) | null): Record<string, any>;
