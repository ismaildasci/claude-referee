// Type declarations for scripts/done-bar/lib.mjs so tests can import it under strict TypeScript.

export type EvidenceClass = "R" | "E" | "U";
export interface BarRow { cls: EvidenceClass; expected: string; code_decided: boolean; status: string; verdict: string | null; cluster: string }
export interface Cluster<T extends BarRow = BarRow> { cluster: string; cls: EvidenceClass; expected: string; members: T[] }
export interface Ratio { k: number; n: number; p: number | null; lo: number | null; hi: number | null }
export interface ClassScore {
  cases: number;
  code_decided: number;
  unusable: number;
  sent_cases: number;
  clusters: number;
  expected_met: number;
  expected_missing: number;
  wrong_met: { k: number; n: number; upper95_one_sided: number | null };
  missing_recall: Ratio;
  met_recall: Ratio;
}
export type ByClass = Record<"all" | EvidenceClass, ClassScore>;
export const SEED: string;
export const CLASSES: readonly EvidenceClass[];
export const R_RECALL_MIN_N: number;
export function classOfTrust(trust: string): EvidenceClass;
export function clusterKey(evidence: string, expected: string): string;
export function clusters<T extends BarRow>(rows: readonly T[]): Cluster<T>[];
export function scoreClass(rows: readonly BarRow[]): ClassScore;
export function scoreByClass(rows: readonly BarRow[]): ByClass;
export function verdictOfBar(score: ByClass): {
  wrong_met_zero_each_class: boolean;
  wrong_met_by_class: Record<string, number>;
  missing_recall_ok: boolean | null;
  r_met_recall: { evaluable: boolean; n: number; ok?: boolean };
  e_met_recall: { reported: number | null; n: number; bar: null };
  u_coverage: { clusters: number; share_of_sent_clusters: number | null; expected_met: number; met_never_given_by_design: boolean };
};
export function splitRepos(repos: readonly { repo: string; language: string }[], seed?: string): Map<string, "dev" | "holdout">;
export function holdoutHash(ids: readonly string[]): string;
export function backlogOf(rows: readonly { tool: string; purpose: string; repo: string; expected: string; parsed: boolean }[]): { tool: string; purpose: string; cases: number; expected_met: number; repos: number }[];
export function wrongMetExcludingU(score: ByClass): { k: number; n: number; upper95_one_sided: number | null };
