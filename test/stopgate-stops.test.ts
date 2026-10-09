// Stop done-gate store and labelling CLI: append/read, label rewrite, stats arithmetic, receipts --stops, --unlabelled, --label.
// Pruning past 2 MB: throttled by the oldest record, a lock taken without waiting, and lines appended during the rewrite are kept.
// An append that reached the renamed-away file is written again, and a stop id stored twice reads and counts once.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs, { appendFileSync, existsSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
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

test("receipts --stops shows the error code and the configured mode a stop record carries", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const project = projectId(cwd);
  appendStop(dataDir, rec("sfail", { project, ts: "2026-09-29T11:00:00.000Z", skipped: "jev_error", error: "service_unavailable" }));
  appendStop(dataDir, rec("sactive", { project, ts: "2026-09-29T10:00:00.000Z", block: true, configured: "active" }));
  appendStop(dataDir, rec("splain", { project, ts: "2026-09-29T09:00:00.000Z", block: false }));
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  assert.equal(await run(["receipts", "--stops", "--pretty"], io, commands), 0);
  const stops = io.json()["stops"] as Record<string, unknown>[];
  const by = (id: string) => stops.find((s) => s["id"] === id) ?? {};
  assert.deepEqual({ skipped: by("sfail")["skipped"], error: by("sfail")["error"], configured: by("sfail")["configured"] }, { skipped: "jev_error", error: "service_unavailable", configured: undefined });
  assert.deepEqual({ error: by("sactive")["error"], configured: by("sactive")["configured"] }, { error: undefined, configured: "active" });
  assert.ok(!("error" in by("splain")) && !("configured" in by("splain")));
});

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

test("stopStats counts Jev errors and times every attempt, so slow failures are not hidden", () => {
  const set: StopRecord[] = [
    rec("a1", { block: false, ms: 100 }),
    rec("a2", { block: false, ms: 200 }),
    rec("a3", { block: true, ms: 300 }),
    rec("e1", { skipped: "jev_error", ms: 2000 }),
    rec("e2", { skipped: "jev_error", ms: 1900 }),
    rec("b1", { skipped: "breaker_open", ms: 1 }),
    rec("n1", { skipped: "no_edits", ms: 1 }),
  ];
  const s = stopStats(set);
  assert.equal(s.p95_ms, 300);
  assert.equal(s.errors, 3);
  assert.equal(s.error_rate, 3 / 6);
  assert.equal(s.p95_all_ms, 2000);
  const clean = stopStats(FIXED);
  assert.equal(clean.errors, 0);
  assert.equal(clean.error_rate, 0);
  assert.equal(clean.p95_all_ms, 400);
  assert.equal(stopStats([rec("n", { skipped: "no_edits" })]).error_rate, null);
  assert.equal(stopStats([]).p95_all_ms, null);
});

test("labelStop never rewrites stops.jsonl: labels go to labels.jsonl and are merged on read, last one wins", () => {
  const dir = tempDir();
  appendStop(dir, rec("s1", { block: true }));
  const before = readFileSync(stopsFile(dir), "utf8");
  assert.equal(labelStop(dir, "s1", "wrong", "2026-09-30T12:00:00.000Z"), true);
  assert.equal(readFileSync(stopsFile(dir), "utf8"), before);
  appendStop(dir, rec("s2", { block: true }));
  assert.equal(labelStop(dir, "s1", "right", "2026-09-30T13:00:00.000Z"), true);
  const read = readStops(dir);
  assert.deepEqual(read.map((r) => r.id), ["s1", "s2"]);
  assert.equal(read[0]?.label, "right");
  assert.equal(read[0]?.labelled_at, "2026-09-30T13:00:00.000Z");
  assert.equal(read[1]?.label, undefined);
  assert.equal(stopStats(read).labelled, 1);
});

test("a label written inline by an older version is still read, and a newer label overrides it", () => {
  const dir = tempDir();
  appendStop(dir, rec("s1", { block: true, label: "right" as const, labelled_at: "2026-09-29T10:00:00.000Z" } as never));
  assert.equal(readStops(dir)[0]?.label, "right");
  labelStop(dir, "s1", "wrong", "2026-09-30T10:00:00.000Z");
  assert.equal(readStops(dir)[0]?.label, "wrong");
});

test("labelling an unknown id writes nothing", () => {
  const dir = tempDir();
  appendStop(dir, rec("s1", { block: true }));
  assert.equal(labelStop(dir, "nope", "right", "2026-09-30T12:00:00.000Z"), false);
  assert.equal(existsSync(join(dir, "labels.jsonl")), false);
});

