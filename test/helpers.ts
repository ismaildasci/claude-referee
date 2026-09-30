// Test helpers: an in-memory Io, temporary directories and credential-shaped fixtures built at run time.
// Fake secrets are assembled from parts so the repository never holds a literal that scanners flag.

import { mkdtempSync, writeFileSync } from "node:fs";
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

export const FAKE = {
  aws: ["AKIA", "IOSFODNN7", "EXAMPLE"].join(""),
  github: ["gh", "p_", "a1B2c3D4e5".repeat(4)].join(""),
  anthropic: ["sk-", "ant-", "api03-", "Ab1_".repeat(8)].join(""),
  jwt: ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"].join("."),
  pemRsa: ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ") + "\nMIIEowIBAAKCAQEA",
  pemSsh: ["-----BEGIN OPENSSH", "PRIVATE KEY-----"].join(" "),
};

export function secretsFile(): string {
  const path = join(tempDir(), "with-secrets.txt");
  writeFileSync(path, `PASS src/app.test.ts\ndeploying with ${FAKE.aws}\ntoken ${FAKE.github}\nkey ${FAKE.anthropic}\n`);
  return path;
}
