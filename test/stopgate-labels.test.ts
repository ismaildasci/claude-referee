// Clopper-Pearson interval against published values, the threshold suggestion gate, and the weak next-message hint.
// referenceInterval is the interval as computed before log C(n, k) was reused across the bisection: the reference for bit-identical results.
// The hint reads past a prompt that is only a pasted image: it is neither the next prompt nor the turn's prompt.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { projectId } from "../src/engine/datadir.ts";
import { clopperPearson, suggestThreshold } from "../src/engine/stopgate/interval.ts";
import { appendStop, labelStop, readStops } from "../src/engine/stopgate/stops.ts";
import type { StopRecord } from "../src/engine/stopgate/types.ts";
import { classifyNext, suggestFromTranscript } from "../src/engine/stopgate/weak.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const near = (a: number, b: number, eps = 5e-4) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("clopperPearson matches known 95% values", () => {
  const cases: [number, number, number, number][] = [
    [5, 10, 0.187086, 0.812914],
    [1, 10, 0.002529, 0.445016],
    [10, 20, 0.272, 0.728],
    [50, 100, 0.3983, 0.6017],
    [0, 10, 0, 1 - 0.025 ** (1 / 10)],
    [10, 10, 0.025 ** (1 / 10), 1],
    [0, 1, 0, 0.975],
  ];
  for (const [x, n, lo, hi] of cases) {
    const ci = clopperPearson(x, n);
    near(ci.lower, lo);
    near(ci.upper, hi);
  }
  const narrow = clopperPearson(5, 10, 0.9);
  assert.ok(narrow.lower > clopperPearson(5, 10).lower && narrow.upper < clopperPearson(5, 10).upper);
  assert.throws(() => clopperPearson(11, 10), RangeError);
  assert.throws(() => clopperPearson(0, 0), RangeError);
});

function referenceInterval(x: number, n: number, confidence = 0.95): { lower: number; upper: number } {
  const logChoose = (k: number) => {
    let sum = 0;
    for (let i = 1; i <= k; i++) sum += Math.log((n - k + i) / i);
    return sum;
  };
  const pmf = (k: number, p: number) => (p <= 0 ? (k === 0 ? 1 : 0) : p >= 1 ? (k === n ? 1 : 0) : Math.exp(logChoose(k) + k * Math.log(p) + (n - k) * Math.log1p(-p)));
  const cdf = (upTo: number, p: number) => {
    let sum = 0;
    for (let k = 0; k <= upTo; k++) sum += pmf(k, p);
    return Math.min(1, sum);
  };
  const bisect = (f: (p: number) => number, target: number, increasing: boolean) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < target === increasing) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const alpha = (1 - confidence) / 2;
  return { lower: x === 0 ? 0 : bisect((p) => 1 - cdf(x - 1, p), alpha, true), upper: x === n ? 1 : bisect((p) => cdf(x, p), alpha, false) };
}

test("clopperPearson is bit-identical to the previous computation on a grid", () => {
  const grid: [number, number, number?][] = [];
  for (let n = 1; n <= 40; n++) for (let x = 0; x <= n; x++) grid.push([x, n]);
  grid.push([95, 100], [180, 200], [3, 200], [100, 100], [0, 150], [7, 30, 0.9], [29, 30, 0.99]);
  for (const [x, n, confidence] of grid) assert.deepEqual(clopperPearson(x, n, confidence), referenceInterval(x, n, confidence), `${x}/${n}`);
});

test("clopperPearson stays fast on large n (it took about 20 s at 5000 of 10000)", () => {
  const t0 = performance.now();
  const ci = clopperPearson(5000, 10000);
  const ms = performance.now() - t0;
  near(ci.lower, 0.4902);
  near(ci.upper, 0.5098);
  assert.ok(ms < 2000, `took ${ms.toFixed(0)} ms`);
});

function stop(id: string, label: "right" | "wrong" | undefined, claimsDone: number, extra: Partial<StopRecord> = {}): StopRecord {
  return {
    id,
    ts: "2026-09-29T10:00:00.000Z",
    session_id: "sess",
    project: "p",
    mode: "shadow",
    edits: 1,
    checks: 0,
    ms: 10,
    decision: { claims_done: claimsDone, claims_verified: 0.1, verification_applies: 0.9, outcome: {}, would_block: true },
    ...(label ? { label } : {}),
    ...extra,
  };
}

