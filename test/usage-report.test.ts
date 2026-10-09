// The four usage measures of scripts/usage-report.mjs (docs/decisions/usage-report.md), on invented receipts, stops and labels.

import assert from "node:assert/strict";
import { test } from "node:test";
import { measures } from "../scripts/usage-report.mjs";

const T = (min: number): string => new Date(Date.parse("2026-10-09T12:00:00Z") + min * 60_000).toISOString();
const since = Date.parse("2026-10-09T11:00:00Z");

test("edit turns with a counted check count turns, not stops, and respect the window", () => {
  const stops = [
    { ts: T(0), turn: "a", edits: 2, checks: 0 },
    { ts: T(1), turn: "a", edits: 2, checks: 1 },
    { ts: T(2), turn: "b", edits: 1, checks: 0 },
    { ts: T(3), turn: "c", edits: 0, checks: 3 },
    { ts: T(4) },
    { ts: "2026-10-01T00:00:00Z", turn: "old", edits: 4, checks: 0 },
  ];
  assert.deepEqual(measures({ receipts: [], stops, labels: [], since }).edit_turns_with_check, { k: 1, n: 2, share: 0.5 });
  assert.deepEqual(measures({ receipts: [], stops: [], labels: [], since }).edit_turns_with_check, { k: 0, n: 0, share: null });
});

test("a re-ask is the next decide of the session within 10 minutes of a non-clear one", () => {
  const d = (id: string, min: number, verdict: string, session = "s1") => ({ id, ts: T(min), command: "decide", verdict, session_id: session });
  const receipts = [d("1", 0, "weak"), d("2", 5, "clear"), d("3", 30, "tie"), d("4", 50, "weak"), d("5", 55, "weak"), d("6", 56, "clear"), d("7", 0, "weak", "s2"), d("8", 1, "clear", "s3")];
  assert.deepEqual(measures({ receipts, stops: [], labels: [], since }).reask_cleared, { k: 2, n: 3, share: 0.667 });
});

test("exit-code-only missing counts by evidence size, and labels join the receipt's verdict", () => {
  const done = (id: string, verdict: string, outcome: { trust?: string; evidence_lines?: number }) => ({ id, ts: T(1), command: "done", verdict, outcome });
  const receipts = [
    done("a", "missing", { trust: "exit_code", evidence_lines: 2 }),
    done("b", "missing", { trust: "exit_code", evidence_lines: 40 }),
    done("c", "missing", { trust: "exit_code" }),
    done("d", "missing", { trust: "parsed" }),
    done("e", "met", { trust: "parsed" }),
    done("f", "met", { trust: "exit_code" }),
  ];
  const labels = [{ id: "e", label: "right" as const }, { id: "f", label: "wrong" as const }, { id: "zzz", label: "right" as const }];
  const m = measures({ receipts, stops: [], labels, since });
  assert.deepEqual(m.exit_only_missing, { k: 3, n: 4, share: 0.75, evidence_lines_under_5: 1, evidence_lines_5_or_more: 1, evidence_lines_unknown: 1 });
  assert.deepEqual(m.labels, { met: { right: 1, wrong: 1 } });
});

test("the output holds counts only: ids, criteria and session ids never appear", () => {
  const receipts = [{ id: "secret-id", ts: T(0), command: "decide", verdict: "weak", session_id: "secret-session" }];
  const text = JSON.stringify(measures({ receipts, stops: [{ ts: T(0), turn: "secret-turn", edits: 1, checks: 0 }], labels: [{ id: "secret-id", label: "right" }], since }));
  assert.doesNotMatch(text, /secret/);
});