test("records written before the marks existed still read and count", () => {
  const dir = tempDir();
  const old = { id: "sold1", ts: "2026-10-01T10:00:00.000Z", session_id: "s", project: "p", mode: "shadow", edits: 1, checks: 0, decision: { claims_done: 0.9, claims_verified: 0.1, verification_applies: 0.9, outcome: { complete: 0.9 }, would_block: true }, ms: 10 };
  const marked = { ...old, id: "snew1", truncated_checks: 1, subagent_calls: 2, subagent_reports: 1, stale_pass: true };
  writeFileSync(join(dir, "stops.jsonl"), JSON.stringify(old) + "\n" + JSON.stringify(marked) + "\n");
  const stops = readStops(dir);
  assert.equal(stops.length, 2);
  assert.equal(stopStats(stops).would_block, 2);
  assert.equal(stops[1]?.stale_pass, true);
});

const DAY = 86_400_000;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const fill = (prefix: string, count: number, ts: () => string) => Array.from({ length: count }, (_, i) => JSON.stringify(rec(`${prefix}${i}`, { ts: ts(), task_excerpt: "x".repeat(1000) }))).join("\n") + "\n";
const leftovers = (dir: string) => readdirSync(dir).filter((f) => f !== "stops.jsonl");

test("past 2 MB with only fresh records an append never rewrites the file", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), fill("f", 2100, () => isoAgo(DAY)));
  const inode = statSync(stopsFile(dir)).ino;
  appendStop(dir, rec("new", { ts: new Date().toISOString() }));
  appendStop(dir, rec("new2", { ts: new Date().toISOString() }));
  assert.equal(statSync(stopsFile(dir)).ino, inode);
  assert.equal(readStops(dir).length, 2102);
  assert.deepEqual(leftovers(dir), []);
});

test("a first record longer than the head that is read never makes every append rewrite the file", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), JSON.stringify(rec("big", { ts: isoAgo(DAY), task_excerpt: "y".repeat(20_000) })) + "\n" + fill("f", 2100, () => isoAgo(DAY)));
  const inode = statSync(stopsFile(dir)).ino;
  appendStop(dir, rec("new", { ts: new Date().toISOString() }));
  assert.equal(statSync(stopsFile(dir)).ino, inode);
  assert.equal(readStops(dir).length, 2102);
});

test("pruning keeps fresh records, runs once, and is not repeated until the oldest record ages a day past retention", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), fill("old", 1000, () => "2020-01-01T00:00:00.000Z") + fill("edge", 5, () => isoAgo(90 * DAY - 3_600_000)) + fill("f", 2100, () => isoAgo(DAY)));
  const before = statSync(stopsFile(dir)).ino;
  appendStop(dir, rec("new", { ts: new Date().toISOString() }));
  const after = statSync(stopsFile(dir));
  assert.notEqual(after.ino, before);
  const ids = readStops(dir).map((r) => r.id);
  assert.equal(ids.length, 2106);
  assert.equal(ids.filter((id) => id.startsWith("old")).length, 0);
  assert.equal(ids.at(-1), "new");
  assert.deepEqual(leftovers(dir), []);
  if (process.platform !== "win32") assert.equal(after.mode & 0o777, 0o600);
  appendStop(dir, rec("new2", { ts: new Date().toISOString() }));
  assert.equal(statSync(stopsFile(dir)).ino, after.ino);
});

test("another session holding the lock means no pruning now; a stale lock is cleared for the next append", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), fill("old", 2100, () => "2020-01-01T00:00:00.000Z"));
  const lock = `${stopsFile(dir)}.lock`;
  writeFileSync(lock, "");
  appendStop(dir, rec("a", { ts: new Date().toISOString() }));
  assert.equal(readStops(dir).length, 2101);
  assert.ok(existsSync(lock));
  const minuteAgo = new Date(Date.now() - 60_000);
  utimesSync(lock, minuteAgo, minuteAgo);
  appendStop(dir, rec("b", { ts: new Date().toISOString() }));
  assert.equal(readStops(dir).length, 2102);
  assert.equal(existsSync(lock), false);
  appendStop(dir, rec("c", { ts: new Date().toISOString() }));
  assert.deepEqual(readStops(dir).map((r) => r.id), ["a", "b", "c"]);
});

