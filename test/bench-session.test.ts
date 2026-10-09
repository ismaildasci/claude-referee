// A/B session runner against a stub `claude`: arm configuration reaches the command line and the work tree, transcript cost, verifier, ground truth, ledger, resume, budget cap, case pin, report.

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { posixTest as test } from "./posix-test.ts";
import { fileURLToPath } from "node:url";
import { planDry } from "../bench/plan.mjs";
import { analyze } from "../bench/report.mjs";
import { ambiguousPending, loadCases, paths, prepare, readGrounds, readLedger, runAll, runSession, setManual } from "../bench/session.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const cases = loadCases(join(repoRoot, "bench/cases.json"));
const root = mkdtempSync(join(tmpdir(), "bench-session-"));

const STUB = `#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const cfg = JSON.parse(readFileSync(process.env.STUB_CONFIG, "utf8"));
appendFileSync(cfg.argvLog, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }) + "\\n");
const cwd = process.cwd();
for (const [path, content] of Object.entries(cfg.files)) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), content);
}
const sid = "sess-" + cwd.replace(/[^A-Za-z0-9]/g, "").slice(-14);
if (process.env.REFEREE_DATA_DIR && cfg.stop) writeFileSync(join(process.env.REFEREE_DATA_DIR, "stops.jsonl"), JSON.stringify({ id: "s1", session_id: sid, mode: "soft", edits: 1, checks: 0, ms: 300, decision: { would_block: cfg.stop.would_block } }) + "\\n");
const dir = join(cfg.projectsDir, realpathSync(cwd).replace(/[^A-Za-z0-9]/g, "-"));
mkdirSync(dir, { recursive: true });
const usage = { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 1000, cache_creation_input_tokens: 2000, cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 1000 } };
const line = { type: "assistant", requestId: "req_1", uuid: "u1", message: { id: "msg_1", model: "claude-haiku-4-5-20251001", usage, content: [{ type: "text", text: "ok" }] } };
writeFileSync(join(dir, sid + ".jsonl"), JSON.stringify(line) + "\\n" + JSON.stringify(line) + "\\n");
console.log(JSON.stringify({ type: "result", is_error: cfg.isError === true, result: cfg.final, session_id: sid, total_cost_usd: cfg.cost, duration_ms: 900, num_turns: 3, modelUsage: { "claude-haiku-4-5-20251001": {} } }));
`;

const CLAMP = `export function clamp(value, min, max) {\n  if (min > max) throw new RangeError("min is greater than max");\n  return Math.min(Math.max(value, min), max);\n}\n`;

function setup(name: string, config: Record<string, unknown>) {
  const out = join(root, name);
  mkdirSync(out, { recursive: true });
  const projectsDir = join(out, "projects");
  const argvLog = join(out, "argv.jsonl");
  writeFileSync(argvLog, "");
  const configFile = join(out, "stub.json");
  writeFileSync(configFile, JSON.stringify({ projectsDir, argvLog, ...config }));
  const bin = join(out, "claude-stub.mjs");
  writeFileSync(bin, STUB);
  chmodSync(bin, 0o755);
  process.env["STUB_CONFIG"] = configFile;
  prepare({ out, repoRoot, cases });
  const calls = () => readFileSync(argvLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { argv: string[]; cwd: string });
  return { out, opts: { claude: bin, projectsDir }, calls };
}

test("each arm reaches the command line and the work tree as registered", async () => {
  const s = setup("arms", { files: { "src/clamp.mjs": CLAMP }, final: "Done. clamp works.", cost: 0.05, stop: { would_block: true } });
  for (const plan of planDry({})) await runSession({ out: s.out, plan, cases, opts: s.opts });
  const calls = s.calls();
  assert.equal(calls.length, 4);
  const byArm = Object.fromEntries(calls.map((c, i) => [planDry({})[i]!.arm, c]));
  assert.ok(!byArm["nogate"]!.argv.includes("--plugin-dir"));
  assert.ok(!byArm["testhook"]!.argv.includes("--plugin-dir"));
  assert.ok(!byArm["goal"]!.argv.includes("--plugin-dir"));
  assert.ok(byArm["referee"]!.argv.includes("--plugin-dir"));
  assert.ok(byArm["goal"]!.argv[1]!.startsWith("/goal Implement clamp"));
  assert.ok(!byArm["nogate"]!.argv[1]!.startsWith("/goal"));
  for (const c of calls) {
    assert.deepEqual(c.argv.slice(c.argv.indexOf("--setting-sources"), c.argv.indexOf("--setting-sources") + 2), ["--setting-sources", "project,local"]);
    assert.ok(c.argv.includes("--max-budget-usd"));
  }
  assert.ok(existsSync(join(paths(s.out, "n-clamp__testhook__r1").work, ".claude/hooks/run-tests.sh")));
  assert.ok(existsSync(join(paths(s.out, "n-clamp__referee__r1").work, ".claude/referee.json")));
  assert.ok(!existsSync(join(paths(s.out, "n-clamp__nogate__r1").work, ".claude")));
});

