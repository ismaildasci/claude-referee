// Stop done-gate store and labelling CLI: append/read, label rewrite, stats arithmetic, receipts --stops, --unlabelled, --label.

import assert from "node:assert/strict";
import { appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { projectId } from "../src/engine/datadir.ts";
import { appendStop, labelStop, newStopId, readStops, stopStats, stopsFile } from "../src/engine/stopgate/stops.ts";
import type { StopRecord } from "../src/engine/stopgate/types.ts";
import { memoryIo, tempDir } from "./helpers.ts";

function rec(id: string, extra: Partial<StopRecord> & { block?: boolean } = {}): StopRecord {
  const { block, ...rest } = extra;
  return {
    id,
    ts: "2026-09-29T10:00:00.000Z",
    session_id: "session-private-1",
    project: "p",
    mode: "shadow",
    edits: 2,
    checks: 1,
    ms: 100,
    ...(block === undefined ? {} : { decision: { claims_done: 3, claims_verified: 1, verification_applies: 2, outcome: { missing: 1 }, would_block: block } }),
    ...rest,
  };
}

const FIXED: StopRecord[] = [
  rec("s1", { skipped: "no_edits", ms: 1 }),
  rec("s2", { skipped: "check_passed_after_edit", ms: 1 }),
  rec("s3", { skipped: "no_edits", ms: 1 }),
  rec("s4", { block: true, ms: 100, label: "right" }),
  rec("s5", { block: true, ms: 200, label: "wrong" }),
  rec("s6", { block: true, ms: 300, label: "right" }),
  rec("s7", { block: true, ms: 400 }),
  rec("s8", { block: false, ms: 50, label: "right" }),
];

test("append and read round trip, malformed lines skipped, file mode 0600", () => {
  const dir = join(tempDir(), "nested");
  appendStop(dir, rec("s1"));
  appendFileSync(stopsFile(dir), "not json\n{broken\n\n[1,2]\n");
  appendStop(dir, rec("s2", { block: true }));
  const read = readStops(dir);
  assert.deepEqual(read.map((r) => r.id), ["s1", "s2"]);
  assert.equal(read[1]?.decision?.would_block, true);
  if (process.platform !== "win32") assert.equal(statSync(stopsFile(dir)).mode & 0o777, 0o600);
  assert.deepEqual(readStops(tempDir()), []);
});

test("newStopId has the s prefix and differs by time", () => {
  assert.match(newStopId(1_700_000_000_000), /^s[0-9a-z]{12,}$/);
  assert.notEqual(newStopId(1), newStopId(2));
});

test("labelStop rewrites one record and reports unknown ids", () => {
  const dir = tempDir();
  appendStop(dir, rec("s1", { block: true }));
  appendStop(dir, rec("s2", { block: true }));
  assert.equal(labelStop(dir, "s2", "wrong", "2026-09-30T12:00:00.000Z"), true);
  const read = readStops(dir);
  assert.equal(read[0]?.label, undefined);
  assert.equal(read[1]?.label, "wrong");
  assert.equal(read[1]?.labelled_at, "2026-09-30T12:00:00.000Z");
  const before = readFileSync(stopsFile(dir), "utf8");
  assert.equal(labelStop(dir, "nope", "right", "2026-09-30T12:00:00.000Z"), false);
  assert.equal(readFileSync(stopsFile(dir), "utf8"), before);
});

test("stopStats arithmetic on a fixed set", () => {
  const s = stopStats(FIXED);
  assert.equal(s.stops, 8);
  assert.deepEqual(s.skipped_by_reason, { no_edits: 2, check_passed_after_edit: 1 });
  assert.equal(s.asked, 5);
  assert.equal(s.would_block, 4);
  assert.equal(s.labelled, 3);
  assert.equal(s.right, 2);
  assert.equal(s.wrong, 1);
  assert.equal(s.precision, 2 / 3);
  assert.equal(s.false_block_rate, 1 / 3);
  assert.equal(s.p95_ms, 400);
  assert.equal(s.unlabelled_would_block, 1);
  const none = stopStats([]);
  assert.equal(none.precision, null);
  assert.equal(none.false_block_rate, null);
  assert.equal(none.p95_ms, null);
});

function setup() {
  const dataDir = tempDir();
  const cwd = tempDir();
  const project = projectId(cwd);
  for (const r of FIXED) appendStop(dataDir, { ...r, project, task_excerpt: `task ${r.id}`, final_excerpt: `final ${r.id}` });
  appendStop(dataDir, rec("other", { block: true, project: "someone-else" }));
  return { dataDir, cwd, env: { REFEREE_DATA_DIR: dataDir } };
}

test("receipts --stops lists newest first with stats and only the listed fields", async () => {
  const { cwd, env } = setup();
  const line = memoryIo({ env, cwd });
  assert.equal(await run(["receipts", "--stops"], line, commands), 0);
  const summary = line.json();
  assert.equal(summary["verdict"], "stops");
  assert.equal(summary["stops"], undefined);
  assert.equal(JSON.parse(readFileSync(String(summary["details"]), "utf8")).stops.length, 8);
  const io = memoryIo({ env, cwd });
  assert.equal(await run(["receipts", "--stops", "--pretty"], io, commands), 0);
  const out = io.json();
  assert.equal((out["stats"] as { stops: number }).stops, 8);
  const stops = out["stops"] as Record<string, unknown>[];
  assert.equal(stops.length, 8);
  assert.equal(stops[0]?.["id"], "s1");
  const s4 = stops.find((s) => s["id"] === "s4");
  assert.deepEqual(s4, { id: "s4", ts: "2026-09-29T10:00:00.000Z", edits: 2, checks: 1, would_block: true, claims_done: 3, claims_verified: 1, task_excerpt: "task s4", final_excerpt: "final s4", label: "right" });
  assert.equal(stops.find((s) => s["id"] === "s1")?.["skipped"], "no_edits");
  const text = io.out.join("");
  for (const hidden of ["session-private-1", "someone-else", "other", "verification_applies", "outcome", "\"ms\"", "labelled_at"]) assert.ok(!text.includes(hidden), hidden);
});

test("receipts --stops caps the list at 20 and --days windows it", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const project = projectId(cwd);
  for (let i = 0; i < 25; i++) appendStop(dataDir, rec(`s${i}`, { project, ts: `2026-09-29T10:00:${String(i).padStart(2, "0")}.000Z` }));
  appendStop(dataDir, rec("old", { project, ts: "2026-01-01T00:00:00.000Z" }));
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  await run(["receipts", "--stops", "--pretty"], io, commands);
  const out = io.json();
  const stops = out["stops"] as { id: string }[];
  assert.equal(stops.length, 20);
  assert.equal(stops[0]?.id, "s24");
  assert.equal((out["stats"] as { stops: number }).stops, 25);
});

