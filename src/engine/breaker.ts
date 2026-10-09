// Circuit breaker for hooks that call Jev: three failures in a row in one session skip Jev for the rest of it.
// One file per session, <dataDir>/breaker/<hash of the session id>, holding "<failures> <ts>" and written by temp file + rename.
// A session's stops run one at a time, so no lock is needed and parallel sessions never overwrite each other's counts.
// Writes are best-effort; files of sessions idle for a day are pruned, unreadable ones are left alone, and the old breaker.json is removed.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ErrorCode } from "./errors.ts";

const LIMIT = 3;
const STALE_MS = 24 * 60 * 60 * 1000;

export const BREAKER_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>(["timeout", "service_unavailable", "rate_limited"]);

const breakerDir = (dataDir: string): string => join(dataDir, "breaker");
const sessionFile = (dataDir: string, sessionId: string): string => join(breakerDir(dataDir), createHash("sha256").update(sessionId).digest("hex").slice(0, 32));

function read(file: string): { failures: number; ts: number } | null {
  try {
    const [failures = Number.NaN, ts = Number.NaN] = readFileSync(file, "utf8").split(" ").map(Number);
    return Number.isInteger(failures) && failures > 0 && ts > 0 ? { failures, ts } : null;
  } catch {
    return null;
  }
}

// Windows refuses to replace a file another process has open (the stale scan of a parallel session reads every entry), so the replace is retried briefly.
function replace(tmp: string, file: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        rmSync(tmp, { force: true });
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10 * (attempt + 1));
    }
  }
}

export function breakerOpen(dataDir: string, sessionId: string): boolean {
  return (read(sessionFile(dataDir, sessionId))?.failures ?? 0) >= LIMIT;
}

export function recordBreaker(dataDir: string, sessionId: string, ok: boolean, now: number): void {
  try {
    const dir = breakerDir(dataDir);
    const own = sessionFile(dataDir, sessionId);
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
      const entry = read(join(dir, name));
      if (entry && now - entry.ts > STALE_MS) rmSync(join(dir, name), { force: true });
    }
    rmSync(join(dataDir, "breaker.json"), { force: true });
    if (ok) {
      rmSync(own, { force: true });
      return;
    }
    mkdirSync(dir, { recursive: true });
    const tmp = `${own}.${process.pid}.tmp`;
    writeFileSync(tmp, `${(read(own)?.failures ?? 0) + 1} ${now}`);
    replace(tmp, own);
  } catch {
    return;
  }
}
