// Type declarations for bench/classify.mjs so tests can import it under strict TypeScript.

export type Claim = "claim" | "no_claim" | "ambiguous";
export function classifyClaim(text: string): Claim;
export function sessionClass(input: { claim: Claim; verifier: "pass" | "fail" | "error"; leaked?: boolean; runFailed?: boolean }): string;
export const EXCLUDED: string[];
