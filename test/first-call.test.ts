// scripts/first-call.mjs: the registered measurement of docs/decisions/done-run-scoped.md. Transcripts below are invented.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneCalls, formOf, tally } from "../scripts/first-call.mjs";

const use = (id: string, command: string, ts: string) => JSON.stringify({ timestamp: ts, message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
const result = (id: string, out: string) => JSON.stringify({ message: { content: [{ type: "tool_result", tool_use_id: id, content: out }] } });
const verdict = (v: string, trust = "parsed") => `{"ok":true,"verdict":"${v}","trust":"${trust}"}`;

test("formOf: piped, the three --run forms", () => {
  assert.equal(formOf('npm test 2>&1 | claude-referee done --criteria "all tests pass" --evidence -'), "piped");
  assert.equal(formOf("claude-referee done --run test"), "run_default");
  assert.equal(formOf('claude-referee done --run test --criteria "npm run test exits with code 0"'), "run_own");
  assert.equal(formOf('claude-referee done --run "eslint src/a.js" --criteria "eslint finds no problems in src/a.js"'), "run_scoped");
  assert.equal(formOf('node "/p/dist/cli.mjs" done --run "vitest run src/a.test.js"'), "run_scoped");
});

test("tally: first calls by form, exit-only first refusals and retries before a met; calls without a verdict and dry runs are left out", () => {
  const transcript = [
    use("1", 'eslint src 2>&1; echo "exit code: $?" | claude-referee done --criteria "lint is clean"', "2026-11-18T10:00:00Z"),
    result("1", verdict("missing", "exit_code")),
    use("2", 'claude-referee done --run "eslint src/a.js"', "2026-11-18T10:01:00Z"),
    result("2", verdict("met")),
    use("3", "claude-referee done --run test", "2026-11-18T10:02:00Z"),
    result("3", verdict("unsure")),
    use("4", "claude-referee done --run test --dry-run", "2026-11-18T10:03:00Z"),
    result("4", verdict("met")),
    use("5", "claude-referee done --run nothing", "2026-11-18T10:04:00Z"),
    result("5", '{"ok":false,"error":"bad_input"}'),
    use("6", 'claude-referee done --run test --criteria "npm run test exits with code 0"', "2026-11-18T10:05:00Z"),
    result("6", verdict("met")),
    "not json",
    use("7", "ls", "2026-11-18T10:06:00Z"),
  ].join("\n");
  assert.deepEqual(doneCalls(transcript).map((c) => [c.form, c.verdict, c.exitOnly]), [["piped", "missing", true], ["run_scoped", "met", false], ["run_default", "unsure", false], ["run_own", "met", false]]);
  assert.deepEqual(tally([transcript]), {
    calls: 4,
    first_calls: 2,
    retries_before_a_met: 2,
    forms: { piped: { first_calls: 1, first_met: 0, first_refused_exit_only: 1 }, run_scoped: { first_calls: 0, first_met: 0, first_refused_exit_only: 0 }, run_default: { first_calls: 1, first_met: 0, first_refused_exit_only: 0 }, run_own: { first_calls: 0, first_met: 0, first_refused_exit_only: 0 } },
  });
  assert.equal(tally([transcript], "2026-11-18T10:01:30Z").calls, 2);
});
