// Type declarations for scripts/i18n-real/lib.mjs so tests can import it under strict TypeScript.

export interface Site { file: string; line: number; position: string; key: string; value: string }
export interface Skip { file: string; line: number; reason: string; key?: string }
export type Resolved = { value?: string; skip?: string };
export const LICENSES: Set<string>;
export const MIN_STARS: number;
export const PUSHED_SINCE: string;
export const MIN_SITES: number;
export const PER_ORIGIN: number;
export const SEED: string;
export function sha256(text: string): string;
export function metadataVerdict(m: unknown, minStars?: number): { pass: boolean; why: string };
export function localeNamespace(rel: string): string | null;
export function resolveKey(key: string, namespaces: { name: string; data: unknown }[], file?: { ns?: string; keyPrefix?: string }): Resolved;
export function fileNamespace(source: string): { ns?: string; keyPrefix?: string };
export function vueSections(lines: string[]): ("template" | "script" | "other")[];
export function stripScript(rel: string, source: string, framework: "react" | "vue", resolve: (key: string) => Resolved): { source: string; sites: Site[]; skips: Skip[] };
export function stripHtml(rel: string, source: string, resolve: (key: string) => Resolved): { source: string; sites: Site[]; skips: Skip[] };
export function normalizeForMatch(text: string): string;
export function matchFound(candidateText: string, value: string): boolean;
export function seededOrder(ids: string[], seed?: string): string[];
export const AMENDED_WINDOW: number;
export interface Cand { file: string; line: number; text: string; id: string }
export function amendedMatch(site: Site, candidates: Cand[], unchanged: Set<string>): Cand[] | null;
