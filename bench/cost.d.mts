// Type declarations for bench/cost.mjs so tests can import it under strict TypeScript.

export interface RawRequest { key: string; model: string; sidechain: boolean; input: number; output: number; cacheRead: number; cacheCreation: number; cache5m: number; cache1h: number; splitSeen: boolean; webSearch: number; geo?: string; fast: boolean; iterations: number; lines: number }
export interface Account { requests: number; lines: number; usd: number; tokens: Record<string, number>; usdBy: Record<string, number>; byModel: Record<string, { requests: number; usd: number }>; warnings: string[] }
export function collectRequests(transcript: string): { requests: RawRequest[]; lines: number; warnings: string[] };
export function resolveCacheWrites(r: RawRequest): { cache5m: number; cache1h: number; warning: string | null };
export function priceRequest(r: RawRequest): { usd: number; tokens: Record<string, number>; warnings: string[] };
export function accountTranscript(transcript: string): Account;
export function reconcile(account: Account, result: unknown): { transcript_usd: number; reported_usd: number | null; gap_usd: number | null; gap_ratio: number | null; reported_models: string[]; extra_models: string[] };
export function sessionCost(input: { account: Account | null; result: unknown; capUsd: number }): { usd: number; source: "transcript" | "result_json" | "cap_upper_bound" };