test("lines another session appends while the file is rewritten are kept", () => {
  const dir = tempDir();
  const file = stopsFile(dir);
  writeFileSync(file, fill("old", 2100, () => "2020-01-01T00:00:00.000Z"));
  const realRename = fs.renameSync;
  fs.renameSync = (from: fs.PathLike, to: fs.PathLike) => {
    if (String(to) !== file) return realRename(from, to);
    appendFileSync(file, JSON.stringify(rec("before-swap", { ts: new Date().toISOString() })) + "\n");
    const late = fs.openSync(file, "a");
    realRename(from, to);
    fs.writeSync(late, JSON.stringify(rec("after-swap", { ts: new Date().toISOString() })) + "\n");
    fs.closeSync(late);
  };
  syncBuiltinESMExports();
  try {
    appendStop(dir, rec("trigger", { ts: new Date().toISOString() }));
  } finally {
    fs.renameSync = realRename;
    syncBuiltinESMExports();
  }
  assert.deepEqual(readStops(dir).map((r) => r.id), ["trigger", "before-swap", "after-swap"]);
  assert.deepEqual(leftovers(dir), []);
});

function aroundAppend(id: string, around: (write: () => void) => void, body: () => void): void {
  const realWrite = fs.writeSync;
  let fired = false;
  fs.writeSync = ((...args: unknown[]) => {
    const data = args[1];
    if (fired || typeof data !== "string" || !data.includes(`"id":"${id}"`)) return Reflect.apply(realWrite, fs, args) as number;
    fired = true;
    let written = 0;
    around(() => {
      written = Reflect.apply(realWrite, fs, args) as number;
    });
    return written;
  }) as typeof fs.writeSync;
  syncBuiltinESMExports();
  try {
    body();
  } finally {
    fs.writeSync = realWrite;
    syncBuiltinESMExports();
  }
  assert.ok(fired, `no write of ${id}`);
}

test("an append that lands on the file another session's pruning renamed away is written again", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), fill("old", 2100, () => "2020-01-01T00:00:00.000Z"));
  aroundAppend(
    "late",
    (write) => {
      appendStop(dir, rec("trigger", { ts: new Date().toISOString() }));
      write();
    },
    () => appendStop(dir, rec("late", { ts: new Date().toISOString() })),
  );
  assert.deepEqual(readStops(dir).map((r) => r.id), ["trigger", "late"]);
  assert.deepEqual(leftovers(dir), []);
});

test("a stop the pruning copied and the append wrote again is read and counted once", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), fill("old", 2100, () => "2020-01-01T00:00:00.000Z"));
  aroundAppend(
    "late",
    (write) => {
      write();
      appendStop(dir, rec("trigger", { ts: new Date().toISOString() }));
    },
    () => appendStop(dir, rec("late", { ts: new Date().toISOString(), block: true })),
  );
  const raw = readFileSync(stopsFile(dir), "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as StopRecord).id);
  assert.deepEqual(raw, ["late", "trigger", "late"]);
  assert.equal(labelStop(dir, "late", "right", "2026-10-06T12:00:00.000Z"), true);
  const stops = readStops(dir);
  assert.deepEqual(stops.map((r) => r.id), ["late", "trigger"]);
  const s = stopStats(stops);
  assert.equal(s.stops, 2);
  assert.equal(s.would_block, 1);
  assert.equal(s.labelled, 1);
});

test("pruning writes a stop id stored twice once", () => {
  const dir = tempDir();
  const twice = JSON.stringify(rec("d", { ts: new Date().toISOString() })) + "\n";
  writeFileSync(stopsFile(dir), fill("old", 2100, () => "2020-01-01T00:00:00.000Z") + twice + twice);
  appendStop(dir, rec("t", { ts: new Date().toISOString() }));
  const raw = readFileSync(stopsFile(dir), "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as StopRecord).id);
  assert.deepEqual(raw, ["d", "t"]);
});

test("parallel sessions appending past 2 MB lose no record", async () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), fill("f", 2100, () => isoAgo(DAY)));
  const worker = join(tempDir(), "append.ts");
  const stops = fileURLToPath(new URL("../src/engine/stopgate/stops.ts", import.meta.url));
  writeFileSync(worker, `import { appendStop } from ${JSON.stringify(pathToFileURL(stops).href)};\nconst [dir, tag] = process.argv.slice(2);\nfor (let i = 0; i < 40; i++) appendStop(dir, { id: tag + "-" + i, ts: new Date().toISOString(), session_id: tag, project: "p", mode: "shadow", skipped: "no_edits", edits: 0, checks: 0, ms: 1 });\n`);
  const tags = Array.from({ length: 8 }, (_, i) => `w${i}`);
  const codes = await Promise.all(tags.map((tag) => new Promise<number | null>((resolve) => spawn(process.execPath, [worker, dir, tag], { stdio: "ignore" }).on("close", resolve))));
  assert.deepEqual(codes, tags.map(() => 0));
  const ids = new Set(readStops(dir).map((r) => r.id));
  for (const tag of tags) for (let i = 0; i < 40; i++) assert.ok(ids.has(`${tag}-${i}`), `${tag}-${i}`);
  assert.equal(ids.size, 2100 + 320);
});

