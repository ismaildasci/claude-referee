// Type declarations for bench/pricing.mjs so tests can import it under strict TypeScript.

export interface Price { input: number; cacheWrite5m: number; cacheWrite1h: number; cacheRead: number; output: number }
export const PRICING_SOURCE: { url: string; fetched: string };
export const PRICES: Record<string, Price>;
export class UnknownModelError extends Error { model: string }
export function priceFor(model: string): Price & { key: string };
