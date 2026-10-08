// A rubocop run that says an analysis will be skipped is one warning, so a lint criterion is not met (docs/decisions/rubocop-skip-warning.md).
// Output is invented to mirror the shape of the real log; no real log text is committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneEvidence, doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parsers } from "../src/engine/runners/more-tools.ts";

const rubocop = parsers.find((p) => p.name === "rubocop");
const pack = loadPack("generic", packDirs(process.env));
const SKIP = "Analyses that use the project index will be skipped. Add `gem 'stubgem'` to your Gemfile.";
const log = (extra: string) => `$ bundle exec rubocop\nInspecting 1200 files\n${extra}1200 files inspected, no offenses detected\nexit code: 0\n`;
const verdictOf = (evidence: string, criterion: string) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], doneEvidence(evidence));
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: 0.98 } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};

test("rubocop: a skip line before the summary counts as one warning; a run without it has none", () => {
  assert.equal(rubocop?.parse(log(`${SKIP}\n`))?.warnings, 1);
  assert.equal(rubocop?.parse(log(""))?.warnings, 0);
});

test("done: the real-log shape with a skip line is unsure for a lint criterion (warning_in_log), not met", () => {
  assert.deepEqual(verdictOf(log(`${SKIP}\n`), "lint is clean"), { verdict: "unsure", reason: "warning_in_log" });
});

test("done: a clean rubocop run without the skip line stays met for a lint criterion", () => {
  assert.deepEqual(verdictOf(log(""), "lint is clean"), { verdict: "met", reason: undefined });
});

test("done: a non-lint criterion reads the skip-line run exactly as the run without it", () => {
  for (const criterion of ["all tests pass", "the feature works"]) {
    assert.deepEqual(verdictOf(log(`${SKIP}\n`), criterion), verdictOf(log(""), criterion), criterion);
  }
});
