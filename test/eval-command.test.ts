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
  const p = JSON.stringify((request.state as { evidence: unknown }).evidence).includes("12 passed") ? 0.95 : 0.1;
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
  { id: "fail", split: "holdout", expected: "missing", evidence: "Tests: 1 failed, 11 passed\n" },
];

async function record(root: string, extra: string[] = [], answer = byEvidence, env: Record<string, string> = {}) {
  const server = await fakeJev(answer);
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test_secret_key_123", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir(), ...env } });
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

test("eval record --verbose prints the same usage line on stderr as the other commands that ask Jev, and none with --dry-run", async () => {
  const root = suite(CASES);
  const server = await fakeJev(byEvidence);
  try {
    const env = { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() };
    const planned = memoryIo({ env });
    assert.equal(await run(["eval", "record", "--suite", "s1", "--evals-dir", root, "--verbose", "--dry-run"], planned, commands), 0);
    assert.deepEqual(planned.err, []);
    const live = memoryIo({ env });
    assert.equal(await run(["eval", "record", "--suite", "s1", "--evals-dir", root, "--verbose"], live, commands), 0);
    assert.equal(live.out.join("").trim().split("\n").length, 1);
    assert.equal(live.err.length, 1);
    const usage = JSON.parse(live.err[0] ?? "") as Record<string, unknown>;
    assert.deepEqual(Object.keys(usage), ["requests", "cached", "input_tokens", "cost_usd", "model", "ms"]);
    assert.deepEqual([usage["requests"], usage["cached"], usage["input_tokens"]], [2, 0, 200]);
  } finally {
    await server.close();
  }
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

test("eval record stops before the first request when --max-requests would be exceeded", async () => {
  const root = suite(CASES);
  const { code, out, requests } = await record(root, ["--max-requests", "1"]);
  assert.equal(code, 1);
  assert.equal(out["error"], "bad_input");
  assert.match(String(out["message"]), /2 requests/);
  assert.equal(requests, 0);
  const again = await record(root, ["--max-requests", "2"]);
  assert.equal(again.code, 0);
  assert.equal(again.requests, 2);
});

test("eval record stops before the first request when the estimated cost is over --max-usd", async () => {
  const root = suite(CASES);
  const { code, out, requests } = await record(root, ["--max-usd", "0.0000001"]);
  assert.equal(code, 1);
  assert.equal(out["error"], "bad_input");
  assert.match(String(out["message"]), /USD/);
  assert.equal(requests, 0);
  const bad = await record(root, ["--max-requests", "many"]);
  assert.equal(bad.out["error"], "bad_input");
});

test("eval record refuses --max-usd for a model with no known price instead of skipping the cap", async () => {
  const root = suite(CASES);
  const { code, out, requests } = await record(root, ["--max-usd", "1"], byEvidence, { TYPESAFE_MODEL: "jev-unpriced" });
  assert.equal(code, 1);
  assert.equal(out["error"], "bad_input");
  assert.match(String(out["message"]), /jev-unpriced/);
  assert.match(String(out["message"]), /--max-usd/);
  assert.equal(requests, 0);
  const uncapped = await record(root, [], byEvidence, { TYPESAFE_MODEL: "jev-unpriced" });
  assert.equal(uncapped.code, 0);
  assert.equal(uncapped.requests, 2);
});

test("eval record counts only the cases still to record against the cap", async () => {
  const root = suite(CASES);
  await record(root);
  const { code, requests } = await record(root, ["--max-requests", "0"]);
  assert.equal(code, 0);
  assert.equal(requests, 0);
});

const RISKY = [
  { id: "rm", split: "holdout", expected: "yes", text: "rm -rf $BUILD_DIR/*" },
  { id: "log", split: "holdout", expected: "no", text: "console.log('done')" },
  { id: "maybe", split: "dev", expected: "yes", text: "retry(3)" },
];
const riskyAnswer = (request: FakeRequest) => {
  const item = (request.state as { item: string }).item;
  const p = item.startsWith("rm") ? 0.97 : item.startsWith("console") ? 0.02 : 0.5;
  return Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: p }]));
};

test("eval handles judge suites: record once, score offline with yes, no and review", async () => {
  const root = suite(RISKY, { command: "judge", question: "line.risky", positive: "yes", max_wrong_positive: 0 });
  const rec = await record(root, [], riskyAnswer);
  assert.equal(rec.code, 0, JSON.stringify(rec.out));
  assert.equal(rec.requests, 3);
  const { code, out } = await score(root);
  assert.equal(code, 0, JSON.stringify(out));
  assert.deepEqual(out["verdicts"], { yes: 1, no: 1, review: 1 });
  assert.equal(out["wrong_positive"], 0);
  assert.equal(out["recall"], 0.5);
});

