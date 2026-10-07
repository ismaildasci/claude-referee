// Type declarations for scripts/real-ci/lib.mjs so tests can import it under strict TypeScript.

export interface Segment { lines: string[]; script: string; uses: boolean; exits: number[] }
export type Classified = { purpose: "test" | "lint" | "build"; tool: string } | { excluded: "none" | "multi-purpose" };
export function sha256(text: string): string;
export function stripTransport(raw: string): string[];
export function splitSegments(lines: string[]): Segment[];
export function classify(stepName: string, script: string): Classified;
export function criterionOf(purpose: string): string | undefined;
export function buildEvidence(segment: Segment): { text: string; exit: number };
export function silentOutput(text: string): boolean;
export function negativeKind(why: string): "ran_not_clean" | "not_run";
export function refineTool(tool: string, text: string): string;
export function wrapperTool(text: string, tool: string): string;
export function clopperPearson(k: number, n: number, alpha?: number): { lo: number | null; hi: number | null };
export function upperOneSided(k: number, n: number, alpha?: number): number | null;
export function kappa(pairs: [string, string][]): number | null;
export interface FetchPass { at: string; mode?: string; calls?: number; langs?: Record<string, { excluded_candidates?: number; repos_without_cases?: number }> }
export function passTotals(passes: FetchPass[]): { passes: number; calls: number; excluded_candidates: number; repos_without_cases: number };