test("suggestThreshold needs 10 human labels per class", () => {
  const nine = [...Array.from({ length: 9 }, (_, i) => stop(`r${i}`, "right", 0.9)), ...Array.from({ length: 30 }, (_, i) => stop(`w${i}`, "wrong", 0.9))];
  const s = suggestThreshold(nine, 0.7);
  assert.equal(s.available, false);
  assert.equal(s.suggested, null);
  assert.equal(s.reason, "too_few_labels");
  assert.deepEqual(s.have, { right: 9, wrong: 30 });
  assert.equal(s.overall, undefined);
  const unlabelled = suggestThreshold([...nine, stop("u", undefined, 0.99)], 0.7);
  assert.deepEqual(unlabelled.have, { right: 9, wrong: 30 });
});

test("suggestThreshold raises claims_done only to the smallest value that meets the bound, never lowers", () => {
  const records = [
    ...Array.from({ length: 20 }, (_, i) => stop(`r${i}`, "right", 0.95)),
    ...Array.from({ length: 12 }, (_, i) => stop(`w${i}`, "wrong", 0.75)),
  ];
  const s = suggestThreshold(records, 0.7);
  assert.equal(s.available, true);
  assert.equal(s.reason, "raise_claims_done");
  assert.equal(s.suggested, 0.95);
  assert.deepEqual(s.kept?.right, 20);
  assert.ok((s.kept?.precision_ci95[0] ?? 0) >= 0.8);
  assert.ok(s.overall && s.overall.precision === 0.625);
  const high = suggestThreshold(records, 0.97);
  assert.equal(high.suggested, null);
  assert.equal(high.reason, "no_threshold_reaches_target");
  const fine = suggestThreshold(records.filter((r) => r.label === "right").concat(Array.from({ length: 10 }, (_, i) => stop(`x${i}`, "wrong", 0.4))), 0.7);
  assert.equal(fine.reason, "already_meets_target");
  assert.equal(fine.suggested, 0.7);
  const mixed = suggestThreshold([...Array.from({ length: 12 }, (_, i) => stop(`m${i}`, "right", 0.9)), ...Array.from({ length: 12 }, (_, i) => stop(`n${i}`, "wrong", 0.9))], 0.7);
  assert.equal(mixed.suggested, null);
});

test("classifyNext maps breakage and repeats, ignores approval and unrelated text", () => {
  assert.equal(classifyNext("It still doesn't work, the page is blank", "add a login page"), "reported_broken");
  assert.equal(classifyNext("Testler hâlâ hata veriyor", "login ekle"), "reported_broken");
  assert.equal(classifyNext("çalışmıyor bu", "x"), "reported_broken");
  assert.equal(classifyNext("please add a login page with email and password", "add a login page with email and password please"), "repeated_request");
  assert.equal(classifyNext("thanks, looks good, commit it", "add a login page"), null);
  assert.equal(classifyNext("now add error handling to the parser", "add a login page"), null);
  assert.equal(classifyNext("", ""), null);
});

test("classifyNext does not hint on negated, hypothetical, instruction or positive phrasing", () => {
  const quiet = [
    "do not run the tests yet, just add the feature",
    "please add a failing test for the parser",
    "thanks, it works now! it no longer crashes",
    "great, tests are passing, not broken anymore",
    "it's not working? no wait, it works",
    "great, tests are still passing, nothing broken",
    "thanks, build is not failing anymore",
    "no crash, all good",
    "harika, artık çalışıyor, bozuk bir şey yok",
    "still working on it myself, continue",
    "do not work on the parser",
    "if it doesn't work I will tell you",
    "make sure the tests do not pass without the fix",
  ];
  for (const msg of quiet) assert.equal(classifyNext(msg, "x"), null, msg);
  const loud = ["the build is failing with a type error", "it crashes on login", "tests are still failing", "great idea but it doesn't work", "hâlâ hata veriyor"];
  for (const msg of loud) assert.equal(classifyNext(msg, "x"), "reported_broken", msg);
});

function transcriptLine(type: string, ts: string, content: unknown): string {
  return JSON.stringify({ type, timestamp: ts, message: { role: type, content } });
}

