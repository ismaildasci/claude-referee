// Stop gate check detector, docs/decisions/stop-check-detector-tools.md: the added toolchain checks (rule 1) and the stored check text (rule 2), on invented commands shaped like real use.

import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeTranscript } from "../src/engine/stopgate/transcript.ts";
import type { StopFacts } from "../src/engine/stopgate/types.ts";

function turn(calls: { command: string; out?: string; error?: boolean }[], editFirst = true): StopFacts {
  const lines: unknown[] = [{ type: "user", message: { role: "user", content: "fix it" } }];
  if (editFirst) {
    lines.push({ type: "assistant", message: { content: [{ type: "tool_use", id: "e0", name: "Edit", input: { file_path: "/p/a.ts" } }] } });
    lines.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "e0", content: "ok" }] } });
  }
  calls.forEach((c, i) => {
    lines.push({ type: "assistant", message: { content: [{ type: "tool_use", id: `b${i}`, name: "Bash", input: { command: c.command } }] } });
    if (c.out !== undefined) lines.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: `b${i}`, content: c.out, is_error: c.error === true }] } });
  });
  return analyzeTranscript(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}
const counted = (command: string): boolean => turn([{ command }]).checks.length === 1;
const one = (command: string, out: string, error = false) => turn([{ command, out, error }]).checks[0];

const NODE_PASS = "✔ parses (0.4ms)\nℹ tests 3\nℹ suites 0\nℹ pass 3\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 41.2\n";
const NODE_FAIL = "✖ parses (0.4ms)\nℹ tests 3\nℹ pass 2\nℹ fail 1\n";
const PEST_PASS = "  PASS  Tests\\Feature\\InvoiceTest\n  ✓ it totals lines\n\n  Tests:    4 passed (9 assertions)\n  Duration: 0.31s\n";
const PHPUNIT_PASS = "> vendor/bin/phpunit\nPHPUnit 11.5.0 by Sebastian Bergmann and contributors.\n\n....                                                                4 / 4 (100%)\n\nOK (4 tests, 9 assertions)\n";

test("rule 1: the registered tools count as checks", () => {
  const cmds = [
    "node --test",
    "node --test test/",
    "node --experimental-strip-types --test test/money.test.ts",
    "node --test test/ > /tmp/node-test.log 2>&1",
    "php -l app/Models/Invoice.php",
    "php artisan test",
    "php artisan test --filter=InvoiceTest",
    "phpstan",
    "phpstan analyse",
    "vendor/bin/phpstan analyse src --level=8",
    "./vendor/bin/phpstan --memory-limit=1G analyse",
    "vendor/bin/phpstan 2>&1",
    "vendor/bin/phpstan > /tmp/phpstan.log 2>&1",
    "composer test",
    "composer test:unit",
    "composer lint",
    "composer analyse",
    "npx vue-tsc --noEmit",
    "vue-tsc -b",
    "npx prettier --check .",
    "prettier src --check",
    "vendor/bin/pint --test",
    "./vendor/bin/pint --test --dirty",
    "oxlint",
    "npx oxlint src",
    "npm run ci:local",
    "npm run ci",
    "npm run verify",
    "npm run verify:all",
    "pnpm run ci:local",
    "pnpm verify",
    "yarn ci:lint",
    "bun run verify",
  ];
  for (const c of cmds) assert.ok(counted(c), c);
});

test("rule 1: flags between run and the script name are skipped", () => {
  for (const c of ["npm run -s test", "npm run --silent lint", "pnpm run -s typecheck", "npm run -s ci:local", "npm run-script --silent verify"]) assert.ok(counted(c), c);
  for (const c of ["npm run -s dev", "npm run --silent start"]) assert.ok(!counted(c), c);
});

test("rule 1: look-alikes and other subcommands are not checks", () => {
  const cmds = [
    "node script.mjs",
    "node script.mjs --test",
    "node -e 'console.log(1)'",
    "node --test-reporter=dot probe.mjs",
    "node --test /tmp/probe.test.mjs",
    "node --test /private/tmp/s/probe.test.mjs",
    'node --test "$TMPDIR/probe.test.mjs"',
    "node --test --test-reporter=spec /private/var/folders/x/T/probe.test.mjs",
    "vendor/bin/phpstan --version",
    "phpstan -V",
    "vendor/bin/phpstan analyse --help",
    "npx vue-tsc --version",
    "vue-tsc -v",
    "oxlint --version",
    "npx oxlint -h",
    "php artisan migrate",
    "php artisan tinker",
    "php -r 'echo 1;'",
    "php script.php",
    "composer install",
    "composer require vendor/pkg",
    "composer dump-autoload",
    "composer ci",
    "composer verify",
    "vendor/bin/phpstan clear-result-cache",
    "npx prettier --write .",
    "prettier src",
    "vendor/bin/pint",
    "pint --dirty",
    "npm ci",
    "bun ci",
    "pnpm ci",
    "npm verify",
    "npm run civic",
    "npm run verifyx",
  ];
  for (const c of cmds) assert.ok(!counted(c), c);
});

