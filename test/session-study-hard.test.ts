// Hard-task study logic: registered plan order and pilot, exact permutation test against brute force, seeded bootstrap, the H1 to H4 report, and a hard task through the runner.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { posixTest as test } from "./posix-test.ts";
import { fileURLToPath } from "node:url";
import { clopperPearson } from "../src/engine/stopgate/interval.ts";
import { HARD_ASKED_TARGET, HARD_CAP_USD, HARD_MAX_SESSIONS, HARD_PER_SESSION_USD, PILOT_POSITIONS, auc, bootstrapAuc, hardReport, planHard, permutationP } from "../scripts/session-study/hard.mjs";
import { ALLOWED_TOOLS, ALLOWED_TOOLS_HARD, prepare, runSession } from "../scripts/session-study/runner.mjs";
import { HARD_TASKS, taskById } from "../scripts/session-study/tasks.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("registered constants", () => {
  assert.equal(HARD_CAP_USD, 8);
  assert.equal(HARD_PER_SESSION_USD, 0.25);
  assert.equal(HARD_MAX_SESSIONS, 100);
  assert.equal(HARD_ASKED_TARGET, 100);
  assert.deepEqual(PILOT_POSITIONS, [0, 5, 10, 15, 20, 25]);
  assert.ok(ALLOWED_TOOLS_HARD.startsWith(ALLOWED_TOOLS) && ALLOWED_TOOLS_HARD.includes("Bash(bash *)") && !ALLOWED_TOOLS.includes("Bash(bash *)"));
});

test("the plan has the registered order: pilot first, haiku interleaved, at most a quarter haiku in every prefix", () => {
  const plan = planHard(HARD_TASKS);
  const sorted = HARD_TASKS.map((t) => t.id).sort();
  assert.equal(plan.length, 100);
  assert.deepEqual(plan.slice(0, 6).map((p) => p.id), PILOT_POSITIONS.map((i) => `${sorted[i]}__sonnet__r1`));
  assert.equal(new Set(plan.map((p) => p.id)).size, 100);
  const haiku = plan.filter((p) => p.model === "haiku");
  assert.equal(haiku.length, 21);
  assert.equal(plan.filter((p) => p.model === "sonnet").length, 79);
  assert.deepEqual(haiku.map((p) => p.task), sorted.filter((_, i) => i % 3 !== 0));
  assert.ok(haiku.every((p) => p.rep === 1));
  let h = 0;
  plan.forEach((p, i) => {
    if (p.model === "haiku") h++;
    assert.ok(h / (i + 1) <= 0.25 + 1e-9, `prefix ${i + 1} has ${h} haiku`);
  });
  assert.equal(plan.findIndex((p) => p.model === "haiku"), 6, "the first haiku session comes right after sonnet session 6");
  for (const id of sorted) {
    const runs = plan.filter((p) => p.task === id).length;
    assert.ok(runs >= 2 && runs <= 4, `${id} has ${runs} runs`);
  }
  const rep1 = plan.filter((p) => p.model === "sonnet" && p.rep === 1).map((p) => p.task);
  assert.deepEqual([...rep1].sort(), sorted, "every task gets sonnet repetition 1");
  assert.equal(plan.filter((p) => p.rep === 3).length, 15);
});

function brute(wrong: number[], right: number[]): number {
  const all = [...wrong, ...right];
  const n = all.length;
  const k = wrong.length;
  const stat = (idx: number[]) => {
    const inWrong = new Set(idx);
    let u = 0;
    for (const i of idx) for (let j = 0; j < n; j++) if (!inWrong.has(j)) u += all[i]! > all[j]! ? 1 : all[i] === all[j] ? 0.5 : 0;
    return u;
  };
  const observed = stat([...Array(k).keys()]);
  let total = 0;
  let atLeast = 0;
  const walk = (start: number, chosen: number[]) => {
    if (chosen.length === k) {
      total++;
      if (stat(chosen) >= observed - 1e-12) atLeast++;
      return;
    }
    for (let i = start; i < n; i++) walk(i + 1, [...chosen, i]);
  };
  walk(0, []);
  return atLeast / total;
}

