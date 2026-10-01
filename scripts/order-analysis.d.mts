// Type declarations for scripts/order-analysis.mjs so tests can import it under strict TypeScript.

export type Probs = Record<string, number>;
export interface RawDecision { id: string; orders: { order: string[]; p: Probs }[]; reask: Probs; pair: { written: Probs; reversed: Probs } }
export interface Decision {
  id: string;
  leader_all24: string;
  p_leader_all24: number;
  max_spread: number;
  spread: Record<string, number>;
  distinct_argmax: number;
  orders_leader_differs: number;
  policy: Record<string, boolean>;
  leader_match: Record<string, boolean>;
  slot_residual: number[];
  reask_max_delta: number;
  k3_same_request_vs_separate: { reversed_max_delta: number; written_max_delta: number };
  margin_all24: number;
  tie: boolean;
  distance_max_abs: Record<string, number>;
  distance_leave_out: Record<string, number>;
  pair_leader_matches_written_reversed: boolean;
  exact: {
    max_spread: number;
    reask_max_delta: number;
    k3_reversed_max_delta: number;
    k3_written_max_delta: number;
    margin_all24: number;
    pair_margin: number;
    written_reversed_margin: number;
    distance_full: Record<string, number>;
    distance_leave_out: Record<string, number>;
  };
}
export interface K3 {
  verdict: "pass" | "fail" | "inconclusive (noise)" | "inconclusive (n outside the calibrated range)";
  basis: string;
  noisy: boolean;
  leader_condition: {
    status: "pass" | "fail" | "not assessable";
    decisive_decisions: number;
    min_decisive: number;
    decisive_margin: number;
    excluded_decisions: number;
    excluded: { id: string; reason: string }[];
    mismatches: number;
    mismatch_ids: string[];
    pass: boolean | null;
  };
  breach_condition: {
    threshold: number;
    reask_p95: number;
    noise_limit: number;
    decisions: number;
    breaches: number;
    breach_ids: string[];
    reversed_breaches: number;
    written_breaches: number;
    max_breaches_allowed: number | null;
    calibrated_range: [number, number];
    pass: boolean | null;
  };
  k3_pass: boolean | null;
}
export interface Candidate { id: string; decision: string; context: string; options: { name: string; text: string }[] }
export interface CloseCase extends Candidate { derived_from?: string }
export interface ScreenReport { candidates: { id: string | null; outcome: string; p1?: { p_leader: number }; p2?: { p_leader: number } }[] }
export interface Subsets { rules: Record<string, string>; full: string[]; S1: string[]; S2: string[] }
export type Status = "pending" | "refused" | "duplicate";
export type Meta = { requests: number | null; retries_429: number | null; input_tokens: number | null; cost_usd: number | null };

export const EPS: number;
export const TIE_MARGIN: number;
export const SCREEN_LEADER_MAX: number;
export const SCREEN_STRICT_MAX: number;
export const K3_MIN_DELTA: number;
export const K3_NOISE_LIMIT: number;
export const K3_ALPHA: number;
export const K3_CAL_MIN_N: number;
export const K3_CAL_MAX_N: number;
export const VERDICT_RANGE: string;
export const K3_CUTOFFS: Record<string, number>;
export const K3_DECISIVE_MARGIN: number;
export const K3_DECISIVE_NOISE_MULT: number;
export const K3_MIN_DECISIVE: number;
export const POLICY_MIN_GAIN: number;
export const POLICY_MIN_WIN_SHARE: number;
export const REGISTERED_CASES: string;
export const LEGACY_POLICIES: string[];
export const POLICIES: string[];
export const SCREEN_ORDERS: Record<string, number[]>;
export const INPUT_USD_PER_MILLION: number;
export const OPTION_NAME: RegExp;
export const WORDING: { helped: string; averaging: string; none: string };
export function round(x: number): number;
export function clean(x: number): number;
export function ge(x: number, y: number): boolean;
export function le(x: number, y: number): boolean;
export function lt(x: number, y: number): boolean;
export function isRegistered(run: { tieMargin: number; input: string | null | undefined; limitUsed: boolean }): boolean;
export function argmax(p: Probs): string;
export function mean(ps: Probs[], names: string[]): Probs;
export function costUsd(inputTokens: number): number;
export function permutations<T>(items: T[]): T[][];
export function average(xs: number[]): number;
export function median(xs: number[]): number;
export function percentileNearestRank(xs: number[], p: number): number;
export function topMargin(vector: Probs): number;
export function isTied(margin: number, tieMargin?: number): boolean;
export function maxAbsDistance(a: Probs, b: Probs, names: string[]): number;
export function analyzeDecision(id: string, names: string[], r: RawDecision, tieMargin?: number): Decision;
export function breachCutoff(n: number): number | null;
export function evaluateK3(perDecision: Decision[]): K3;
export function summarize(perDecision: Decision[], meta: Meta, tieMargin?: number, registeredRun?: boolean): Record<string, any>;
export function validateSubsets(subsets: Record<string, unknown>, ids: string[]): void;
export function subsetSummaries(perDecision: Decision[], subsets: Record<string, unknown>, tieMargin?: number, registeredRun?: boolean): Record<string, Record<string, any>>;
export function sideBySide(sets: Record<string, Record<string, any>>): string[];
export function buildSubsets(cases: CloseCase[], reports: ScreenReport[]): Subsets;
export function sourceClusters(cases: CloseCase[]): { cases: number; multi_case_sources: number; cases_in_multi_case_sources: number; sources: { source: string; cases: number }[] };
export function validateCandidate(c: unknown): string | null;
export function screenOrder<T>(options: T[], key: string): T[];
export function leaderOf(p: Probs): { leader: string; p: number };
export function screenKeep(p1: Probs, p2: Probs, leaderMax?: number): boolean;
export function preflight(cands: unknown[], existingIds: Iterable<string>): { status: Status; reason?: string }[];
export function selectKept(entries: { status: Status; keep: boolean | null }[], existingCount: number, max: number): string[];