test("rule 1: the same pass and fail reading as today; vue-tsc alone is silent", () => {
  assert.equal(one("node --test", NODE_PASS)?.status, "passed");
  assert.equal(one("node --test", "Exit code 1\n" + NODE_FAIL, true)?.status, "failed");
  assert.equal(one("php artisan test", PEST_PASS)?.status, "passed");
  assert.equal(one("composer test", PHPUNIT_PASS)?.status, "passed");
  assert.equal(one("npx vue-tsc --noEmit", "")?.status, "passed");
  assert.equal(one("npx vue-tsc --noEmit | tail -5", "")?.status, "unknown");
  assert.equal(one("vue-tsc --noEmit", "Exit code 2\nsrc/App.vue(3,7): error TS2322: Type 'string' is not assignable to type 'number'.", true)?.status, "failed");
  assert.equal(one("php -l app/Models/Invoice.php", "No syntax errors detected in app/Models/Invoice.php")?.status, "unknown");
  assert.equal(one("php -l app/Models/Invoice.php", "Exit code 255\nPHP Parse error:  syntax error, unexpected token \"}\" in app/Models/Invoice.php on line 12", true)?.status, "failed");
  assert.equal(one("npx prettier --check .", "Checking formatting...\nAll matched files use Prettier code style!")?.status, "unknown");
  assert.equal(one("npx prettier --check .", "Exit code 1\nChecking formatting...\n[warn] src/a.ts\n[warn] Code style issues found in the above file. Run Prettier with --write to fix.", true)?.status, "failed");
  assert.equal(one('vendor/bin/phpstan analyse; echo "exit code: $?"', " [OK] No errors\n\nexit code: 0")?.status, "passed");
  assert.equal(one("npm run ci:local", "all steps passed\n" + NODE_PASS)?.status, "passed");
});

test("rule 1: a newly counted check that passed after the last edit skips the stop", () => {
  const f = turn([{ command: "cd api && php artisan test", out: PEST_PASS }]);
  assert.equal(f.passedCheckAfterLastEdit, true);
  assert.deepEqual(f.checks, [{ cmd: "php artisan test", status: "passed" }]);
  assert.equal(turn([{ command: "node --test", out: NODE_PASS }], false).passedCheckAfterLastEdit, false);
});

test("rule 2: a leading cd segment is dropped; the matched segments are kept with their separators", () => {
  const cmd = (command: string) => one(command, "")?.cmd;
  assert.equal(cmd("cd /home/u/proj && npm test"), "npm test");
  assert.equal(cmd("cd /home/u/proj/web && npm run typecheck && npm test 2>&1 | tail -20"), "npm run typecheck && npm test 2>&1");
  assert.equal(cmd("cd app; composer test"), "composer test");
  assert.equal(cmd("npm test; npx tsc --noEmit"), "npm test; npx tsc --noEmit");
  assert.equal(cmd("npm run lint\nnpm test"), "npm run lint; npm test");
  assert.equal(cmd("(cd a && npm test) && (cd b && npm test)"), "npm test && npm test");
  assert.equal(cmd("cd x && CI=1 npm test -- --grep \"user login\" &>/tmp/log"), 'CI=1 npm test -- --grep "user login" &>/tmp/log');
  assert.equal(cmd("cd x && vendor/bin/phpstan analyse src || true"), "vendor/bin/phpstan analyse src");
  assert.equal(cmd("cd api && { composer test 2>&1; echo done; } | tail -40"), "composer test 2>&1");
  assert.equal(cmd("npm test&>log"), "npm test&>log");
  assert.equal(cmd("npm test 2>&1 &"), "npm test 2>&1");
});

test("rule 2: heredoc bodies are dropped, including check-like text inside them", () => {
  const command = "cat >> test/money.test.mjs <<'EOF'\nimport test from 'node:test';\n// npm test\ntest('adds', () => {});\nEOF\nnode --test test/money.test.mjs";
  const c = one(command, NODE_PASS);
  assert.equal(c?.cmd, "node --test test/money.test.mjs");
  assert.equal(c?.status, "passed");
  const scratch = turn([{ command: "cat > /tmp/money.test.mjs <<'EOF'\nimport test from 'node:test';\ntest('adds', () => {});\nEOF\nnode --test /tmp/money.test.mjs", out: NODE_PASS }]);
  assert.deepEqual(scratch.checks, []);
  assert.equal(scratch.passedCheckAfterLastEdit, false);
  const body = "cat <<'EOF' > /tmp/run.sh\nnpm test\nEOF\nnpx vitest run";
  assert.equal(one(body, "")?.cmd, "npx vitest run");
});

test("rule 2: each segment is clipped to 200 characters; several are joined", () => {
  const long = "npm test -- " + "y".repeat(500);
  assert.equal(one("cd " + "d".repeat(300) + " && " + long, "")?.cmd, long.slice(0, 200));
  const two = one(`${long} && ${long}`, "")?.cmd ?? "";
  assert.equal(two, `${long.slice(0, 200)} && ${long.slice(0, 200)}`);
  const many = Array.from({ length: 2000 }, (_, i) => `php -l app/Models/Model${i}.php`).join(" && ");
  const joined = one(many, "")?.cmd ?? "";
  assert.equal(joined.length, 1000);
  assert.ok(joined.startsWith("php -l app/Models/Model0.php && php -l app/Models/Model1.php"));
});