test("the exact permutation p-value equals brute-force enumeration, with ties", () => {
  const cases: [number[], number[]][] = [
    [[0.9, 0.8, 0.7], [0.1, 0.2, 0.3, 0.4]],
    [[0.5, 0.5], [0.5, 0.5, 0.5]],
    [[0.9, 0.9, 0.2], [0.9, 0.2, 0.2, 0.1]],
    [[0.1, 0.2], [0.8, 0.9, 0.7]],
    [[1, 0.5, 0.5, 0.25], [0.5, 0.25, 0.25, 0]],
    [[0.3], [0.3, 0.1, 0.9]],
  ];
  for (const [w, r] of cases) assert.ok(Math.abs(permutationP(w, r)! - brute(w, r)) < 1e-9, JSON.stringify([w, r]));
  assert.equal(permutationP([], [1]), null);
});

test("auc counts ties as half and permutation p is exact for a perfect split", () => {
  assert.equal(auc([0.9, 0.8], [0.1, 0.2]), 1);
  assert.equal(auc([0.5], [0.5]), 0.5);
  assert.equal(auc([0.1], [0.9]), 0);
  assert.equal(auc([], [1]), null);
  const w = Array.from({ length: 12 }, (_, i) => 0.8 + i * 0.01);
  const r = Array.from({ length: 40 }, (_, i) => i * 0.01);
  assert.equal(auc(w, r), 1);
  const p = permutationP(w, r)!;
  assert.ok(p > 0 && p < 1e-9, `p ${p}`);
});

test("the bootstrap interval is deterministic for the registered seed and brackets the estimate", () => {
  const w = [0.9, 0.8, 0.85, 0.6, 0.4, 0.95, 0.7, 0.5, 0.65, 0.3];
  const r = [0.1, 0.2, 0.3, 0.5, 0.45, 0.6, 0.25, 0.35, 0.15, 0.05, 0.55, 0.4];
  const a = bootstrapAuc(w, r)!;
  assert.deepEqual(bootstrapAuc(w, r), a);
  const point = auc(w, r)!;
  assert.ok(a[0] <= point && point <= a[1] && a[0] >= 0 && a[1] <= 1);
  assert.equal(bootstrapAuc([], r), null);
});

function ground(id: string, cls: string, stop: Record<string, unknown> | null, extra: Record<string, unknown> = {}) {
  return { id, task: id, kind: "hidden", lang: "node", model: "sonnet", class: cls, stop, ...extra };
}

