// Pest and Collision failure marks before the "Tests:" summary (docs/decisions/pest-failure-lines.md): a cut-off log with a failure and exit code 0 is a conflict, never met.
// Invented lines in the shape of real Pest 5.3 output; the full failing log keeps its counts (largest mark, never a sum), passing logs and Next.js "⨯" lines are unchanged.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers as js } from "../src/engine/runners/js.ts";

const pack = loadPack("generic", packDirs(process.env));
const jest = js.find((p) => p.name === "jest");
assert.ok(jest);
const verdictOf = (evidence: string, criterion = "the test command exits with code 0", p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  return finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: p } }, stopped: [], cached: true }]).verdict;
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;

const HEAD = ["", "   FAIL  Tests\\Feature\\CartTest", "  ✓ Cart totals → it adds two items                                      0.01s  ", "  ⨯ Cart totals → it applies a coupon                                    0.02s  ", "  ✓ Cart totals → it rounds the tax", "", "   FAIL  Tests\\Unit\\SlugTest - 1 todo", "  ✓ it lowercases input", "  ⨯ it strips punctuation", "  - it keeps unicode → not here", "  ↓ it collapses dashes"];
const BLOCKS = ["  ────────────────────────────────────────────────────────────  ", "   FAILED  Tests\\Feature\\CartTest > `Cart totals` → it applies a coup…   ", "  Failed asserting that 9 is identical to 8.", "", "  ────────────────────────────────────────────────────────────  ", "   FAILED  Tests\\Unit\\SlugTest > it strips punctuation       RuntimeException   ", "  boom", ""];
const SUMMARY = ["  Tests:    2 failed, 1 todo, 1 skipped, 3 passed (4 assertions)", "  Duration: 0.15s", ""];
const EXIT0 = "exit code: 0";

test("a Pest log cut before its summary counts its failure marks", () => {
  const cut = lines(...HEAD, EXIT0);
  const f = jest.parse(cut);
  assert.deepEqual({ f: f?.failed, n: f?.failing }, { f: 2, n: ["Cart totals → it applies a coupon", "it strips punctuation"] });
  assert.deepEqual({ t: parseEvidence(cut).trust, c: parseEvidence(cut).conflict }, { t: "parsed", c: true });
  assert.equal(verdictOf(cut), "unsure");
  assert.equal(jest.parse(lines(...HEAD.slice(0, 2), EXIT0))?.failed, 1);
});

test("FAILED blocks name the failing tests without the exception column", () => {
  const f = jest.parse(lines(...HEAD, ...BLOCKS, EXIT0));
  assert.deepEqual({ f: f?.failed, n: f?.failing }, { f: 2, n: ["Tests\\Feature\\CartTest > `Cart totals` → it applies a coup…", "Tests\\Unit\\SlugTest > it strips punctuation"] });
});

test("a compact progress line counts one failure per mark", () => {
  const cut = lines("", "  .⨯..s.t!!i!!.⨯st", EXIT0);
  assert.equal(jest.parse(cut)?.failed, 2);
  assert.equal(verdictOf(cut), "unsure");
});

test("the full failing log keeps the summary's count, marks never add up", () => {
  const f = jest.parse(lines(...HEAD, ...BLOCKS, ...SUMMARY, "exit code: 2"));
  assert.deepEqual({ p: f?.passed, f: f?.failed, s: f?.skipped }, { p: 3, f: 2, s: 2 });
  assert.equal(verdictOf(lines(...HEAD, ...BLOCKS, ...SUMMARY, "exit code: 2")), "missing");
});

test("passing Pest logs and Next.js marks are unchanged", () => {
  const pass = lines("", "   PASS  Tests\\Unit\\SlugTest", "  ✓ it lowercases input", "  ✓ it strips punctuation", "", "  Tests:    2 passed (4 assertions)", "  Duration: 0.12s", "", EXIT0);
  assert.deepEqual({ f: jest.parse(pass)?.failed, n: jest.parse(pass)?.failing }, { f: 0, n: [] });
  assert.equal(verdictOf(pass, "all tests pass"), "met");
  assert.equal(jest.parse(lines("   ▲ Next.js 16.0.1", " ⨯ useSearchParams() should be wrapped in a suspense boundary at page \"/\"", EXIT0)), null);
  assert.equal(jest.parse(lines("  ✓ it lowercases input", "  ⨯ it strips punctuation", EXIT0)), null);
});
