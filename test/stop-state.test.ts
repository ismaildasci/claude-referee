// Stop-state study helpers: AUC and exact permutation p, dev threshold, task split, change-content rule, truncation and score orientation.

import assert from "node:assert/strict";
import { test } from "node:test";
import { changes, configs, extractTurn, scoreOf, splitTasks } from "../scripts/stop-state/features.mjs";
import { auc, bootstrap, devThreshold, permutationP } from "../scripts/stop-state/stats.mjs";

const use = (id: string, name: string, input: Record<string, unknown>) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const jsonl = (entries: unknown[]) => entries.map((e) => JSON.stringify(e)).join("\n");
const prompt = { type: "user", message: { content: "implement it" } };

test("auc counts ties half and the permutation p is exact", () => {
  assert.equal(auc([0.9, 0.8], [0.1, 0.2, 0.3]), 1);
  assert.equal(auc([0.5], [0.5]), 0.5);
  assert.equal(permutationP([0.9, 0.8], [0.1, 0.2, 0.3]), 0.1);
  assert.equal(permutationP([0.5], [0.5, 0.5]), 1);
});

test("dev threshold is the highest score that keeps recall at 0.8", () => {
  const rows = [0.9, 0.8, 0.7, 0.6, 0.2].map((score) => ({ cls: "wrong_done", score }));
  assert.equal(devThreshold(rows), 0.6);
  assert.equal(devThreshold([]), null);
});

test("task bootstrap resamples whole tasks and is seeded", () => {
  const rows = ["a", "b", "c", "d"].flatMap((task, i) => [{ task, cls: i % 2 ? "wrong_done" : "true_done", score: i % 2 ? 0.9 : 0.1 }, { task, cls: "true_done", score: 0.3 }]);
  const one = bootstrap(rows, "task", { resamples: 200 });
  assert.deepEqual(one, bootstrap(rows, "task", { resamples: 200 }));
  assert.ok(one.ci95 && one.ci95[0] <= one.ci95[1]);
});

test("split keeps tasks whole, halves each stratum and is deterministic", () => {
  const rows = ["t1", "t2", "t3", "t4", "t5", "t6"].map((task, i) => ({ task, class: i < 2 ? "wrong_done" : "true_done" }));
  const a = splitTasks(rows);
  assert.deepEqual(a, splitTasks(rows));
  assert.deepEqual(["t1", "t2"].map((t) => a[t]).sort(), ["dev", "holdout"]);
  assert.equal(["t3", "t4", "t5", "t6"].filter((t) => a[t] === "dev").length, 2);
});

test("change content: a Write plus an applicable Edit is one file, an inapplicable Edit stays a hunk, an Edit without a Write is hunks", () => {
  const turn = extractTurn(jsonl([prompt, use("1", "Write", { file_path: "a.mjs", content: "const x = 1;\nconst y = 2;\n" }), use("2", "Edit", { file_path: "a.mjs", old_string: "x = 1", new_string: "x = 5" }), use("3", "Edit", { file_path: "a.mjs", old_string: "nope", new_string: "late" }), use("4", "Edit", { file_path: "b.mjs", old_string: "p", new_string: "q" })]));
  assert.deepEqual(turn.files, [{ file: "a.mjs", content: "const x = 5;\nconst y = 2;\n", hunks: ["late"] }, { file: "b.mjs", content: null, hunks: ["q"] }]);
});

test("truncation keeps head and tail within the per-file cap", () => {
  const out = changes([{ file: "a", content: "x".repeat(5000), hunks: [] }], 2000);
  const c = out[0]?.content ?? "";
  assert.match(c, /\.\.\. \[truncated 3000 chars\] \.\.\./);
  assert.ok(c.length < 2100);
  assert.equal(changes([{ file: "a", content: "short", hunks: [] }], 2000)[0]?.content, "short");
});

test("26 configurations and scores oriented higher = more likely wrong", () => {
  assert.equal(configs().length, 26);
  const cfg = (cand: string) => ({ cand });
  const noul = (v: number) => ({ type: "noul", noul: v });
  assert.equal(scoreOf(cfg("A"), { claims_verified: noul(0.25) }), 0.75);
  assert.equal(scoreOf(cfg("ES1"), { meets_requirements: noul(0.25) }), 0.75);
  assert.equal(scoreOf(cfg("E2"), { requirement_gap: noul(0.25) }), 0.25);
  assert.equal(scoreOf(cfg("E2"), {}), null);
});
