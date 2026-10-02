// Real-log study helpers: transport stripping, step segments, classifier, evidence text, exact intervals. No network.

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEvidence, classify, clopperPearson, kappa, splitSegments, stripTransport, upperOneSided } from "../scripts/real-ci/lib.mjs";

const LOG = [
  "2026-09-14T01:24:01.2027120Z Current runner version: '2.337.0'",
  "2026-09-14T01:24:02.1029919Z ##[group]Run actions/checkout@v4",
  "2026-09-14T01:24:02.1030669Z with:",
  "2026-09-14T01:24:02.1031099Z ##[endgroup]",
  "2026-09-14T01:24:03.0000000Z ##[group]Run npm test",
  "2026-09-14T01:24:03.0000001Z shell: /usr/bin/bash -e {0}",
  "2026-09-14T01:24:03.0000002Z ##[endgroup]",
  "2026-09-14T01:24:04.0000000Z > pkg@1.0.0 test",
  "2026-09-14T01:24:04.0000001Z > vitest run",
  "2026-09-14T01:24:05.0000000Z  Tests  4 failed | 9 passed",
  "2026-09-14T01:24:05.0000001Z ##[error]Process completed with exit code 1.",
  "2026-09-14T01:24:06.0000000Z Post job cleanup.",
  "2026-09-14T01:24:06.0000001Z [command]/usr/bin/git version",
].join("\n");

test("transport prefix and BOM are removed, group markers split steps", () => {
  const lines = stripTransport(`﻿${LOG}`);
  assert.equal(lines[0], "Current runner version: '2.337.0'");
  const segments = splitSegments(lines);
  assert.equal(segments.length, 2);
  assert.equal(segments[0]?.uses, true);
  assert.equal(segments[1]?.uses, false);
  assert.equal(segments[1]?.script, "npm test");
  assert.deepEqual(segments[1]?.exits, [1]);
  assert.ok(!segments[1]?.lines.some((l) => l.includes("Post job cleanup")));
});

test("evidence text turns the run header into a command line and appends the exit line", () => {
  const segment = splitSegments(stripTransport(LOG))[1];
  assert.ok(segment);
  const { text, exit } = buildEvidence(segment);
  assert.equal(exit, 1);
  assert.match(text, /^\$ npm test\n/);
  assert.match(text, /Process completed with exit code 1\.\nexit code: 1$/);
  assert.ok(!text.includes("##["));
});

test("a succeeded step gets exit code 0", () => {
  const log = "2026-09-14T01:24:03Z ##[group]Run cargo test\n2026-09-14T01:24:03Z ##[endgroup]\n2026-09-14T01:24:04Z test result: ok. 3 passed; 0 failed";
  const segment = splitSegments(stripTransport(log))[0];
  assert.ok(segment);
  assert.equal(buildEvidence(segment).text.split("\n").at(-1), "exit code: 0");
});

test("classifier picks one purpose, excludes multi-purpose and unrelated steps", () => {
  assert.deepEqual(classify("Run tests", "cargo nextest run"), { purpose: "test", tool: "cargo test" });
  assert.deepEqual(classify("Lint", "npx eslint ."), { purpose: "lint", tool: "eslint" });
  assert.deepEqual(classify("Build", "cargo build --release"), { purpose: "build", tool: "cargo build" });
  assert.deepEqual(classify("x", "npm run lint && npm test"), { excluded: "multi-purpose" });
  assert.deepEqual(classify("Deploy", "./deploy.sh"), { excluded: "none" });
});

test("exact intervals", () => {
  const upper = upperOneSided(0, 60);
  assert.ok(upper !== null && Math.abs(upper - (1 - 0.05 ** (1 / 60))) < 1e-6);
  const ci = clopperPearson(10, 20);
  assert.ok(ci.lo !== null && ci.hi !== null && Math.abs(ci.lo - 0.2719) < 1e-3 && Math.abs(ci.hi - 0.7281) < 1e-3);
  assert.deepEqual(clopperPearson(0, 0), { lo: null, hi: null });
  assert.equal(clopperPearson(0, 5).lo, 0);
});

test("kappa of perfect and chance agreement", () => {
  assert.equal(kappa([["met", "met"], ["missing", "missing"]]), 1);
  assert.equal(kappa([["met", "missing"], ["missing", "met"]]), -1);
});
