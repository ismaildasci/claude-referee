// Opt-in local evidence for done verdicts (docs/decisions/local-evidence-labels.md): off by default, redacted, kept 14 days, labelled by the owner.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { EVIDENCE_DAYS, readEvidence, storeEvidence } from "../src/engine/evidence.ts";
import { appendReceipt } from "../src/engine/receipts.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const HOME = "/Users/example-owner";
const EVIDENCE = `PASS all tests pass in ${HOME}/work/app, reported to owner@example.test`;

function env(dataDir: string, baseUrl: string, keep: boolean): Record<string, string> {
  return { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: baseUrl, REFEREE_DATA_DIR: dataDir, ...(keep ? { REFEREE_KEEP_EVIDENCE: "1" } : {}) };
}

test("off by default: a done run writes no evidence folder and no label file", async () => {
  const server = await fakeJev();
  try {
    const dataDir = tempDir();
    const io = memoryIo({ env: env(dataDir, server.url, false), cwd: tempDir(), home: HOME, stdin: EVIDENCE });
    assert.equal(await run(["done", "--criteria", "all tests pass"], io, commands), 0);
    assert.equal(existsSync(join(dataDir, "evidence")), false);
    assert.equal(existsSync(join(dataDir, "receipt-labels.jsonl")), false);
  } finally {
    await server.close();
  }
});

test("on: the stored record is redacted, done's output holds no evidence text, and show, label and stats work", async () => {
  const server = await fakeJev();
  try {
    const dataDir = tempDir();
    const cwd = tempDir();
    const done = memoryIo({ env: env(dataDir, server.url, true), cwd, home: HOME, stdin: EVIDENCE });
    assert.equal(await run(["done", "--criteria", "all tests pass"], done, commands), 0);
    const receipt = String(done.json()["receipt"]);
    assert.doesNotMatch(done.out.join(""), /owner@example\.test|work\/app/);
    const stored = readFileSync(join(dataDir, "evidence", `${receipt}.json`), "utf8");
    assert.doesNotMatch(stored, /owner@example\.test/);
    assert.doesNotMatch(stored, new RegExp(HOME.replace(/\//g, "\\/")));
    assert.equal(readEvidence(dataDir, receipt)?.criteria[0], "all tests pass");
    const show = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    assert.equal(await run(["receipts", "--show-evidence", receipt], show, commands), 0);
    assert.equal(show.json()["verdict"], "evidence");
    const label = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    assert.equal(await run(["receipts", "--label-receipt", receipt, "--wrong"], label, commands), 0);
    const stats = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    assert.equal(await run(["receipts", "--evidence-stats"], stats, commands), 0);
    const byVerdict = stats.json()["by_verdict"] as Record<string, { right: number; wrong: number }>;
    assert.equal(stats.json()["labelled"], 1);
    assert.equal(Object.values(byVerdict).reduce((n, c) => n + c.wrong, 0), 1);
  } finally {
    await server.close();
  }
});

test("labels: an unknown receipt id is refused, and a label needs --right or --wrong", async () => {
  const dataDir = tempDir();
  assert.equal(await run(["receipts", "--label-receipt", "zzzz1", "--wrong"], memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd: tempDir() }), commands), 1);
  assert.equal(await run(["receipts", "--label-receipt", "zzzz1"], memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd: tempDir() }), commands), 1);
});

test("retention: a record older than 14 days is removed by the next write, a new one is kept", () => {
  const dataDir = tempDir();
  const dir = join(dataDir, "evidence");
  mkdirSync(dir, { recursive: true });
  const old = join(dir, "rold1.json");
  writeFileSync(old, "{}");
  const past = (Date.now() - (EVIDENCE_DAYS + 1) * 86_400_000) / 1000;
  utimesSync(old, past, past);
  assert.equal(storeEvidence(dataDir, "rnew1", { criteria: ["x"], evidence: "ok", home: HOME, now: Date.now() }), true);
  assert.deepEqual(readdirSync(dir).sort(), ["rnew1.json"]);
});

test("storage refuses ids that are not receipt ids (no path from input)", () => {
  assert.equal(storeEvidence(tempDir(), "../escape", { criteria: ["x"], evidence: "ok", home: HOME, now: Date.now() }), false);
  assert.equal(readEvidence(tempDir(), "../escape"), null);
});

test("evidence-queue lists stored, unlabelled done receipts newest first, filters by verdict and prints no text", async () => {
  const server = await fakeJev();
  try {
    const dataDir = tempDir();
    const cwd = tempDir();
    const ids: string[] = [];
    for (const keep of [true, true, false, true]) {
      const done = memoryIo({ env: env(dataDir, server.url, keep), cwd, home: HOME, stdin: EVIDENCE });
      assert.equal(await run(["done", "--criteria", "all tests pass"], done, commands), 0);
      if (keep) ids.push(String(done.json()["receipt"]));
    }
    const label = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    assert.equal(await run(["receipts", "--label-receipt", ids[0] ?? "", "--right"], label, commands), 0);
    const queue = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    assert.equal(await run(["receipts", "--evidence-queue"], queue, commands), 0);
    const result = queue.json() as { count: number; queue: { id: string; verdict: string }[]; next_step: string };
    assert.deepEqual(result.queue.map((r) => r.id), [ids[2], ids[1]]);
    assert.equal(result.count, 2);
    assert.match(result.next_step, /--show-evidence/);
    assert.doesNotMatch(queue.out.join(""), /owner@example\.test|work\/app|all tests pass/);
    const verdict = result.queue[0]?.verdict ?? "";
    const same = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    await run(["receipts", "--evidence-queue", "--verdict", verdict], same, commands);
    assert.equal((same.json() as { count: number }).count, 2);
    const none = memoryIo({ env: env(dataDir, server.url, false), cwd, home: HOME });
    await run(["receipts", "--evidence-queue", "--verdict", "no-such-verdict"], none, commands);
    assert.equal((none.json() as { count: number }).count, 0);
    assert.match(String(none.json()["next_step"]), /Nothing waits/);
  } finally {
    await server.close();
  }
});

test("evidence-queue shows at most 20 rows, the newest", async () => {
  const dataDir = tempDir();
  for (let i = 0; i < 25; i++) {
    const id = `r${String(i).padStart(2, "0")}`;
    appendReceipt(dataDir, { id, ts: `2026-10-09T10:${String(i).padStart(2, "0")}:00.000Z`, command: "done", project: "p1", verdict: "met", requests: 1, cached: 0, input_tokens: 1, cost_usd: 0, ms: 1 });
    storeEvidence(dataDir, id, { criteria: ["x"], evidence: "y", home: HOME, now: Date.parse("2026-10-09T10:30:00Z") });
  }
  const queue = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd: tempDir(), home: HOME });
  assert.equal(await run(["receipts", "--evidence-queue"], queue, commands), 0);
  const result = queue.json() as { count: number; queue: { id: string }[] };
  assert.equal(result.count, 20);
  assert.equal(result.queue[0]?.id, "r24");
  assert.equal(result.queue[19]?.id, "r05");
});
