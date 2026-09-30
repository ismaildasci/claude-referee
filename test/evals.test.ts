// Offline eval scoring: metrics, the kill criterion, threshold sweeps, recording lookup and case parsing.

import assert from "node:assert/strict";
import { test } from "node:test";
import { findRecording, metrics, parseCases, parseSweep, sweep } from "../src/engine/evals.ts";

const item = (id: string, expected: string, verdict: string) => ({ id, split: "holdout", expected, verdict });

test("metrics count verdicts and report precision, recall, automation and wrong positives", () => {
  const m = metrics(
    [item("a", "met", "met"), item("b", "met", "unsure"), item("c", "missing", "met"), item("d", "missing", "missing"), item("e", "missing", "missing")],
    "met",
  );
  assert.deepEqual(m.verdicts, { met: 2, unsure: 1, missing: 2 });
  assert.equal(m.cases, 5);
  assert.equal(m.precision, 0.5);
  assert.equal(m.recall, 0.5);
  assert.equal(m.automation, 0.8);
  assert.equal(m.wrong_positive, 1);
  assert.equal(m.wrong_negative, 0);
});

test("metrics leave precision and recall empty when there is nothing to divide by", () => {
  const m = metrics([item("a", "missing", "missing"), item("b", "missing", "unsure")], "met");
  assert.equal(m.precision, null);
  assert.equal(m.recall, null);
  assert.equal(m.wrong_positive, 0);
});

test("sweep refuses to suggest a threshold when a class has fewer than 10 cases", () => {
  const items = [0.2, 0.4, 0.95].map((p, i) => ({ id: String(i), expected: i === 2 ? "met" : "missing", p }));
  const s = sweep(items, "met", parseSweep("0.5:0.9:0.2"));
  assert.equal(s.rows.length, 3);
  assert.deepEqual(s.rows[0], { t: 0.5, precision: 1, recall: 1, wrong_positive: 0 });
  assert.equal(s.suggested, null);
  assert.match(String(s.reason), /fewer than 10/);
});

test("sweep suggests the lowest threshold with no wrong positives once both classes have 10 cases", () => {
  const items = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, expected: "met", p: 0.72 + i * 0.02 })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, expected: "missing", p: i === 9 ? 0.78 : 0.1 })),
  ];
  const s = sweep(items, "met", parseSweep("0.70:0.80:0.05"));
  assert.deepEqual(s.rows.map((r) => r.wrong_positive), [1, 1, 0]);
  assert.equal(s.suggested, 0.8);
});

test("parseSweep rejects a malformed range", () => {
  for (const spec of ["0.5", "0.9:0.5:0.1", "a:b:c", "0.5:0.9:0"]) assert.throws(() => parseSweep(spec), /sweep/i, spec);
});

test("findRecording tells a missing recording from a stale one", () => {
  const lines = [{ case: "a", qhash: "q1", shash: "s1", model: "jev-1.13.0", answers: {} }];
  assert.equal(findRecording(lines, { case: "a", qhash: "q1", shash: "s1", model: "jev-1.13.0" }).status, "ok");
  assert.equal(findRecording(lines, { case: "a", qhash: "q2", shash: "s1", model: "jev-1.13.0" }).status, "stale");
  assert.equal(findRecording(lines, { case: "a", qhash: "q1", shash: "s2", model: "jev-1.13.0" }).status, "stale");
  assert.equal(findRecording(lines, { case: "b", qhash: "q1", shash: "s1", model: "jev-1.13.0" }).status, "missing");
  assert.equal(findRecording(lines, { case: "a", qhash: "q1", shash: "s1", model: "jev-2.0.0" }).status, "missing");
});

test("parseCases needs unique ids, a dev or holdout split and an expected label", () => {
  const good = parseCases('{"id":"a","split":"dev","expected":"met","evidence":"x"}\n{"id":"b","split":"holdout","expected":"missing","evidence":"y"}\n');
  assert.deepEqual(good.map((c) => c.id), ["a", "b"]);
  for (const bad of [
    '{"id":"a","split":"dev","expected":"met"}\n{"id":"a","split":"dev","expected":"met"}',
    '{"id":"a","split":"train","expected":"met"}',
    '{"id":"a","split":"dev"}',
    "not json",
  ]) {
    assert.throws(() => parseCases(bad), /case/i, bad);
  }
});
