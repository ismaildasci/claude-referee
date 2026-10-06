// eval for decide suites: recording both orders, leader agreement scoring, and the context and reversed ablations.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { decideMetrics, decideShift } from "../src/engine/evals.ts";
import { fakeJev, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const OPTIONS = [
  { name: "a", text: "Option a" },
  { name: "b", text: "Option b" },
];

const labels = (r: FakeRequest): string[] => Object.keys((r.questions["best"]?.criteria ?? {}) as object);

// Context "favour:x" makes x the confident pick; without a hint the first listed option wins, so the two orders disagree.
const answer = (r: FakeRequest) => {
  const ls = labels(r);
  const hint = /favour:(\w+)/.exec(String((r.state as { context?: string }).context ?? ""))?.[1];
  const lead = hint && ls.includes(hint) ? hint : ls[0];
  const top = hint ? 0.9 : 0.6;
  return { best: { type: "choice", choice: lead, confidence: top, probabilities: Object.fromEntries(ls.map((l) => [l, l === lead ? top : (1 - top) / (ls.length - 1)])) } };
};

const CASES = [
  { id: "ca", split: "dev", expected: "a", decision: "d1", context: "favour:a", options: OPTIONS },
  { id: "cb", split: "holdout", expected: "b", decision: "d2", context: "favour:b", options: OPTIONS },
  { id: "cn", split: "holdout", expected: "a", decision: "d3", options: OPTIONS },
];

function suite(cases: object[] = CASES, config: object = { command: "decide" }): string {
  const root = tempDir("referee-decide-evals-");
  mkdirSync(join(root, "s1"));
  writeFileSync(join(root, "s1", "suite.json"), JSON.stringify(config));
  writeFileSync(join(root, "s1", "cases.jsonl"), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
  return root;
}

async function record(root: string, extra: string[] = []) {
  const server = await fakeJev(answer);
  try {
    const io = memoryIo({ env: { TYPESAFE_API_KEY: "ts_test_secret_key_123", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() } });
    const code = await run(["eval", "record", "--suite", "s1", "--evals-dir", root, ...extra], io, commands);
    return { code, out: io.json(), requests: server.requests.length };
  } finally {
    await server.close();
  }
}

async function score(root: string, extra: string[] = []) {
  const io = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() } });
  const code = await run(["eval", "score", "--suite", "s1", "--evals-dir", root, ...extra], io, commands);
  return { code, out: io.json() };
}

test("eval record asks both orders per decide case and keeps the second answer", async () => {
  const root = suite();
  const { code, out, requests } = await record(root);
  assert.equal(code, 0);
  assert.equal(requests, 6);
  assert.equal(out["recorded"], 3);
  const text = readFileSync(join(root, "s1", "recorded.jsonl"), "utf8");
  assert.ok(!text.includes("ts_test_secret_key_123"));
  for (const line of text.trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>)) {
    assert.ok("answers" in line && Array.isArray(line["also"]) && (line["also"] as unknown[]).length === 1);
    assert.ok(!("ablation" in line));
  }
  assert.equal((await record(root)).requests, 0);
});

test("eval score gives leader agreement, the verdict mix and order disagreements, offline", async () => {
  const root = suite();
  await record(root);
  const { code, out } = await score(root);
  assert.equal(code, 0);
  assert.equal(out["verdict"], "scored");
  assert.equal(out["cases"], 3);
  assert.equal(out["agree"], 3);
  assert.equal(out["agreement"], 1);
  assert.deepEqual(out["verdicts"], { clear: 2, weak: 0, tie: 1 });
  assert.equal(out["order_disagrees"], 1);
  assert.deepEqual(out["by_verdict"], { clear: { cases: 2, agree: 2 }, weak: { cases: 0, agree: 0 }, tie: { cases: 1, agree: 1 } });
  assert.ok(!("precision" in out) && !("wrong_positive" in out));
});

