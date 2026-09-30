// Redaction fixtures: each stop pattern, near misses, known false-positive classes and replacements.

import assert from "node:assert/strict";
import { test } from "node:test";
import { redact, stopError } from "../src/engine/redact.ts";
import { FAKE } from "./helpers.ts";

const STOPS: ReadonlyArray<readonly [string, string]> = [
  ["private_key", "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA"],
  ["private_key", "-----BEGIN OPENSSH PRIVATE KEY-----"],
  ["aws_access_key", `aws_access_key_id ${FAKE.aws}`],
  ["github_token", `token ${FAKE.github}`],
  ["github_token", `github_pat_${"11ABCDEFG0".repeat(3)}`],
  ["slack_token", "xoxb-1234567890-abcdefghijkl"],
  ["anthropic_key", FAKE.anthropic],
  ["openai_key", `sk-proj-${"Zy9-".repeat(8)}`],
  ["typesafe_key", `apikey_${"0a1b2c3d4e".repeat(2)}_${"f9e8d7c6b5".repeat(2)}`],
  ["jwt", FAKE.jwt],
  ["url_credentials", "DATABASE_URL=postgres://admin:hunter2@db.internal:5432/app"],
  ["secret_assignment", "API_KEY=9f8e7d6c5b4a3f2e1d0c"],
  ["secret_assignment", 'db_password: "Hunter2Hunter2!"'],
];

const NEAR_MISSES = ["AKIA123", "sk-short", "https://example.com/path", "git clone git@github.com:owner/repo.git", "xoxb-12"];

const KEEP = [
  "accountId: string",
  "apiKey: string;",
  "password: auth.password.label1.text",
  "nextPageToken: CiAKGjBpNDd2Nmp2Zml2cXRwYjBpOXA5X2QxMhIDZm9v",
  "HostKeyAlgorithms=ssh-ed25519,rsa-sha2-512",
  "password: changeme12345",
  "tokenType: Bearer",
  "export const TOKEN_TTL_SECONDS = 3600",
  "SECRET_KEY_BASE=${SECRET_KEY_BASE}",
  "keyId: 3f2a9c1e-77b1-4d2e-9a3b-1c2d3e4f5a6b",
  "const passwordHint = 'At least 12 characters'",
  "The signing key rotates weekly.",
];

test("redact stops every credential pattern", () => {
  for (const [kind, text] of STOPS) {
    const result = redact({ evidence: text });
    assert.ok(
      result.stopped.some((s) => s.kind === kind && s.field === "evidence"),
      `${kind} not stopped: ${JSON.stringify(result.stopped)}`,
    );
  }
});

test("redact lets near misses and known false-positive classes through", () => {
  for (const text of [...NEAR_MISSES, ...KEEP]) {
    assert.deepEqual(redact({ evidence: text }).stopped, [], `stopped: ${text}`);
  }
});

test("redact replaces emails, IP addresses and the home directory", () => {
  const { value, replaced } = redact(
    { log: "mail ops@acme.io from 10.0.0.12:8080; see /Users/alice/app/x.ts" },
    { home: "/Users/alice" },
  );
  assert.equal(value.log, "mail [REDACTED:email] from [REDACTED:ip]:8080; see ~/app/x.ts");
  assert.deepEqual(replaced, { home: 1, email: 1, ip: 1 });
});

test("redact keeps four-part version strings", () => {
  for (const text of ["version 1.2.3.4", "v10.0.0.1", "build 1.2.3.4-beta", "chrome/120.0.6099.109", "1.2.3.4.5"]) {
    assert.equal(redact({ t: text }).value.t, text, text);
  }
});

test("redact applies pack patterns but keeps the built-in ones", () => {
  const extra = { replace: [{ kind: "uuid", pattern: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b", flags: "i" }] };
  const { value } = redact({ t: "row 3f2a9c1e-77b1-4d2e-9a3b-1c2d3e4f5a6b by ops@acme.io" }, { extra });
  assert.equal(value.t, "row [REDACTED:uuid] by [REDACTED:email]");
});

test("redact reports nested field paths and checks object keys", () => {
  const { stopped } = redact({ state: { files: ["ok", FAKE.aws] }, questions: { [FAKE.aws]: 1 } });
  assert.deepEqual(stopped, [
    { kind: "aws_access_key", field: "state.files[1]" },
    { kind: "aws_access_key", field: "questions.<key>" },
  ]);
});

test("redact error names kind and field, never the value", () => {
  const secret = "9f8e7d6c5b4a3f2e1d0c";
  const error = stopError(redact({ evidence: `API_KEY=${secret}` }).stopped);
  assert.equal(error.code, "credential_in_state");
  assert.match(error.message, /secret_assignment in evidence/);
  for (let i = 0; i + 6 <= secret.length; i++) assert.ok(!error.message.includes(secret.slice(i, i + 6)));
});

test("redact clips very long fields and stays fast", () => {
  const line = "PASS src/app.test.ts (12 ms) user 42 at 10.1.2.3 v1.2.3.4 ok\n";
  const big = line.repeat(1000);
  const started = performance.now();
  const { value } = redact({ evidence: big }, { maxField: 40_000 });
  const ms = performance.now() - started;
  assert.ok(value.evidence.endsWith(`[TRUNCATED:${big.length - 40_000}]`));
  assert.ok(ms <= 20, `took ${ms.toFixed(1)} ms`);
});
