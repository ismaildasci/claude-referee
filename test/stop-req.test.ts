// Stop-requirements study helpers: 12 configurations, edit stats, score orientation, fresh plan, adoption rule and the 0.7 recall threshold.

import assert from "node:assert/strict";
import { test } from "node:test";
import { HARD_TASKS } from "../scripts/session-study/tasks.mjs";
import { planFresh } from "../scripts/stop-req/sessions.mjs";
import { adoption, devThreshold, pairedDiff, summarize, withinTaskAuc } from "../scripts/stop-req/stats.mjs";
import { buildState, configs, editStats, lineCount, meanScore, scoreOf } from "../scripts/stop-req/states.mjs";

const use = (id: string, name: string, input: Record<string, unknown>) => ({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const jsonl = (entries: unknown[]) => entries.map((e) => JSON.stringify(e)).join("\n");
const prompt = { type: "user", message: { content: "implement it" } };
const noul = (v: number) => ({ type: "noul", noul: v });

test("12 configurations, R0 family first, 8 enriched", () => {
  const all = configs();
  assert.equal(all.length, 12);
  assert.deepEqual(all.filter((c) => c.family === "primary").map((c) => c.id), ["R0-W1", "R0-W2", "R0-W3", "R0-W4"]);
  assert.equal(all.filter((c) => c.family === "secondary").length, 8);
});

test("line count and edit stats follow the registered rule", () => {
  assert.equal(lineCount(""), 0);
  assert.equal(lineCount("a\nb\n"), 3);
  const t = jsonl([prompt, use("1", "Write", { file_path: "a.mjs", content: "x\ny" }), use("2", "Edit", { file_path: "a.mjs", old_string: "x", new_string: "p\nq\nr" }), use("3", "MultiEdit", { file_path: "b.mjs", edits: [{ old_string: "a", new_string: "" }, { old_string: "c\nd", new_string: "e" }] }), use("4", "Read", { file_path: "c" })]);
  assert.deepEqual(editStats(t), [{ file: "a.mjs", added: 5, removed: 1 }, { file: "b.mjs", added: 1, removed: 3 }]);
});

test("states add only counts: R0 has the shipped fields, R1 and R2 add check_results and edit_stats", () => {
  const f = { facts: { task: "t", checks: [{ cmd: "npm test", status: "passed", extra: 1 }], edits: ["a.mjs"] }, finalMessage: "done", checkResults: [{ cmd: "npm test" }], editStats: [{ file: "a.mjs", added: 1, removed: 0 }] };
  const keys = (state: string) => Object.keys(buildState({ state }, f)).sort();
  assert.deepEqual(keys("R0"), ["checks", "edits", "final_message", "task"]);
  assert.deepEqual(keys("R1"), ["check_results", "checks", "edits", "final_message", "task"]);
  assert.deepEqual(keys("R2"), ["checks", "edit_stats", "edits", "final_message", "task"]);
  assert.deepEqual(keys("R3"), ["check_results", "checks", "edit_stats", "edits", "final_message", "task"]);
  assert.deepEqual(buildState({ state: "R0" }, f)["checks"], [{ cmd: "npm test", status: "passed" }]);
});

test("scores are oriented higher = more likely wrong", () => {
  assert.equal(scoreOf({ wording: 0 }, { claims_verified: noul(0.25) }), 0.75);
  assert.equal(scoreOf({ wording: 1 }, { met: noul(0.25) }), 0.75);
  assert.equal(scoreOf({ wording: 2 }, { gap: noul(0.25) }), 0.25);
  assert.equal(scoreOf({ wording: 3 }, { unverified: noul(0.4) }), 0.4);
  assert.equal(scoreOf({ wording: 4 }, { trap: noul(0.6) }), 0.6);
  assert.equal(scoreOf({ wording: 4 }, {}), null);
  assert.equal(meanScore([0.2, 0.4]), 0.30000000000000004);
  assert.equal(meanScore([0.2, null]), null);
});

test("fresh plan: seeded, 25% haiku at most in every prefix, ids distinct from the earlier study", () => {
  const ids = HARD_TASKS.map((t: { id: string }) => t.id);
  const plan = planFresh(ids);
  assert.deepEqual(plan, planFresh(ids));
  assert.notDeepEqual(plan.map((p) => p.task), planFresh(ids, 1).map((p) => p.task));
  assert.equal(plan.length, 60);
  assert.equal(plan.filter((p) => p.model === "haiku").length, 15);
  assert.equal(new Set(plan.map((p) => p.id)).size, plan.length);
  assert.ok(plan.every((p) => /__r1[12]$/.test(p.id)));
  plan.forEach((_, i) => assert.ok(plan.slice(0, i + 1).filter((p) => p.model === "haiku").length * 4 <= i + 1));
  assert.equal(plan.slice(0, 32 + 10).filter((p) => p.model === "sonnet" && p.rep === 12).length, 0);
});

test("dev threshold keeps recall at 0.7 when asked", () => {
  const rows = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3].map((score) => ({ cls: "wrong_done", score }));
  assert.equal(devThreshold(rows, 0.7), 0.5);
});

test("within-task AUC and paired difference", () => {
  const rows = [
    { id: "1", task: "a", cls: "wrong_done", score: 0.9 },
    { id: "2", task: "a", cls: "true_done", score: 0.1 },
    { id: "3", task: "b", cls: "wrong_done", score: 0.2 },
    { id: "4", task: "b", cls: "true_done", score: 0.3 },
    { id: "5", task: "c", cls: "true_done", score: 0.5 },
  ];
  assert.deepEqual(withinTaskAuc(rows), { tasks: 2, auc: 0.5 });
  const worse = rows.map((r) => ({ id: r.id, score: 1 - r.score }));
  const d = pairedDiff(rows, worse, { resamples: 200 });
  assert.ok((d.diff ?? 0) > 0);
});

test("adoption: underpowered is not judged, P1 to P4 decide otherwise", () => {
  const tally = (recall: number, fb: number) => ({ recall: { value: recall }, false_block: { value: fb } });
  const kw = { false_block: { value: 0.8 } };
  const summary = (wrong: number, ci: [number, number], p: number, a: number) => ({ wrong, true: 30, boot_task_ci95: ci, perm_p: p, auc: a });
  assert.equal(adoption({ summary: summary(4, [0.6, 0.9], 0.01, 0.8), tally: tally(0.8, 0.3), baselineAuc: 0.4, keywordB: kw }).judged, false);
  assert.match(adoption({ summary: summary(8, [0.6, 0.9], 0.01, 0.8), tally: tally(0.8, 0.3), baselineAuc: 0.4, keywordB: kw }).verdict, /supported/);
  assert.equal(adoption({ summary: summary(8, [0.6, 0.9], 0.01, 0.8), tally: tally(0.6, 0.3), baselineAuc: 0.4, keywordB: kw }).verdict, "separates, but not usefully");
  assert.match(adoption({ summary: summary(8, [0.45, 0.9], 0.01, 0.8), tally: tally(0.8, 0.3), baselineAuc: 0.4, keywordB: kw }).verdict, /does not separate/);
  assert.equal(adoption({ summary: summary(8, [0.6, 0.9], 0.03, 0.8), tally: tally(0.8, 0.3), baselineAuc: 0.4, keywordB: kw, sig: 0.025 }).rules["P2"], false);
  assert.ok(summarize([{ task: "a", cls: "wrong_done", score: 1 }, { task: "b", cls: "true_done", score: 0 }], { withBootstrap: false }).auc === 1);
});
