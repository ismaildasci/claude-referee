// Type declarations for scripts/decide-scale/lib.mjs so tests can import it under strict TypeScript.

export interface ScaleCase {
  id: string;
  src: string;
  wave2: boolean;
  raw: { id: string; decision: string; context: string; options: { name: string; text: string }[] };
  authored: string[];
  written: string[];
  options: Record<string, string>;
}
export interface OrderPlan { n: number; screen: string[][]; pool: string[][]; extra: string[][]; fixed: string[][]; poolKind: "all" | "random" }
export const ROOT: string;
export const SOURCES: readonly { src: string; file: string; shuffle: boolean }[];
export const WAVE2: readonly { src: string; file: string; shuffle: boolean; wave2: boolean }[];
export const RANDOM_POOL: number;
export function sha256(text: string): string;
export function seedOf(text: string): number;
export function mulberry32(seed: number): () => number;
export function shuffled<T>(items: readonly T[], rng: () => number): T[];
export function permutations<T>(items: readonly T[]): T[][];
export function key(order: readonly string[]): string;
export function rotate<T>(order: readonly T[], i: number): T[];
export function designs(written: readonly string[]): { rot: string[][]; revrot: string[][]; rev: string[]; fixed: string[][] };
export function validateCase(c: unknown): string | null;
export function loadCases(sources?: typeof SOURCES): ScaleCase[];
export function orderPlan(c: ScaleCase): OrderPlan;
export function neutralNames(c: ScaleCase): Record<string, string>;