test("ground truth: verifier, claim, cost from the transcript priced per request, reconciliation and arm evidence", async () => {
  const s = setup("ground", { files: { "src/clamp.mjs": CLAMP }, final: "Done. clamp works.", cost: 0.05, stop: { would_block: true } });
  const r = await runSession({ out: s.out, plan: planDry({})[3]!, cases, opts: s.opts });
  const g = r.ground!;
  assert.equal(g["arm"], "referee");
  assert.equal(g["verifier"], "pass");
  assert.equal(g["class"], "true_done");
  assert.equal(g["cost_source"], "transcript");
  assert.equal(g["cost_account"].requests, 1);
  assert.equal(g["cost_usd"], 0.00436);
  assert.equal(g["cost_account"].usdBy.cache1h, 0.002);
  assert.equal(g["cost_account"].usdBy.cache5m, 0.00125);
  assert.equal(g["cost_reconcile"].reported_usd, 0.05);
  assert.deepEqual(g["cost_reconcile"].extra_models, []);
  assert.equal(g["arm_evidence"].would_block, 1);
  assert.equal(g["arm_evidence"].last.mode, "soft");
  assert.equal(readLedger(s.out)[0]!.usd, 0.05);
});

test("a wrong solution that claims done is wrong_done and a failed run is run_failed, both with cost", async () => {
  const wrong = setup("wrong", { files: { "src/clamp.mjs": "export function clamp(v){return v}\n" }, final: "All done, it works.", cost: 0.03 });
  const w = await runSession({ out: wrong.out, plan: planDry({})[0]!, cases, opts: wrong.opts });
  assert.equal(w.ground!["class"], "wrong_done");
  const failed = setup("failed", { files: {}, final: "", isError: true, cost: 0.02 });
  const f = await runSession({ out: failed.out, plan: planDry({})[0]!, cases, opts: failed.opts });
  assert.equal(f.ground!["class"], "run_failed");
  assert.equal(f.ground!["cost_source"], "transcript");
  assert.ok(f.ground!["cost_usd"] > 0);
});

test("a finished session is never rerun, the ledger takes the spend first, and the budget cap stops the loop", async () => {
  const s = setup("resume", { files: { "src/clamp.mjs": CLAMP }, final: "Done.", cost: 0.3 });
  const plans = planDry({});
  const first = await runAll({ out: s.out, plans, cases, capUsd: 0.6, perSessionUsd: 0.4, opts: s.opts });
  assert.equal(first.stopped, "budget");
  assert.equal(first.ran, 1);
  assert.equal(s.calls().length, 1);
  const again = await runSession({ out: s.out, plan: plans[0]!, cases, opts: s.opts });
  assert.equal(again.skipped, true);
  assert.equal(s.calls().length, 1);
  assert.equal(readGrounds(s.out).length, 1);
});

test("the case set is pinned: a changed hash refuses to continue, and a tampered cases file is rejected", () => {
  const s = setup("pin", { files: {}, final: "", cost: 0 });
  assert.throws(() => prepare({ out: s.out, repoRoot, cases: { ...cases, hash: "0".repeat(64) } }), /case set changed/);
  const bad = join(root, "bad-cases.json");
  const data = JSON.parse(readFileSync(join(repoRoot, "bench/cases.json"), "utf8"));
  data.tasks[0].prompt += " x";
  writeFileSync(bad, JSON.stringify(data));
  assert.throws(() => loadCases(bad), /recorded hash/);
});

test("ambiguous final messages wait for a manual label that never shows the arm, then count", async () => {
  const s = setup("ambig", { files: { "src/clamp.mjs": CLAMP }, final: "It is working, but I could not run it.", cost: 0.02 });
  await runSession({ out: s.out, plan: planDry({})[0]!, cases, opts: s.opts });
  const pending = ambiguousPending(s.out);
  assert.equal(pending.length, 1);
  assert.equal(readGrounds(s.out)[0]!["class"], "unresolved");
  setManual(s.out, pending[0]!["id"], "claim");
  assert.equal(readGrounds(s.out)[0]!["class"], "true_done");
});

test("the report counts wrong done over the cases only and prices every session, failed ones included", () => {
  const g = (over: Record<string, unknown>) => ({ role: "case", arm: "nogate", class: "true_done", verifier: "pass", run_failed: false, leaked: false, cost_usd: 0.1, cost_source: "transcript", task: "t1", ...over });
  const grounds = [
    ...Array.from({ length: 10 }, (_, i) => g({ task: `t${i}`, class: i < 4 ? "wrong_done" : "true_done", verifier: i < 4 ? "fail" : "pass" })),
    ...Array.from({ length: 10 }, (_, i) => g({ arm: "testhook", task: `t${i}`, class: i < 1 ? "wrong_done" : i === 9 ? "run_failed" : "true_done", verifier: i < 1 || i === 9 ? "fail" : "pass", run_failed: i === 9, cost_usd: 0.15 })),
    g({ role: "control", class: "wrong_done", verifier: "fail", task: "c1" }),
  ];
  const a = analyze(grounds);
  assert.equal(a["outcome_one"].per_arm.nogate.n, 10);
  assert.equal(a["outcome_one"].per_arm.nogate.wrong_done, 4);
  assert.equal(a["outcome_one"].per_arm.testhook.wrong_done, 1);
  assert.equal(a["outcome_one"].evaluable, false);
  assert.ok(a["outcome_one"].comparisons.testhook.newcombe95[1] < 0.3);
  assert.equal(a["cost"].per_arm.testhook.sessions, 10);
  assert.equal(a["cost"].per_arm.testhook.correct, 8);
  assert.equal(a["cost"].per_arm.testhook.usd, 1.5);
  assert.ok(Math.abs(a["cost"].per_arm.testhook.usd_per_correct - 0.1875) < 0.001);
  assert.equal(a["cost"].per_arm.nogate.run_failed, 0);
  assert.ok(a["cost"].ratios.testhook.ratio_vs_nogate > 1);
});
