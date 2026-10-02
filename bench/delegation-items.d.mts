// Type declarations for bench/delegation-items.mjs so tests can import it under strict TypeScript.

export const TRACKED_RULE: Record<string, RegExp>;
export function isTracked(text: string): boolean;
export function sha256(value: string | Buffer): string;
export function fetchRepo(input: { cacheDir: string; repo: string; sha: string }): string;
export function extractItems(repoDir: string, spec: { pathPattern: string; tracked: number; untracked: number; seed: string }): { id: string; where: string; text: string; label: boolean }[];
export function itemsHash(items: { id: string; text: string; label: boolean }[]): string;
export function armItemsJsonl(items: { id: string; text: string }[]): string;
