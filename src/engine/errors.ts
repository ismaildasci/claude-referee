// Typed errors with stable codes. Messages never carry key material or request text.

export type ErrorCode =
  | "bad_input"
  | "no_api_key"
  | "invalid_api_key"
  | "auth_failed"
  | "rate_limited"
  | "timeout"
  | "service_unavailable"
  | "bad_request"
  | "credential_in_state"
  | "pack_not_found"
  | "bad_pack"
  | "bad_project"
  | "too_large"
  | "breaker_open"
  | "internal";

export interface ErrorDetails {
  readonly next_step?: string;
  readonly retry_after_ms?: number;
  readonly status?: number;
}

export class RefereeError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = "RefereeError";
    this.code = code;
    this.details = details;
  }
}

export function isRefereeError(value: unknown): value is RefereeError {
  return value instanceof RefereeError;
}
