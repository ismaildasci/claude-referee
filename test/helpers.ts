// Test helpers: an in-memory Io and temporary directories.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Io } from "../src/cli/types.ts";

export interface MemoryIo extends Io {
  readonly out: string[];
  readonly err: string[];
  json(): Record<string, unknown>;
}

export function tempDir(prefix = "referee-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function memoryIo(options: { env?: Record<string, string | undefined>; cwd?: string; home?: string; stdin?: string; platform?: NodeJS.Platform } = {}): MemoryIo {
  const out: string[] = [];
  const err: string[] = [];
  const home = options.home ?? tempDir("referee-home-");
  return {
    env: { HOME: home, ...options.env },
    cwd: options.cwd ?? home,
    home,
    platform: options.platform ?? "linux",
    readStdin: async () => options.stdin ?? "",
    write: (text) => void out.push(text),
    warn: (text) => void err.push(text),
    now: () => Date.parse("2026-09-30T12:00:00Z"),
    out,
    err,
    json: () => JSON.parse(out.join("").trim()) as Record<string, unknown>,
  };
}
