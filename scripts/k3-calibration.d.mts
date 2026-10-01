import type { Decision } from "./order-analysis.mjs";
export const TABLE_LINE: RegExp;
export const NAMES: string[];
export const LEADER_MAX: number;
export const DEFAULTS: { seed: number; trials: number; nMin: number; nMax: number; sigmas: number[]; alphas: number[]; powerN: number; shifts: number[] };
export interface CellStats { conclusive: number; hist: number[]; leaderFailHist: number[] }
export interface Cell { sigma: number; alpha: number; byN: Map<number, CellStats> }
export interface Fingerprint { file: string; excludes: string; bytes: number; sha256: string }
export interface Calibration {
  seed: number;
  trials_per_cell: number;
  grid: { n: [number, number]; sigma: number[]; alpha: number[]; leader_max: number };
  analysis: Fingerprint;
  cutoffs: Record<string, number>;
  worst_case_breach_tail: Record<string, number>;
  worst_case_verdict_fail: Record<string, number>;
  worst_case_cell: Record<string, { sigma: number; alpha: number }>;
  min_conclusive: Record<string, number>;
  cells: { sigma: number; alpha: number; conclusive: Record<string, number>; breach_tail_at_cutoff: Record<string, number> }[];
}
export interface PowerRow { shift: number; alpha: number; sigma: number; trials: number; conclusive: number; inconclusive_rate: number; fail_given_conclusive: number | null; breach_fail_given_conclusive: number | null; leader_fail_given_conclusive: number | null; fail_over_all_trials: number }
export interface Power { seed: number; trials_per_cell: number; n: number; cutoff_used: number; analysis: Fingerprint; rows: PowerRow[] }
export function seededRandom(seed: number): { u: () => number; normal: () => number; gamma: (a: number) => number };
export function cellSeed(seed: number, ...parts: (string | number)[]): number;
export function simulateDecisions(R: { u: () => number; normal: () => number; gamma: (a: number) => number }, count: number, sigma: number, alpha: number, shift?: number): Decision[];
export function simulateCell(opts: { seed: number; sigma: number; alpha: number; trials: number; nMin: number; nMax: number; shift?: number }): Map<number, CellStats>;
export function tailRate(cell: CellStats, c: number): number;
export function verdictFailRate(cell: CellStats, c: number): number;
export function chooseCutoff(cells: Cell[], n: number): number;
export function fingerprint(file?: string): Fingerprint;
export function calibrate(opts: { seed: number; trials: number; nMin: number; nMax: number; sigmas: number[]; alphas: number[] }): Calibration;
export function emitLine(cutoffs: Record<string, number>): string;
export function emit(jsonFile: string, target?: string): string;
export function power(opts: { seed: number; trials: number; sigmas: number[]; alphas: number[]; shifts: number[]; n: number }): Power;