test("eval score counts a wrong label as disagreement and honours --split", async () => {
  const root = suite([{ ...CASES[0], expected: "b" }, CASES[1] as object]);
  await record(root);
  assert.equal((await score(root)).out["agreement"], 0.5);
  const holdout = await score(root, ["--split", "holdout"]);
  assert.equal(holdout.out["cases"], 1);
  assert.equal(holdout.out["agreement"], 1);
});

test("eval rejects a decide case whose expected is not one of its options", async () => {
  const root = suite([{ ...CASES[0], expected: "zzz" }]);
  const { code, out } = await record(root);
  assert.notEqual(code, 0);
  assert.match(JSON.stringify(out), /expected must name one of the options/);
});

test("--ablation reversed rescored from the same recording: written order only, so no order disagreement", async () => {
  const root = suite();
  await record(root);
  const rec = await record(root, ["--ablation", "reversed"]);
  assert.equal(rec.requests, 0);
  const { code, out } = await score(root, ["--ablation", "reversed"]);
  assert.equal(code, 0);
  assert.equal(out["ablation"], "reversed");
  assert.equal(out["order_disagrees"], 0);
  assert.deepEqual(out["verdicts"], { clear: 2, weak: 1, tie: 0 });
  assert.equal(out["leader_changed"], 0);
  assert.equal(out["verdict_changed"], 1);
  assert.equal((out["baseline"] as { order_disagrees: number }).order_disagrees, 1);
});

test("--ablation context needs its own recording, then reports what changed against the full run", async () => {
  const root = suite();
  await record(root);
  const missing = await score(root, ["--ablation", "context"]);
  assert.notEqual(missing.code, 0);
  assert.match(JSON.stringify(missing.out), /with the context ablation/);
  const rec = await record(root, ["--ablation", "context"]);
  assert.equal(rec.requests, 4);
  assert.ok(readFileSync(join(root, "s1", "recorded.jsonl"), "utf8").includes('"ablation":"context"'));
  const full = await score(root);
  assert.equal(full.out["agreement"], 1);
  const { out } = await score(root, ["--ablation", "context"]);
  assert.equal(out["ablation"], "context");
  assert.equal(out["leader_changed"], 1);
  assert.equal(out["agree_delta"], -1);
  assert.deepEqual(out["verdicts"], { clear: 0, weak: 0, tie: 3 });
  assert.equal((await record(root, ["--ablation", "context"])).requests, 0);
});

test("--ablation is for decide suites only and takes a known name", async () => {
  const root = suite([{ id: "x", split: "dev", expected: "met", evidence: "Tests: 1 passed\n" }], { command: "done", criteria: "tests pass" });
  const bad = await score(root, ["--ablation", "context"]);
  assert.notEqual(bad.code, 0);
  assert.match(JSON.stringify(bad.out), /decide suites/);
  const decideRoot = suite();
  const unknown = await score(decideRoot, ["--ablation", "micro"]);
  assert.notEqual(unknown.code, 0);
  assert.match(JSON.stringify(unknown.out), /context or reversed/);
  assert.notEqual((await score(decideRoot, ["--sweep", "0.5:0.9:0.1"])).code, 0);
});

test("decideMetrics and decideShift are plain counts", () => {
  const rows = [
    { id: "1", split: "dev", expected: "a", lean: "a", verdict: "clear", order_disagrees: false },
    { id: "2", split: "dev", expected: "a", lean: "b", verdict: "tie", order_disagrees: true },
  ];
  const m = decideMetrics(rows);
  assert.equal(m.agreement, 0.5);
  assert.equal(m.order_disagrees, 1);
  assert.equal(decideMetrics([]).agreement, null);
  const shift = decideShift(rows, [{ ...(rows[0] as (typeof rows)[0]), lean: "b" }, rows[1] as (typeof rows)[0]]);
  assert.deepEqual(shift, { leader_changed: 1, agree_delta: -1, verdict_changed: 0 });
});

test("a recorded line missing the second order fails scoring instead of becoming a tie", async () => {
  const root = suite();
  await record(root);
  const file = join(root, "s1", "recorded.jsonl");
  const lines = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
  delete lines[0]!["also"];
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const { code, out } = await score(root);
  assert.notEqual(code, 0);
  assert.match(JSON.stringify(out), /1 of 2 answers/);
});