test("a judge suite without a question is rejected, and a yes on a no case violates the suite", async () => {
  const noQuestion = suite(RISKY, { command: "judge", positive: "yes" });
  const bad = await record(noQuestion, [], riskyAnswer);
  assert.equal(bad.out["error"], "bad_input");
  const root = suite([{ id: "rm", split: "holdout", expected: "no", text: "rm -rf $BUILD_DIR/*" }], { command: "judge", question: "line.risky", positive: "yes", max_wrong_positive: 0 });
  await record(root, [], riskyAnswer);
  const { out } = await score(root, ["--fail-on", "violated"]);
  assert.equal(out["verdict"], "violated");
  assert.equal(out["wrong_positive"], 1);
});

test("eval applies the exit-code rule like done: a non-zero exit code is missing in code and costs no request", async () => {
  const root = suite([
    { id: "green", split: "holdout", expected: "met", evidence: "Tests: 12 passed, 12 total\nnpm test exit code: 0\n" },
    { id: "green-then-1", split: "holdout", expected: "missing", evidence: "Tests: 12 passed, 12 total\nnpm test exit code: 1\n" },
  ]);
  const rec = await record(root);
  assert.equal(rec.requests, 1);
  assert.equal(rec.out["recorded"], 1);
  assert.equal(rec.out["skipped"], 1);
  const { out } = await score(root);
  assert.deepEqual(out["verdicts"], { met: 1, unsure: 0, missing: 1 });
  assert.equal(out["wrong_positive"], 0);
});

test("eval record --split records only that split, so dev can be recorded before the hold-out", async () => {
  const root = suite([{ ...CASES[0]!, split: "dev" }, CASES[1]!]);
  const dev = await record(root, ["--split", "dev"]);
  assert.equal(dev.code, 0);
  assert.equal(dev.requests, 1);
  const recorded = () => readFileSync(join(root, "s1", "recorded.jsonl"), "utf8").trim().split("\n").map((l) => (JSON.parse(l) as { case: string }).case);
  assert.deepEqual(recorded(), ["pass"]);
  const holdout = await record(root, ["--split", "holdout"]);
  assert.equal(holdout.requests, 1);
  assert.equal(holdout.out["skipped"], 0);
  assert.deepEqual(recorded(), ["pass", "fail"]);
  const bad = await record(root, ["--split", "test"]);
  assert.equal(bad.out["error"], "bad_input");
});

function twoPackRoot(): string {
  const root = tempDir("referee-evals-");
  const write = (name: string, config: object, cases: object[]) => {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, "suite.json"), JSON.stringify(config));
    writeFileSync(join(root, name, "cases.jsonl"), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
  };
  write("a-done", { command: "done", criteria: "all tests pass" }, CASES);
  write("b-i18n", { command: "judge", question: "string.translatable", positive: "yes", pack: "i18n" }, [{ id: "btn", split: "dev", expected: "yes", text: "Save changes", context: "src/a.tsx:1 jsx-text in <button>" }]);
  return root;
}

async function evalRun(args: string[]) {
  const server = await fakeJev((r) => Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: 0.95 }])));
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test_secret_key_123", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() } });
    const code = await run(["eval", ...args], io, commands);
    return { code, out: io.json(), requests: server.requests.length };
  } finally {
    await server.close();
  }
}

test("a suite.json pack is used by record and by score --suite all next to suites on the default pack", async () => {
  const root = twoPackRoot();
  assert.equal((await evalRun(["record", "--suite", "a-done", "--evals-dir", root])).code, 0);
  const rec = await evalRun(["record", "--suite", "b-i18n", "--evals-dir", root]);
  assert.equal(rec.code, 0, JSON.stringify(rec.out));
  assert.equal(rec.requests, 1);
  assert.equal((JSON.parse(readFileSync(join(root, "b-i18n", "recorded.jsonl"), "utf8")) as { pack: string }).pack, "i18n@0.1.0");
  const all = await evalRun(["score", "--suite", "all", "--evals-dir", root]);
  assert.equal(all.code, 0, JSON.stringify(all.out));
  assert.match(JSON.stringify(all.out), /b-i18n/);
});

test("record refuses suites on different packs in one run, and --pack still overrides a suite's pack", async () => {
  const root = twoPackRoot();
  const both = await evalRun(["record", "--suite", "all", "--evals-dir", root]);
  assert.equal(both.out["error"], "bad_input");
  assert.match(String(both.out["message"]), /different packs/);
  assert.equal(both.requests, 0);
  await evalRun(["record", "--suite", "b-i18n", "--evals-dir", root]);
  const forced = await evalRun(["score", "--suite", "b-i18n", "--evals-dir", root, "--pack", "generic"]);
  assert.equal(forced.out["error"], "bad_pack");
});
