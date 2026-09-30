// Maps SDK and network failures to stable error codes: error name first, then HTTP status, then message.
// Messages are fixed per code, so a response body never reaches Claude's context.

import { RefereeError, type ErrorCode } from "./errors.ts";

const BY_NAME: Readonly<Record<string, ErrorCode>> = {
  APITimeoutError: "timeout",
  APIConnectionError: "service_unavailable",
  RateLimitError: "rate_limited",
  AuthenticationError: "auth_failed",
  PermissionDeniedError: "auth_failed",
  BadRequestError: "bad_request",
  UnprocessableEntityError: "bad_request",
  NotFoundError: "bad_request",
  InternalServerError: "service_unavailable",
  APIUserAbortError: "timeout",
  AbortError: "timeout",
};

const MESSAGES: Readonly<Partial<Record<ErrorCode, readonly [string, string]>>> = {
  timeout: ["Jev did not answer in time.", "Try again later; the verdict is unknown, not negative."],
  service_unavailable: ["The TypeSafe API could not be reached.", "Check the network, then try again later."],
  rate_limited: ["The TypeSafe rate limit was hit.", "Wait and try again, or send fewer requests at once."],
  auth_failed: ["TypeSafe rejected the API key.", "Check the key's source with the doctor command and store a valid key."],
  bad_request: ["TypeSafe rejected the request.", "Run the same command with --dry-run to inspect what would be sent."],
  internal: ["Unexpected error while calling Jev.", "Run the doctor command and retry once."],
};

function byStatus(status: number): ErrorCode | undefined {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if (status === 408) return "timeout";
  if (status === 400 || status === 404 || status === 422) return "bad_request";
  if (status >= 500) return "service_unavailable";
  return undefined;
}

function byMessage(message: string): ErrorCode | undefined {
  if (/timed? ?out|timeout/i.test(message)) return "timeout";
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|socket|network/i.test(message)) return "service_unavailable";
  return undefined;
}

export function classify(error: unknown, context: { model?: string } = {}): RefereeError {
  if (error instanceof RefereeError) return error;
  const e = (typeof error === "object" && error !== null ? error : {}) as { name?: unknown; status?: unknown; message?: unknown; retryAfterMs?: unknown };
  const status = typeof e.status === "number" ? e.status : undefined;
  const code: ErrorCode =
    (typeof e.name === "string" ? BY_NAME[e.name] : undefined) ??
    (status !== undefined ? byStatus(status) : undefined) ??
    byMessage(typeof e.message === "string" ? e.message : String(error)) ??
    "internal";
  const [message, generic] = MESSAGES[code] ?? MESSAGES.internal ?? ["Unexpected error.", ""];
  const raw = typeof e.message === "string" ? e.message : "";
  const next =
    code === "bad_request" && context.model && /\bunknown model\b/i.test(raw)
      ? `TypeSafe doesn't know the model "${context.model.slice(0, 80)}". Run doctor --online to list the models your key can use.`
      : generic;
  return new RefereeError(code, message, {
    next_step: next,
    ...(status !== undefined ? { status } : {}),
    ...(code === "rate_limited" && typeof e.retryAfterMs === "number" ? { retry_after_ms: e.retryAfterMs } : {}),
  });
}
