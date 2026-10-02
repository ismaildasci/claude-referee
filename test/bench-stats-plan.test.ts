// A/B statistics, plan and arms: known interval and test values, the pilot rule, Williams balance, the frozen case set and the 20-line hook.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ARMS, ARM_IDS, TEST_HOOK, TEST_HOOK_LINES, UNAVAILABLE_ARMS } from "../bench/arms.mjs";
import { CASE_IDS, CONTROL_IDS } from "../bench/select.mjs";
import { SEED, WILLIAMS_4, planDry, planFull, planPilot, positionCounts } from "../bench/plan.mjs";
import { sizeFromPilot } from "../bench/pilot.mjs";
import { clopperPearson, clusterBootstrap, fisherLess, holm, minEventsForZero, mulberry32, newcombeDiff, requiredN, wilson } from "../bench/stats.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const near = (a: number, b: number, tol = 0.001) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("exact and score intervals match known values", () => {
  near(clopperPearson(0, 10).upper, 1 - 0.025 ** (1 / 10), 1e-6);
  near(clopperPearson(5, 20).lower, 0.0866, 0.0005);
  near(clopperPearson(5, 20).upper, 0.4910, 0.0005);
  near(wilson(1, 10).lower, 0.0179, 0.0005);
  const d = newcombeDiff(56, 70, 48, 80);
  near(d.diff, 0.2, 1e-9);
  near(d.lower, 0.0524, 0.0005);
  near(d.upper, 0.3339, 0.0005);
});

test("Fisher one-sided, Holm and the minimum events for a zero-event arm", () => {
  near(fisherLess(0, 5, 5, 5), 1 / 252, 1e-9);
  assert.equal(fisherLess(0, 10, 0, 10), 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((p) => Math.round(p * 1000) / 1000), [0.03, 0.06, 0.06]);
  assert.equal(minEventsForZero(16), 5);
  assert.equal(minEventsForZero(96), 5);
  assert.equal(minEventsForZero(2), null);
});

test("the pilot rule gives no N without events and a larger N for a smaller rate", () => {
  assert.equal(requiredN(0, 96), null);
  assert.equal(requiredN(0.01, 96), null);
  const high = requiredN(0.2, 96);
  const low = requiredN(0.06, 96);
  assert.ok(high !== null && low !== null && high < low);
  assert.ok(fisherLess(0, high!, Math.round(0.2 * high!), high!) <= 0.05);
  assert.ok(fisherLess(0, high! - 1, Math.round(0.2 * (high! - 1)), high! - 1) > 0.05);
});

const ground = (over: Record<string, unknown>) => ({ arm: "nogate", role: "case", class: "true_done", verifier: "pass", cost_usd: 0.1, stage: "pilot", ...over });

test("sizeFromPilot stops with no events, runs a fitting size and flags an underpowered one", () => {
  const none = Array.from({ length: 40 }, (_, i) => ground({ task: `t${i % 20}`, role: i % 5 === 4 ? "control" : "case" }));
  assert.equal(sizeFromPilot(none).decision, "stop");
  const some = none.map((g, i) => (i < 8 && g.role === "case" ? { ...g, class: "wrong_done", verifier: "fail" } : g));
  const sized = sizeFromPilot(some);
  assert.ok(["run", "run_underpowered"].includes(sized["decision"]), JSON.stringify(sized));
  assert.ok(sized["reps"] >= 2 && sized["reps"] <= 6);
  const pricey = some.map((g) => ({ ...g, cost_usd: 3 }));
  assert.equal(sizeFromPilot(pricey).decision, "stop");
});

test("the cluster bootstrap resamples whole tasks and is reproducible from its seed", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ task: `t${i}`, v: i < 10 ? 1 : 0 }));
  const stat = (r: typeof rows) => r.reduce((s, x) => s + x.v, 0) / r.length;
  const a = clusterBootstrap(rows, stat, { resamples: 500, seed: 3 });
  const b = clusterBootstrap(rows, stat, { resamples: 500, seed: 3 });
  assert.deepEqual(a, b);
  assert.ok(a.lower! < 0.5 && a.upper! > 0.5);
  assert.equal(mulberry32(1)(), mulberry32(1)());
});