test("receipts --stops --unlabelled lists only unlabelled would_block stops", async () => {
  const { cwd, env } = setup();
  const io = memoryIo({ env, cwd });
  await run(["receipts", "--stops", "--unlabelled"], io, commands);
  const stops = io.json()["stops"] as { id: string }[];
  assert.deepEqual(stops.map((s) => s.id), ["s7"]);
});

test("receipts --label marks a stop, rejects unknown ids and missing direction", async () => {
  const { dataDir, cwd, env } = setup();
  const right = memoryIo({ env, cwd });
  assert.equal(await run(["receipts", "--label", "s7", "--right"], right, commands), 0);
  assert.deepEqual(right.json(), { ok: true, verdict: "labelled", id: "s7", label: "right" });
  const wrong = memoryIo({ env, cwd });
  assert.equal(await run(["receipts", "--label", "s4", "--wrong"], wrong, commands), 0);
  assert.equal(wrong.json()["label"], "wrong");
  const stored = readStops(dataDir);
  assert.equal(stored.find((r) => r.id === "s7")?.label, "right");
  assert.equal(stored.find((r) => r.id === "s4")?.label, "wrong");
  assert.equal(stored.find((r) => r.id === "s7")?.labelled_at, "2026-09-30T12:00:00.000Z");

  const unknown = memoryIo({ env, cwd });
  assert.equal(await run(["receipts", "--label", "nope", "--right"], unknown, commands), 1);
  assert.equal(unknown.json()["error"], "bad_input");
  assert.ok(unknown.json()["next_step"]);
  for (const flags of [[], ["--right", "--wrong"]]) {
    const bad = memoryIo({ env, cwd });
    assert.equal(await run(["receipts", "--label", "s7", ...flags], bad, commands), 1);
    assert.equal(bad.json()["error"], "bad_input");
  }

  const after = memoryIo({ env, cwd });
  await run(["receipts", "--stops", "--unlabelled"], after, commands);
  assert.deepEqual(after.json()["stops"], []);
});

test("receipts --describe documents the stops flags", async () => {
  const io = memoryIo();
  assert.equal(await run(["receipts", "--describe"], io, commands), 0);
  const text = JSON.stringify(io.json());
  for (const flag of ["--stops", "--label <id>", "--right", "--wrong", "--unlabelled"]) assert.ok(text.includes(flag), flag);
  assert.ok(text.includes("precision") && text.includes("labelled"));
});

test("appendStop never throws on an unwritable directory", () => {
  const base = tempDir();
  const blocker = join(base, "file");
  writeFileSync(blocker, "x");
  assert.doesNotThrow(() => appendStop(join(blocker, "sub"), rec("s1")));
  assert.deepEqual(readStops(join(blocker, "sub")), []);
});

test("appendStop prunes records older than 90 days once the file passes 2 MB", () => {
  const dir = tempDir();
  const old = rec("old", { ts: "2020-01-01T00:00:00.000Z", task_excerpt: "x".repeat(1000) });
  const line = JSON.stringify(old) + "\n";
  writeFileSync(stopsFile(dir), line.repeat(2100));
  appendStop(dir, rec("fresh", { ts: new Date().toISOString() }));
  assert.deepEqual(readStops(dir).map((r) => r.id), ["fresh"]);
});
