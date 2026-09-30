// eval record and eval score: live recording through the fake Jev, offline scoring, stale and missing recordings.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const byEvidence = (request: FakeRequest) => {
  const p = String((request.state as { evidence: string }).evidence).includes("12 passed") ? 0.95 : 0.1;
  return Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: p }]));
};

function suite(cases: object[], config: object = { command: "done", criteria: "all tests pass" }): string {
  const root = tempDir("referee-evals-");
  mkdirSync(join(root, "s1"));
  writeFileSync(join(root, "s1", "suite.json"), JSON.stringify(config));
  writeFileSync(join(root, "s1", "cases.jsonl"), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
  return root;
}

const CASES = [
  { id: "pass", split: "holdout", expected: "met", evidence: "Tests: 12 passed, 12 total\nnpm test exit code: 0\n" },
  { id: "fail", split: "holdout", expected: "missing", evidence: "Tests: 1 failed, 11 passed\nnpm test exit code: 1\n" },
];

async function record(root: string, extra: string[] = [], answer = byEvidence) {
  const server = await fakeJev(answer);
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test_secret_key_123", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() } });
    const code = await run(["eval", "record", "--suite", "s1", "--evals-dir", root, ...extra], io, commands);
    return { code, out: io.json(), requests: server.requests.length };
  } finally {
    await server.close();
  }
}

async function score(root: string, extra: string[] = [], env: Record<string, string> = {}) {
  const io = memoryIo({ env: { REFEREE_DATA_DIR: tempDir(), ...env } });
  const code = await run(["eval", "score", "--suite", "s1", "--evals-dir", root, ...extra], io, commands);
  return { code, out: io.json() };
}

test("eval record calls Jev once per case and writes hashed answers without the key", async () => {
  const root = suite(CASES);
  const { code, out, requests } = await record(root);
  assert.equal(code, 0);
  assert.equal(requests, 2);
  assert.equal(out["recorded"], 2);
  const text = readFileSync(join(root, "s1", "recorded.jsonl"), "utf8");
  assert.ok(!text.includes("ts_test_secret_key_123"));
  const lines = text.trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
  assert.deepEqual(lines.map((l) => l["case"]).sort(), ["fail", "pass"]);
  for (const line of lines) {
    for (const key of ["suite", "split", "model", "pack", "qhash", "shash", "answers", "recorded_at"]) assert.ok(key in line, key);
  }
});

test("eval record skips cases already recorded unless --fresh", async () => {
  const root = suite(CASES);
  await record(root);
  const again = await record(root);
  assert.equal(again.requests, 0);
  assert.equal(again.out["skipped"], 2);
  const fresh = await record(root, ["--fresh"]);
  assert.equal(fresh.requests, 2);
});

test("eval score works offline and reports the kill criterion", async () => {
  const root = suite(CASES);
  await record(root);
  const { code, out } = await score(root);
  assert.equal(code, 0);
  assert.equal(out["verdict"], "pass");
  assert.equal(out["cases"], 2);
  assert.deepEqual(out["verdicts"], { met: 1, unsure: 0, missing: 1 });
  assert.equal(out["wrong_positive"], 0);
  assert.equal(out["precision"], 1);
  assert.equal(out["recall"], 1);
});

test("eval score flags a suite over its wrong-positive allowance, and --fail-on turns that into exit 3", async () => {
  const root = suite(CASES, { command: "done", criteria: "all tests pass", max_wrong_positive: 0 });
  await record(root, [], (r) => Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: 0.95 }])));
  const { out } = await score(root);
  assert.equal(out["verdict"], "violated");
  assert.equal(out["wrong_positive"], 1);
  const failing = await score(root, ["--fail-on", "violated"]);
  assert.equal(failing.code, 3);
});

test("eval score fails when a case has no recording or its question text changed", async () => {
  const root = suite(CASES);
  const missing = await score(root);
  assert.equal(missing.code, 1);
  assert.match(String(missing.out["message"]), /no recording/i);

  await record(root);
  const packs = tempDir();
  mkdirSync(join(packs, "reworded", "questions"), { recursive: true });
  writeFileSync(join(packs, "reworded", "pack.json"), JSON.stringify({ name: "reworded", version: "0.0.1", extends: "generic" }));
  writeFileSync(
    join(packs, "reworded", "questions", "done.json"),
    JSON.stringify({ "done.met": { type: "noul", instructions: { question: "Does `evidence` prove `criterion`?" }, criteria: { true: "yes", false: "no" } } }),
  );
  const stale = await score(root, ["--pack", "reworded"], { REFEREE_PACKS_DIR: packs });
  assert.equal(stale.code, 1);
  assert.match(String(stale.out["message"]), /changed|stale/i);
});

test("eval score filters by split", async () => {
  const root = suite([{ ...CASES[0]!, split: "dev" }, CASES[1]!]);
  await record(root);
  const { out } = await score(root, ["--split", "holdout"]);
  assert.equal(out["cases"], 1);
});
