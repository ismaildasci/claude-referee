// Type declarations for bench/delegation-session.mjs and bench/delegation-items.mjs so tests can import them under strict TypeScript.

export interface Item { id: string; where?: string; text: string; label: boolean }
export interface DCase { id: string; repo: string; sha: string; pathPattern: string; tracked: number; untracked: number; n_items: number; n_tracked: number; items_sha256: string }
export interface DCases { hash: string; cases: DCase[]; byId: Record<string, DCase> }
export interface DPlan { id: string; case: string; arm: string; rep: number; model: string; block: number; position: number; stage: string }
export interface Ground { [key: string]: any }
export const DRY_CAP_USD: number;
export const PILOT_CAP_USD: number;
export const MAIN_CAP_USD: number;
export const PILOT_REPS: number;
export const MAIN_REPS: number;
export const K_MAX: number;
export const SEED: number;
export function loadDelegationCases(file: string): DCases;
export function buildItems(input: { cacheDir: string; cases: DCases; fetch?: (a: { cacheDir: string; repo: string; sha: string }) => string }): Record<string, Item[]>;
export function planDelegation(input: { caseIds: string[]; reps: number; stage: string; seed?: number }): DPlan[];
export function planDry(caseId?: string): DPlan[];
export function prepareDelegation(input: { out: string; repoRoot: string; cases: DCases; itemsByCase: Record<string, Item[]> }): { cases_hash: string; pack_sha256: string; cli_sha256: string | null };
export function readFindings(workDir: string): { status: "missing" | "unparsable" | "ok"; raw: unknown[] };
export function scoreFindings(items: Item[], raw: unknown[]): { tp: number; fp: number; fn: number; invalid: number; duplicates: number; found: number; positives: number; items: number };
export function transcriptTools(transcript: string): { uses: { id: string; order: number; name: string; input: Record<string, unknown> }[]; results: Map<string, string> };
export function toolStats(t: ReturnType<typeof transcriptTools>): { counts: Record<string, number>; scripted: boolean };
export function judgeStats(t: ReturnType<typeof transcriptTools>): { calls: number; chunks_judged: number; answered: number; yes: number; no: number; review: number; unanswered: number; stopped: number; errors: string[] };
export function jevCost(dataDir: string): { cost_usd: number; input_tokens: number; requests: number; cached: number; receipts: number };
export function runDelegationSession(input: { out: string; plan: DPlan; cases: DCases; itemsByCase: Record<string, Item[]>; opts?: Record<string, any> }): Promise<{ id: string; skipped?: boolean; ground?: Ground }>;
export function runAllDelegation(input: { out: string; plans: DPlan[]; cases: DCases; itemsByCase: Record<string, Item[]>; capUsd: number; perSessionUsd?: number; opts?: Record<string, any>; log?: (line: string) => void }): Promise<{ ran: number; skipped: number; stopped: string | null; spent_usd: number }>;
export function readDelegationGrounds(out: string): Ground[];
export function analyzeDelegation(grounds: Ground[]): Record<string, any>;
export function sizeDelegationPilot(grounds: Ground[]): Record<string, any>;
