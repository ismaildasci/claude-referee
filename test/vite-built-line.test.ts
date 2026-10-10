// Vite build logs without the banner (docs/decisions/vite-built-line.md): read as a Vite build only with both the built line and a Vite output line.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEvidence } from "../src/engine/runners/index.ts";

const CHUNKS = "dist/index.html                   0.45 kB │ gzip:   0.30 kB\ndist/assets/index-DnnDqSNN.js    432.28 kB │ gzip: 117.70 kB\n";
const BUILT = "✓ built in 3.32s\n";

test("a banner-less log with chunk lines and the built line is a clean Vite build", () => {
  const p = parseEvidence(`${CHUNKS}${BUILT}exit code: 0\n`);
  assert.equal(p.trust, "parsed");
  assert.deepEqual(p.runners.map((r) => [r.runner, r.errors, r.build_only, r.summary_line]), [["vite", 0, true, "✓ built in 3.32s"]]);
});

test("the built line alone is a Vite build too; chunk lines alone and other tools' wording are not", () => {
  const alone = parseEvidence(`${BUILT}exit code: 0\n`);
  assert.equal(alone.trust, "parsed");
  assert.deepEqual(alone.runners.map((r) => [r.runner, r.errors, r.warnings, r.build_only]), [["vite", 0, 0, true]]);
  assert.equal(parseEvidence(`${CHUNKS}exit code: 0\n`).trust, "exit_code");
  assert.equal(parseEvidence("Site built in 3.32s\ndist/index.html 0.45 kB\nexit code: 0\n").trust, "exit_code");
  assert.equal(parseEvidence("✔ Client built in 3.32s\nexit code: 0\n").trust, "exit_code");
  assert.equal(parseEvidence("✓ Completed in 3.32s.\nexit code: 0\n").trust, "exit_code");
});

test("the plugin-timings shape without a table: a clean Vite build with one warning, and a failed second build is not clean", () => {
  const timings = "[PLUGIN_TIMINGS] Warning: Your build spent significant time in plugins. Here is a breakdown:\n  - plugin-a (83%)\n  - plugin-b (13%)\nSee https://example.test/options/checks#plugintimings for more details.\n\n";
  const p = parseEvidence(`${timings}${BUILT}exit code: 0\n`);
  assert.equal(p.trust, "parsed");
  assert.deepEqual(p.runners.map((r) => [r.runner, r.errors, r.warnings, r.summary_line]), [["vite", 0, 1, "✓ built in 3.32s"]]);
  const failed = parseEvidence(`${BUILT}error during build:\nexit code: 1\n`);
  assert.equal(failed.runners[0]?.errors, 1);
  assert.equal(failed.exit_code, 1);
});

test("a banner-less log with a build error counts the error and a non-zero exit stays missing material", () => {
  const p = parseEvidence(`${CHUNKS}${BUILT}error during build:\nexit code: 1\n`);
  assert.equal(p.runners[0]?.errors, 1);
  assert.equal(p.exit_code, 1);
});

test("a log with the banner reads as before", () => {
  const p = parseEvidence(`vite v5.4.2 building for production...\n${CHUNKS}${BUILT}exit code: 0\n`);
  assert.deepEqual(p.runners.map((r) => [r.runner, r.errors, r.summary_line]), [["vite", 0, "✓ built in 3.32s"]]);
});
