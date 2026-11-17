// Type declarations for scripts/first-call.mjs so tests can import it under strict TypeScript.

export type Form = "piped" | "run_scoped" | "run_own" | "run_default";
export interface DoneCall { ts: string; form: Form; verdict: "met" | "unsure" | "missing"; exitOnly: boolean }
export function formOf(command: string): Form;
export function doneCalls(text: string): DoneCall[];
export function tally(transcripts: readonly string[], since?: string): {
  calls: number;
  first_calls: number;
  retries_before_a_met: number;
  forms: Partial<Record<Form, { first_calls: number; first_met: number; first_refused_exit_only: number }>>;
};
