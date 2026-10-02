// Type declarations for bench/report.mjs so tests can import it under strict TypeScript.

export function isUsable(g: Record<string, any>): boolean;
export function isCorrect(g: Record<string, any>): boolean;
export function outcomeOne(grounds: Record<string, any>[], arms?: string[]): Record<string, any>;
export function costPerCorrect(grounds: Record<string, any>[], arms?: string[]): Record<string, any>;
export function refereeWarned(grounds: Record<string, any>[]): Record<string, any>;
export function analyze(grounds: Record<string, any>[]): Record<string, any>;