test("the registered case set is 16 cases and 4 controls, frozen with a matching hash that PREREG pins", () => {
  assert.equal(CASE_IDS.length, 16);
  assert.equal(CONTROL_IDS.length, 4);
  assert.equal(new Set([...CASE_IDS, ...CONTROL_IDS]).size, 20);
  const data = JSON.parse(readFileSync(join(here, "../bench/cases.json"), "utf8"));
  assert.equal(createHash("sha256").update(JSON.stringify(data.tasks)).digest("hex"), data.hash);
  assert.deepEqual(data.tasks.map((t: { id: string }) => t.id), [...CASE_IDS, ...CONTROL_IDS]);
  assert.ok(data.tasks.filter((t: { role: string }) => t.role === "control").every((t: { kind: string }) => t.kind === "easy"));
  assert.ok(readFileSync(join(here, "../bench/PREREG.md"), "utf8").includes(data.hash));
});

test("the full plan is balanced: every arm sits at every position equally often and the seed fixes the order", () => {
  const taskIds = [...CASE_IDS, ...CONTROL_IDS];
  const plan = planFull({ taskIds, reps: 4 });
  assert.equal(plan.length, 20 * 4 * 4);
  assert.equal(new Set(plan.map((s) => s.id)).size, plan.length);
  for (const arm of ARM_IDS) assert.deepEqual(positionCounts(plan)[arm], [20, 20, 20, 20]);
  assert.deepEqual(plan, planFull({ taskIds, reps: 4, seed: SEED }));
  assert.notDeepEqual(plan.map((s) => s.id), planFull({ taskIds, reps: 4, seed: SEED + 1 }).map((s) => s.id));
  for (const row of WILLIAMS_4) assert.deepEqual([...row].sort(), [0, 1, 2, 3]);
  const firstTask = plan.filter((s) => s.task === taskIds[0] && s.position === 0);
  assert.ok(new Set(firstTask.map((s) => s.arm)).size > 1);
  assert.throws(() => planFull({ taskIds, reps: 1, arms: ["a", "b"] }));
});

test("pilot and dry plans use one arm and the registered shapes", () => {
  const pilot = planPilot({ taskIds: [...CASE_IDS, ...CONTROL_IDS] });
  assert.equal(pilot.length, 40);
  assert.ok(pilot.every((s) => s.arm === "nogate" && s.stage === "pilot"));
  const dry = planDry({});
  assert.deepEqual(dry.map((s) => s.arm), ARM_IDS);
  assert.ok(dry.every((s) => s.task === "n-clamp"));
});

test("arms: the goal arm sets the condition as the directive, only the referee arm loads the plugin and active-equivalent is listed as unavailable", () => {
  const task = { id: "x", prompt: "Do the thing.\n\nAnswer in English." };
  assert.ok(ARMS["goal"]!.prompt(task).startsWith("/goal Do the thing. Answer in English. The goal is met"));
  assert.equal(ARMS["nogate"]!.prompt(task), task.prompt);
  assert.deepEqual(ARM_IDS.filter((a) => ARMS[a]!.plugin), ["referee"]);
  assert.deepEqual(ARMS["nogate"]!.files(task), {});
  assert.deepEqual(JSON.parse(ARMS["referee"]!.files(task)[".claude/referee.json"]!), { pack: "generic", hooks: { stopGate: "soft" } });
  assert.equal(UNAVAILABLE_ARMS[0]!.id, "referee-active");
  assert.ok(Object.keys(ARMS["testhook"]!.files(task)).includes(".claude/hooks/run-tests.sh"));
});

test("the test hook is at most 20 lines, blocks with exit 2 on a failing test and passes on a green one", () => {
  assert.ok(TEST_HOOK_LINES <= 20, `${TEST_HOOK_LINES} lines`);
  const dir = mkdtempSync(join(tmpdir(), "hook-"));
  const script = join(dir, "run-tests.sh");
  writeFileSync(script, TEST_HOOK);
  const run = (test: string) => {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x", scripts: { test } }));
    return spawnSync("bash", [script], { cwd: dir, input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  };
  const red = run("node -e \"console.log('boom'); process.exit(1)\"");
  assert.equal(red.status, 2);
  assert.match(red.stderr, /Tests failed \(exit 1\)/);
  assert.match(red.stderr, /boom/);
  assert.equal(run("node -e \"process.exit(0)\"").status, 0);
  const none = mkdtempSync(join(tmpdir(), "hook-none-"));
  assert.equal(spawnSync("bash", [script], { cwd: none, input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: none } }).status, 0);
});
