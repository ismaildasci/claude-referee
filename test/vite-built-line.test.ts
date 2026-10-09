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

test("the built line alone, chunk lines alone and other tools' wording are not read as a Vite build", () => {
  assert.equal(parseEvidence(`${BUILT}exit code: 0\n`).trust, "exit_code");
  assert.equal(parseEvidence(`${CHUNKS}exit code: 0\n`).trust, "exit_code");
  assert.equal(parseEvidence("Site built in 3.32s\ndist/index.html 0.45 kB\nexit code: 0\n").trust, "exit_code");
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
