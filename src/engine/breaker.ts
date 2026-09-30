// Circuit breaker for hooks that call Jev: three failures in a row in one session skip Jev for the rest of it.
// State lives in <dataDir>/breaker.json keyed by session id; writes are best-effort and day-old sessions are pruned.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ErrorCode } from "./errors.ts";

const LIMIT = 3;
const STALE_MS = 24 * 60 * 60 * 1000;

export const BREAKER_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>(["timeout", "service_unavailable", "rate_limited"]);

interface State {
  sessions: Record<string, { failures: number; ts: number }>;
}

function read(dataDir: string): State {
  try {
    const state = JSON.parse(readFileSync(join(dataDir, "breaker.json"), "utf8")) as State;
    return state && typeof state.sessions === "object" && state.sessions !== null ? state : { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}

export function breakerOpen(dataDir: string, sessionId: string): boolean {
  return (read(dataDir).sessions[sessionId]?.failures ?? 0) >= LIMIT;
}

export function recordBreaker(dataDir: string, sessionId: string, ok: boolean, now: number): void {
  const state = read(dataDir);
  for (const [id, entry] of Object.entries(state.sessions)) if (now - entry.ts > STALE_MS) delete state.sessions[id];
  if (ok) delete state.sessions[sessionId];
  else state.sessions[sessionId] = { failures: (state.sessions[sessionId]?.failures ?? 0) + 1, ts: now };
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "breaker.json"), JSON.stringify(state));
  } catch {
    return;
  }
}