test("the report applies the registered bars and refuses to judge below the power target", () => {
  const asked = (block: boolean, verified: number) => ({ id: "s", would_block: block, claims_done: 0.9, claims_verified: verified });
  const sessions = [
    ...Array.from({ length: 16 }, (_, i) => ground(`w${i}`, "wrong_done", asked(true, 0.05 + i * 0.005))),
    ground("w-skipped", "wrong_done", { skipped: "check_passed_after_edit" }),
    ...Array.from({ length: 20 }, (_, i) => ground(`t${i}`, "true_done", asked(i < 2, 0.3 + i * 0.02))),
    ...Array.from({ length: 4 }, (_, i) => ground(`q${i}`, "quiet_pass", null)),
    ground("x", "leaked", null),
  ];
  const r = hardReport(sessions, clopperPearson);
  assert.equal(r.h1.usable, 41);
  assert.equal(r.h1.wrong_done, 17);
  assert.equal(r.h1.verdict, "met");
  assert.equal(r.h1.power_target_met, true);
  assert.equal(r.h2.recall_all.k, 16);
  assert.equal(r.h2.recall_all.n, 17);
  assert.equal(r.h2.asked_share.value, 0.941);
  assert.equal(r.h2.recall_among_asked.value, 1);
  assert.equal(r.h2.verdict, "met");
  assert.equal(r.h3.false_block_rate.k, 2);
  assert.equal(r.h3.false_block_rate.n, 20);
  assert.equal(r.h3.verdict, "not met");
  assert.equal(r.h4.auc, 1);
  assert.equal(r.h4.verdict, "met");
  assert.ok(r.h4.permutation_p_one_sided < 1e-6);
  assert.equal(r.h4.wrong_asked_with_score, 16);
  assert.equal(r.h4.true_asked_with_score, 20);
  assert.equal(r.precision.k, 16);
  assert.equal(r.precision.n, 18);
  const few = hardReport(sessions.slice(0, 5), clopperPearson);
  assert.match(few.h2.verdict, /^not judged/);
  assert.match(few.h4.verdict, /^not judged/);
  const separated = hardReport([
    ...Array.from({ length: 15 }, (_, i) => ground(`w${i}`, "wrong_done", asked(true, 0.02 + i * 0.001))),
    ...Array.from({ length: 15 }, (_, i) => ground(`t${i}`, "true_done", asked(false, 0.6 + i * 0.01))),
  ], clopperPearson);
  assert.equal(separated.h4.auc, 1);
  assert.equal(separated.h4.verdict, "met");
  assert.equal(separated.h3.verdict, "met");
  const flat = hardReport([
    ...Array.from({ length: 15 }, (_, i) => ground(`w${i}`, "wrong_done", asked(true, 0.1))),
    ...Array.from({ length: 15 }, (_, i) => ground(`t${i}`, "true_done", asked(true, 0.1))),
  ], clopperPearson);
  assert.equal(flat.h4.auc, 0.5);
  assert.equal(flat.h4.verdict, "not met");
  assert.equal(flat.h3.verdict, "not met");
});

const STUB = `#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const cfg = JSON.parse(readFileSync(process.env.STUB_CONFIG, "utf8"));
for (const [path, content] of Object.entries(cfg.files)) {
  mkdirSync(dirname(join(process.cwd(), path)), { recursive: true });
  writeFileSync(join(process.cwd(), path), content);
}
console.log(JSON.stringify({ type: "result", is_error: false, result: cfg.final, session_id: "stub", total_cost_usd: 0.05, duration_ms: 1, num_turns: 1 }));
`;

test("a shell task runs through the runner with a Node verifier, and the hard manifest is pinned apart from the base one", async () => {
  const out = mkdtempSync(join(tmpdir(), "study-hard-run-"));
  const task = taskById("h-s-tsvcol");
  const bin = join(out, "claude-stub.mjs");
  writeFileSync(bin, STUB);
  chmodSync(bin, 0o755);
  const config = join(out, "stub.json");
  writeFileSync(config, JSON.stringify({ files: task.solution, final: "Done, it works." }));
  process.env["STUB_CONFIG"] = config;
  const pinned = prepare({ out, repoRoot, tasks: HARD_TASKS });
  assert.equal(pinned.count, 32);
  assert.throws(() => prepare({ out, repoRoot }), /manifest changed/);
  const projectsDir = join(out, "projects");
  mkdirSync(projectsDir, { recursive: true });
  const r = await runSession({ out, plan: { id: "h-s-tsvcol__sonnet__r1", task: "h-s-tsvcol", model: "sonnet", rep: 1 }, opts: { claude: bin, projectsDir } });
  assert.equal(r.ground?.verifier, "pass");
  assert.equal(r.ground?.class, "true_done");
  assert.equal(r.ground?.lang, "shell");
});

test("the cli plans the hard set", () => {
  const out = mkdtempSync(join(tmpdir(), "study-hard-cli-"));
  const r = spawnSync("node", ["scripts/session-study/cli.mjs", "plan", "--set", "hard", "--out", out], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const body = JSON.parse(r.stdout);
  assert.equal(body.sessions, 100);
  assert.equal(body.cap_usd, 8);
  assert.equal(body.per_session_usd, 0.25);
  assert.equal(body.first[0].id, `${HARD_TASKS.map((t) => t.id).sort()[0]}__sonnet__r1`);
  const pilot = spawnSync("node", ["scripts/session-study/cli.mjs", "plan", "--set", "hard", "--pilot", "--out", out], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(JSON.parse(pilot.stdout).sessions, 6);
});