test("stats and readers tolerate skip reasons they do not know, old or new", () => {
  const dir = tempDir();
  writeFileSync(stopsFile(dir), [rec("h", { skipped: "hooks_off" as never }), rec("c", { skipped: "credential", error: "credential_in_state" }), rec("k", { skipped: "no_key", error: "no_api_key" }), rec("g", { skipped: "config_error", error: "pack_not_found" }), rec("j", { skipped: "jev_error", error: "timeout", ms: 2000 }), rec("a", { block: true, ms: 300 })].map((r) => JSON.stringify(r)).join("\n") + "\n");
  const s = stopStats(readStops(dir));
  assert.equal(s.stops, 6);
  assert.deepEqual(s.skipped_by_reason, { hooks_off: 1, credential: 1, no_key: 1, config_error: 1, jev_error: 1 });
  assert.equal(s.errors, 1);
  assert.equal(s.error_rate, 1 / 2);
  assert.equal(s.p95_all_ms, 2000);
});

test("background skips with counts never count as asked or as errors; records without turn, bg_pending or would_ask still read", () => {
  const dir = tempDir();
  const old = { id: "sold2", ts: "2026-10-01T10:00:00.000Z", session_id: "s", project: "p", mode: "shadow", skipped: "background_tasks", edits: 0, checks: 0, ms: 1 };
  const asked = rec("sask", { block: true, ms: 300, turn: "aaaaaaaaaaaa" });
  const bg = rec("sbg", { skipped: "background_tasks", edits: 3, checks: 1, bg_pending: 2, would_ask: true, turn: "aaaaaaaaaaaa", ms: 9000 });
  const bgNo = rec("sbg2", { skipped: "background_tasks", edits: 0, checks: 0, bg_pending: 1, would_ask: false, ms: 5 });
  writeFileSync(join(dir, "stops.jsonl"), [old, asked, bg, bgNo].map((r) => JSON.stringify(r)).join("\n") + "\n");
  const stops = readStops(dir);
  assert.equal(stops.length, 4);
  assert.equal(stops[0]?.turn, undefined);
  assert.equal(stops[2]?.would_ask, true);
  const s = stopStats(stops);
  assert.equal(s.asked, 1);
  assert.equal(s.errors, 0);
  assert.equal(s.error_rate, 0);
  assert.equal(s.p95_ms, 300);
  assert.equal(s.p95_all_ms, 300);
  assert.deepEqual(s.skipped_by_reason, { background_tasks: 3 });
});

test("receipts --stops shows turn, bg_pending and would_ask when a record has them, and nothing new for older records", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const project = projectId(cwd);
  appendStop(dataDir, rec("sbg", { project, ts: "2026-09-29T11:00:00.000Z", skipped: "background_tasks", edits: 2, checks: 0, bg_pending: 1, would_ask: true, turn: "0123456789ab" }));
  appendStop(dataDir, rec("sold", { project, ts: "2026-09-29T10:00:00.000Z", skipped: "background_tasks", edits: 0, checks: 0 }));
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  assert.equal(await run(["receipts", "--stops", "--pretty"], io, commands), 0);
  const out = io.json();
  const stops = out["stops"] as Record<string, unknown>[];
  assert.deepEqual(stops[0], { id: "sbg", ts: "2026-09-29T11:00:00.000Z", skipped: "background_tasks", edits: 2, checks: 0, turn: "0123456789ab", bg_pending: 1, would_ask: true });
  assert.deepEqual(stops[1], { id: "sold", ts: "2026-09-29T10:00:00.000Z", skipped: "background_tasks", edits: 0, checks: 0 });
  assert.equal((out["stats"] as { asked: number; errors: number }).asked, 0);
  assert.equal((out["stats"] as { asked: number; errors: number }).errors, 0);
});
