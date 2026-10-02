// Regression tests for the A/B review findings: referee arm silent at SessionStart, test-hook strata, Stop-block counting, CLI-basis cost ratio.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ARMS, testHookActs } from "../bench/arms.mjs";
import { costPerCorrect, outcomeOne } from "../bench/report.mjs";
import { loadCases, armEvidence } from "../bench/session.mjs";
import { sessionStart } from "../src/hooks/session-start.ts";
import { tempDir } from "./helpers.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const cases = loadCases(join(root, "bench/cases.json"));

test("the referee arm config produces no SessionStart briefing", async () => {
  const dir = tempDir();
  mkdirSync(join(dir, ".claude"));
  const files = ARMS["referee"]!.files({ id: "x" });
  writeFileSync(join(dir, ".claude/referee.json"), files[".claude/referee.json"]!);
  const io = { env: { REFEREE_DATA_DIR: join(dir, "data") }, home: dir, now: () => 0, readStdin: async () => JSON.stringify({ cwd: dir, session_id: "x" }) };
  assert.equal(await sessionStart(io, join(root, "plugins/claude-referee")), null);
  const on = tempDir();
  mkdirSync(join(on, ".claude"));
  writeFileSync(join(on, ".claude/referee.json"), JSON.stringify({ pack: "generic", hooks: { stopGate: "soft" } }));
  const ioOn = { ...io, readStdin: async () => JSON.stringify({ cwd: on, session_id: "x" }) };
  assert.ok(await sessionStart(ioOn, join(root, "plugins/claude-referee")), "control: default config does brief");
});

test("testHookActs splits the registered cases into 7 with a visible test and 9 without", () => {
  const acts = cases.tasks.filter((t) => t["role"] === "case").map((t) => [t["id"] as string, testHookActs(t["files"])] as const);
  assert.equal(acts.length, 16);
  assert.deepEqual(acts.filter(([, a]) => a).map(([id]) => id).sort(), ["n-deepequal", "n-leap", "n-lru", "n-median", "p-dedupe", "p-flatten", "p-roman"]);
  assert.equal(testHookActs({ "Makefile": "test:\n\tpytest\n" }), true);
  assert.equal(testHookActs({ "package.json": "{}" }), false);
});

test("outcomeOne reports wrong done per hook stratum", () => {
  const g = (arm: string, hook_acts: boolean, cls: string) => ({ arm, task: `${arm}${hook_acts}`, role: "case", hook_acts, class: cls });
  const r = outcomeOne([g("nogate", true, "wrong_done"), g("nogate", false, "true_done"), g("testhook", true, "true_done"), g("testhook", false, "wrong_done")]);
  assert.equal(r["by_hook_stratum"].visible_test.nogate.wrong_done, 1);
  assert.equal(r["by_hook_stratum"].visible_test.testhook.wrong_done, 0);
  assert.equal(r["by_hook_stratum"].no_visible_test.testhook.wrong_done, 1);
  assert.equal(r["by_hook_stratum"].no_visible_test.nogate.n, 1);
});

test("an exit-2 Stop block (hookErrors, preventedContinuation false) counts as a block", () => {
  const line = (o: object) => JSON.stringify({ type: "system", subtype: "stop_hook_summary", ...o });
  const transcript = [line({ hookErrors: ["Tests failed"], preventedContinuation: false }), line({ hookErrors: [], preventedContinuation: false })].join("\n");
  const ev = armEvidence({ armId: "testhook", dataDir: "", transcript });
  assert.equal(ev["stop_hook_runs"], 2);
  assert.equal(ev["stop_hook_blocks"], 1);
});

test("C1 carries a CLI-basis ratio and both figures when the transcript gap exceeds 5 percent", () => {
  const g = (arm: string, i: number, usd: number, rep: number) => ({ arm, task: `t${i}`, role: "case", verifier: "pass", run_failed: false, leaked: false, class: "true_done", cost_usd: usd, cost_source: "transcript", cost_reconcile: { reported_usd: rep } });
  const rows = [0, 1, 2].flatMap((i) => [g("nogate", i, 0.1, 0.1), g("goal", i, 0.063113, 0.082501)]);
  const r = costPerCorrect(rows, ["nogate", "goal"]);
  const goal = r["ratios"].goal;
  assert.equal(goal.headline_both, true);
  assert.ok(Math.abs(goal.ratio_vs_nogate - 0.631) < 0.002);
  assert.ok(Math.abs(goal.ratio_vs_nogate_cli - 0.825) < 0.001);
  assert.ok(Array.isArray(goal.cluster_bootstrap95_cli));
  const agree = costPerCorrect([g("nogate", 0, 0.1, 0.1), g("goal", 0, 0.1, 0.1)], ["nogate", "goal"])["ratios"].goal;
  assert.equal(agree.headline_both, undefined);
});
