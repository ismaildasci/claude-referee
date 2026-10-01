// Shared types of the Stop done-gate (shadow mode): facts read from a transcript, Jev's decision and the stored stop record.

export type CheckStatus = "passed" | "failed" | "unknown";

export interface CheckRun {
  readonly cmd: string;
  readonly status: CheckStatus;
}

export interface StopFacts {
  readonly task: string;
  readonly finalMessage: string;
  readonly edits: readonly string[];
  readonly checks: readonly CheckRun[];
  readonly passedCheckAfterLastEdit: boolean;
}

export interface StopDecision {
  readonly claims_done: number;
  readonly claims_verified: number;
  readonly verification_applies: number;
  readonly outcome: Readonly<Record<string, number>>;
  readonly would_block: boolean;
}

export type StopSkip = "stop_hook_active" | "background_tasks" | "hooks_off" | "project_off" | "no_edits" | "check_passed_after_edit" | "breaker_open" | "no_transcript" | "jev_error";

export interface StopRecord {
  readonly id: string;
  readonly ts: string;
  readonly session_id: string;
  readonly project: string;
  readonly mode: "shadow";
  readonly skipped?: StopSkip;
  readonly edits: number;
  readonly checks: number;
  readonly decision?: StopDecision;
  readonly ms: number;
  readonly task_excerpt?: string;
  readonly final_excerpt?: string;
  readonly label?: "right" | "wrong";
  readonly labelled_at?: string;
}