test("record --ablation reversed writes nothing and never shadows the full recording", async () => {
  const empty = suite();
  const refused = await record(empty, ["--ablation", "reversed"]);
  assert.notEqual(refused.code, 0);
  assert.equal(refused.requests, 0);
  const root = suite();
  await record(root);
  const file = join(root, "s1", "recorded.jsonl");
  const before = readFileSync(file, "utf8");
  await record(root, ["--ablation", "reversed", "--fresh"]);
  assert.equal(readFileSync(file, "utf8"), before);
  const { out } = await score(root);
  assert.equal(out["order_disagrees"], 1);
});

test("a line recorded under another ablation is ignored by the full score", async () => {
  const root = suite();
  await record(root);
  const file = join(root, "s1", "recorded.jsonl");
  const lines = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
  const stray = lines.map((l) => {
    const { also: _also, ...rest } = l;
    return { ...rest, ablation: "reversed" };
  });
  writeFileSync(file, [...lines, ...stray].map((l) => JSON.stringify(l)).join("\n") + "\n");
  const { code, out } = await score(root);
  assert.equal(code, 0);
  assert.equal(out["order_disagrees"], 1);
});

const THREE = [
  { name: "a", text: "Option a" },
  { name: "b", text: "Option b" },
  { name: "c", text: "Option c" },
];
const TIES = [
  { id: "agree", split: "dev", expected: "b", decision: "d1", context: "favour:b", options: THREE },
  { id: "split", split: "holdout", expected: "a", decision: "d2", options: THREE },
];
const lines = (root: string) => readFileSync(join(root, "s1", "recorded.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { case: string; answers: unknown; also?: unknown[]; ablation?: string });

test("eval record adds the balanced orders when a decide case's two orders tie, and score replays them", async () => {
  const root = suite(TIES);
  const rec = await record(root);
  assert.equal(rec.code, 0, JSON.stringify(rec.out));
  assert.equal(rec.requests, 2 + 6);
  const byCase = Object.fromEntries(lines(root).map((l) => [l.case, l]));
  assert.equal(byCase["agree"]?.also?.length, 1);
  assert.equal(byCase["split"]?.also?.length, 5);
  const { code, out } = await score(root);
  assert.equal(code, 0, JSON.stringify(out));
  assert.equal(out["cases"], 2);
  assert.deepEqual(out["verdicts"], { clear: 1, weak: 0, tie: 1 });
});

test("a decide recording without the balanced orders fails scoring and is topped up with only the missing orders", async () => {
  const root = suite(TIES);
  await record(root);
  const old = lines(root).map((l) => ({ ...l, ...(l.also ? { also: l.also.slice(0, 1) } : {}) }));
  writeFileSync(join(root, "s1", "recorded.jsonl"), old.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const before = await score(root);
  assert.equal(before.code, 1);
  assert.match(String(before.out["message"]), /balanced/);
  const top = await record(root);
  assert.equal(top.code, 0, JSON.stringify(top.out));
  assert.equal(top.requests, 4);
  const after = lines(root).filter((l) => l.case === "split").at(-1);
  assert.deepEqual([after?.answers, after?.also?.[0]], [old.find((l) => l.case === "split")?.answers, old.find((l) => l.case === "split")?.also?.[0]]);
  assert.equal(after?.also?.length, 5);
  assert.equal((await score(root)).code, 0);
});

test("ablations keep two orders, and the request cap counts the balanced orders a case could add", async () => {
  const root = suite(TIES);
  const capped = await record(root, ["--max-requests", "4"]);
  assert.equal(capped.out["error"], "bad_input");
  assert.equal(capped.requests, 0);
  await record(root);
  const context = await record(root, ["--ablation", "context"]);
  assert.equal(context.requests, 2, "two orders for the case with context; the case without context reuses its full recording");
  assert.equal((await score(root, ["--ablation", "context"])).code, 0);
  assert.equal((await score(root, ["--ablation", "reversed"])).code, 0);
});
