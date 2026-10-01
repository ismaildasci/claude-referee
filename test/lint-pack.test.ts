// lint-pack: every rule has a violating fixture, the generic pack is clean, and --recorded catches a Noul that is always high.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { lintQuestions, lintRecorded } from "../src/engine/lint.ts";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const noul = (question: string, t = "Yes, clearly.", f = "No, or not shown.") => ({ type: "noul", instructions: { question }, criteria: { true: t, false: f } });
const rules = (q: Record<string, unknown>, model: unknown = "jev-1.13.0") => lintQuestions(q, model).map((f) => `${f.rule}:${f.question}`);

test("each rule catches its violating fixture", () => {
  assert.deepEqual(rules({ a: noul("Is it red and round?") }), ["compound:a"]);
  assert.deepEqual(rules({ a: noul("Is it red?") }, null), ["model:(pack)"]);
  assert.deepEqual(rules({ a: noul("Is it red?") }, "jev-latest"), ["model:(pack)"]);
  assert.deepEqual(rules({ a: { type: "noul", instructions: {}, criteria: {} } }), ["instructions:a"]);
  assert.deepEqual(rules({ a: { type: "noul", instructions: { question: "Is it red?" }, criteria: { true: "x" } } }), ["criteria:a"]);
  assert.deepEqual(rules({ a: noul("Is it red?", "It is red.", "It is red.") }), ["contradiction:a"]);
  assert.deepEqual(rules({ a: { type: "choice", instructions: { question: "Which colour?" }, criteria: { red: "The colour is red.", blue: "The colour is blue." } } }), ["other:a"]);
  assert.deepEqual(rules({ a: { type: "choice", instructions: { question: "Which colour?" }, criteria: { red: "red", other: "Any other colour here." } } }), ["definition:a"]);
  const many = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`o${i}`, "A defined option text."]));
  assert.ok(rules({ a: { type: "choice", instructions: { question: "Which?" }, criteria: many } }).includes("options:a"));
  assert.deepEqual(rules({ a: { type: "score", instructions: { question: "How good?" }, criteria: ["bad"] } }), ["levels:a"]);
  assert.deepEqual(rules({ a: { type: "score", instructions: { question: "How good?" }, criteria: ["1", "2", "3"] } }), ["levels:a"]);
  assert.deepEqual(rules({ a: noul("How many files changed?") }), ["counting:a"]);
  assert.deepEqual(rules({ a: noul("Is it red?", "Red.", "Not red at all.") }), []);
});

test("--recorded flags a Noul that is high on every input", () => {
  assert.deepEqual(lintRecorded({ "s:c": Array.from({ length: 12 }, (_, i) => 0.56 + i * 0.02) }).map((f) => f.question), ["s:c"]);
  assert.deepEqual(lintRecorded({ "s:c": [0.9, 0.1, 0.95, 0.05, 0.9, 0.1, 0.95, 0.05, 0.9, 0.1, 0.8] }), []);
  assert.deepEqual(lintRecorded({ "s:c": [0.9, 0.8] }), []);
});

test("the generic pack lints clean, from the command line too", async () => {
  const pack = join(dirname(fileURLToPath(import.meta.url)), "../plugins/claude-referee/packs/generic");
  const io = memoryIo({});
  assert.equal(await run(["lint-pack", pack, "--fail-on", "warnings,errors"], io, commands), 0);
  assert.equal(io.json()["verdict"], "clean");
  const bad = tempDir();
  mkdirSync(join(bad, "questions"), { recursive: true });
  writeFileSync(join(bad, "pack.json"), JSON.stringify({ name: "bad" }));
  writeFileSync(join(bad, "questions", "q.json"), JSON.stringify({ a: noul("Is it red and round?") }));
  const out = memoryIo({});
  assert.equal(await run(["lint-pack", bad, "--fail-on", "warnings"], out, commands), 3);
  assert.equal(out.json()["verdict"], "warnings");
});