test("the hint reads past an image-only prompt, after the stop and as the turn's prompt", () => {
  const image = [{ type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } }];
  const after = [
    transcriptLine("user", "2026-09-29T09:00:00.000Z", "add a login page"),
    transcriptLine("assistant", "2026-09-29T09:05:00.000Z", [{ type: "text", text: "done" }]),
    transcriptLine("user", "2026-09-29T09:10:00.000Z", image),
    transcriptLine("user", "2026-09-29T09:11:00.000Z", "it still doesn't work"),
  ].join("\n");
  assert.deepEqual(suggestFromTranscript(after, "2026-09-29T09:06:00.000Z"), { label: "right", reason: "reported_broken", source: "next_message" });
  const turn = [
    transcriptLine("user", "2026-09-29T09:00:00.000Z", "add a login page with email and password"),
    transcriptLine("assistant", "2026-09-29T09:05:00.000Z", [{ type: "text", text: "done" }]),
    transcriptLine("user", "2026-09-29T09:10:00.000Z", image),
    transcriptLine("assistant", "2026-09-29T09:14:00.000Z", [{ type: "text", text: "done" }]),
    transcriptLine("user", "2026-09-29T09:20:00.000Z", "please add a login page with email and password"),
  ].join("\n");
  assert.deepEqual(suggestFromTranscript(turn, "2026-09-29T09:15:00.000Z"), { label: "right", reason: "repeated_request", source: "next_message" });
  assert.equal(suggestFromTranscript(turn.split("\n").slice(0, 4).join("\n"), "2026-09-29T09:15:00.000Z"), null);
});

test("receipts --stops shows the hint for unlabelled would_block stops, never for labelled, never the text", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const home = tempDir();
  const project = projectId(cwd);
  const secretText = "it is broken and my token is hunter2-private-text";
  const dir = join(home, ".claude", "projects", cwd.replace(/[^A-Za-z0-9]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "sess-1.jsonl"),
    [
      transcriptLine("user", "2026-09-29T09:00:00.000Z", "add a login page"),
      transcriptLine("assistant", "2026-09-29T09:05:00.000Z", [{ type: "text", text: "done" }]),
      transcriptLine("user", "2026-09-29T10:30:00.000Z", secretText),
      transcriptLine("assistant", "2026-09-29T10:35:00.000Z", [{ type: "text", text: "fixed" }]),
    ].join("\n") + "\n",
  );
  appendStop(dataDir, stop("a", undefined, 0.9, { project, session_id: "sess-1", ts: "2026-09-29T09:06:00.000Z" }));
  appendStop(dataDir, stop("b", "right", 0.9, { project, session_id: "sess-1", ts: "2026-09-29T09:06:00.000Z" }));
  appendStop(dataDir, stop("c", undefined, 0.9, { project, session_id: "sess-1", ts: "2026-09-29T10:36:00.000Z" }));
  appendStop(dataDir, stop("d", undefined, 0.9, { project, session_id: "../evil", ts: "2026-09-29T09:06:00.000Z" }));
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd, home });
  assert.equal(await run(["receipts", "--stops", "--pretty"], io, commands), 0);
  const out = io.json();
  const stops = out["stops"] as { id: string; suggestion?: unknown; label?: string }[];
  const by = (id: string) => stops.find((s) => s.id === id);
  assert.deepEqual(by("a")?.suggestion, { label: "right", reason: "reported_broken", source: "next_message" });
  assert.equal(by("b")?.suggestion, undefined);
  assert.equal(by("b")?.label, "right");
  assert.equal(by("c")?.suggestion, undefined);
  assert.equal(by("d")?.suggestion, undefined);
  assert.ok(!io.out.join("").includes("hunter2"));
  assert.equal((out["stats"] as { labelled: number }).labelled, 1);
  const ts = out["threshold_suggestion"] as { available: boolean };
  assert.equal(ts.available, false);

  assert.equal(labelStop(dataDir, "a", "wrong", "2026-09-30T12:00:00.000Z"), true);
  assert.equal(readStops(dataDir).find((r) => r.id === "a")?.label, "wrong");
  const again = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd, home });
  await run(["receipts", "--stops", "--pretty"], again, commands);
  const after = (again.json()["stops"] as { id: string; suggestion?: unknown; label?: string }[]).find((s) => s.id === "a");
  assert.equal(after?.label, "wrong");
  assert.equal(after?.suggestion, undefined);
});

test("receipts --describe documents the suggestion fields", async () => {
  const io = memoryIo();
  await run(["receipts", "--describe"], io, commands);
  const text = JSON.stringify(io.json());
  for (const word of ["threshold_suggestion", "Clopper-Pearson", "suggestion", "reported_broken", "repeated_request"]) assert.ok(text.includes(word), word);
});
