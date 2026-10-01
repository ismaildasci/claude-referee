// Type declarations for scripts/docs-watch.mjs so tests can import it under strict TypeScript.

export const PAGES: string[];
export function sha256(text: string): string;
export function facts(page: string, text: string): Record<string, unknown>;
export function compare(
  recorded: Record<string, { sha256: string; facts: unknown } | undefined>,
  current: Record<string, { sha256: string; facts: unknown } | undefined>,
): { page: string; was: unknown; now: unknown }[];
