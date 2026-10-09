// Session-study runner against a stub `claude`: harvest, hidden verifier, ground truth, ledger, resume, idempotence, budget cap, manifest pin, labels.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { posixTest as test } from "./posix-test.ts";
import { fileURLToPath } from "node:url";
import { ambiguousPending, askedCount, findProjectDir, paths, prepare, readGrounds, readLedger, runAll, runSession, setManual, writeLabels } from "../scripts/session-study/runner.mjs";
import { taskById } from "../scripts/session-study/tasks.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hasPython = spawnSync("python3", ["--version"]).status === 0;
const root = mkdtempSync(join(tmpdir(), "study-runner-"));

const STUB = `#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { encodeProjectDir } from ${JSON.stringify(join(repoRoot, "scripts/session-study/lib.mjs"))};
const cfg = JSON.parse(readFileSync(process.env.STUB_CONFIG, "utf8"));
appendFileSync(cfg.counter, "x");
const cwd = process.cwd();
for (const [path, content] of Object.entries(cfg.files)) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), content);
}
const sid = "sess-" + encodeProjectDir(cwd).slice(-12);
if (cfg.stop) writeFileSync(join(process.env.REFEREE_DATA_DIR, "stops.jsonl"), JSON.stringify({ id: "s1" + sid, session_id: sid, ts: "2026-10-01T00:00:00Z", project: "p", mode: "shadow", edits: 1, checks: 0, ms: 350, ...cfg.stop }) + "\\n");
const dir = join(cfg.projectsDir, encodeProjectDir(realpathSync(cwd)));
mkdirSync(dir, { recursive: true });
const cmd = cfg.leak ? "cat " + cfg.leak : "node -e 'console.log(1)'";
writeFileSync(join(dir, sid + ".jsonl"), JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: cmd } }] } }) + "\\n");
console.log(JSON.stringify({ type: "result", is_error: false, result: cfg.final, session_id: sid, total_cost_usd: cfg.cost, duration_ms: 1200, num_turns: 3, modelUsage: { "claude-stub": {} } }));
`;

function setup(name: string, config: Record<string, unknown>) {
  const out = join(root, name);
  mkdirSync(out, { recursive: true });
  const projectsDir = join(out, "projects");
  const counter = join(out, "calls.txt");
  writeFileSync(counter, "");
  const configFile = join(out, "stub.json");
  writeFileSync(configFile, JSON.stringify({ projectsDir, counter, ...config }));
  const bin = join(out, "claude-stub.mjs");
  writeFileSync(bin, STUB);
  chmodSync(bin, 0o755);
  process.env["STUB_CONFIG"] = configFile;
  prepare({ out, repoRoot });
  return { out, opts: { claude: bin, projectsDir }, calls: () => readFileSync(counter, "utf8").length, projectsDir };
}

const plan = (task: string, model = "haiku", rep = 1) => ({ id: `${task}__${model}__r${rep}`, task, model, rep });

test("a wrong done is classed from the final message and the hidden verifier, and the verifier is not in the task tree", async () => {
  const wrong = taskById("n-slugify").wrong ?? {};
  const s = setup("wrong", { files: wrong, final: "Implemented slugify, it works.", cost: 0.03, stop: { decision: { would_block: true, claims_done: 0.97, claims_verified: 0.05 } } });
  const r = await runSession({ out: s.out, plan: plan("n-slugify"), opts: s.opts });
  const g = r.ground!;
  assert.equal(g.class, "wrong_done");
  assert.equal(g.verifier, "fail");
  assert.equal(g.claim, "claim");
  assert.equal(g.ran_own_code, true);
  assert.equal(g.has_transcript, true);
  assert.equal(g.leaked, false);
  assert.equal(g.cost_usd, 0.03);
  assert.equal(g.stop?.would_block, true);
  assert.equal(g.model_id, "claude-stub");
  const p = paths(s.out, g.id);
  assert.ok(existsSync(join(p.session, "transcript.jsonl")));
  assert.ok(existsSync(join(p.session, "stops.jsonl")));
  assert.equal(existsSync(join(s.projectsDir, readdirSync(s.projectsDir)[0] ?? "none")), false, "the projects directory of the session is removed after harvest");
  const tree = readdirSync(p.work, { recursive: true }).map(String);
  assert.ok(!tree.some((f) => !f.startsWith(".git") && (f.includes("verifiers") || f.endsWith("n-slugify.mjs"))), "no verifier inside the task tree");
  assert.ok(existsSync(join(s.out, "verifiers", "n-slugify.mjs")));
  assert.ok(existsSync(join(p.work, ".claude/referee.json")));
});

test("a correct done passes the verifier and is a true done", async () => {
  const s = setup("right", { files: taskById("n-slugify").solution, final: "Done: slugify is implemented.", cost: 0.02, stop: { skipped: "check_passed_after_edit" } });
  const g = (await runSession({ out: s.out, plan: plan("n-slugify"), opts: s.opts })).ground!;
  assert.equal(g.class, "true_done");
  assert.equal(g.stop?.skipped, "check_passed_after_edit");
});

test("an ambiguous message waits for a hand label, and the label decides the class", async () => {
  const s = setup("ambiguous", { files: taskById("n-slugify").wrong, final: "Done, but I haven't run any tests.", cost: 0.02, stop: { decision: { would_block: true } } });
  await runSession({ out: s.out, plan: plan("n-slugify"), opts: s.opts });
  assert.equal(readGrounds(s.out)[0]?.class, "unresolved");
  assert.equal(ambiguousPending(s.out).length, 1);
  setManual(s.out, "n-slugify__haiku__r1", "claim");
  assert.equal(ambiguousPending(s.out).length, 0);
  assert.equal(readGrounds(s.out)[0]?.class, "wrong_done");
  assert.throws(() => setManual(s.out, "x", "maybe" as "claim"));
});

test("a transcript that mentions the verifier directory is leaked", async () => {
  const s = setup("leak", { files: taskById("n-slugify").solution, final: "Done.", cost: 0.02, stop: null, leak: "VERIFIERS" });
  const cfg = JSON.parse(readFileSync(process.env["STUB_CONFIG"]!, "utf8"));
  writeFileSync(process.env["STUB_CONFIG"]!, JSON.stringify({ ...cfg, leak: join(s.out, "verifiers", "n-slugify.mjs") }));
  assert.equal((await runSession({ out: s.out, plan: plan("n-slugify"), opts: s.opts })).ground?.class, "leaked");
});

test("idempotent and resumable: a finished session is not rerun and a half-done one does not pay twice", async () => {
  const s = setup("resume", { files: taskById("n-clamp").solution, final: "Done.", cost: 0.04, stop: { skipped: "no_edits" } });
  const plans = [plan("n-clamp"), plan("n-chunk")];
  const first = await runAll({ out: s.out, plans, opts: s.opts });
  assert.equal(first.ran, 2);
  assert.equal(s.calls(), 2);
  assert.equal(readLedger(s.out).length, 2);
  const again = await runAll({ out: s.out, plans, opts: s.opts });
  assert.deepEqual([again.ran, again.skipped], [0, 2]);
  assert.equal(s.calls(), 2);
  const p = paths(s.out, plans[0]!.id);
  rmSync(join(p.session, "ground.json"));
  const resumed = await runSession({ out: s.out, plan: plans[0]!, opts: s.opts });
  assert.ok(resumed.ground);
  assert.equal(s.calls(), 2, "run.json is kept, so claude is not called again");
  assert.equal(readLedger(s.out).length, 2, "and nothing is billed again");
});

test("the budget cap stops the loop before a session that could pass it", async () => {
  const s = setup("cap", { files: taskById("n-clamp").solution, final: "Done.", cost: 0.3, stop: null });
  const lines: string[] = [];
  const r = await runAll({ out: s.out, plans: [plan("n-clamp"), plan("n-chunk"), plan("n-unique")], capUsd: 0.6, perSessionUsd: 0.4, opts: s.opts, log: (l) => lines.push(l) });
  assert.equal(r.ran, 1);
  assert.equal(r.stopped, "budget");
  assert.equal(s.calls(), 1);
  assert.match(lines.join("\n"), /budget cap reached/);
  const stopped = await runAll({ out: s.out, plans: [plan("n-clamp"), plan("n-chunk")], capUsd: 0.6, perSessionUsd: 0.4, opts: s.opts, shouldStop: () => true });
  assert.equal(stopped.stopped, "target");
});

test("prepare pins the manifest, copies the plugin with hooks that drop CLAUDE_PLUGIN_DATA, and refuses a changed task set", () => {
  const s = setup("pin", { files: {}, final: "", cost: 0, stop: null });
  const hooks = JSON.parse(readFileSync(join(s.out, "plugin/hooks/hooks.json"), "utf8"));
  const stop = hooks.hooks.Stop[0].hooks[0];
  assert.equal(stop.command, "env");
  assert.deepEqual(stop.args.slice(0, 3), ["-u", "CLAUDE_PLUGIN_DATA", "node"]);
  const file = join(s.out, "manifest.json");
  const pinned = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...pinned, hash: "0".repeat(64) }));
  assert.throws(() => prepare({ out: s.out, repoRoot }), /manifest changed/);
});

test("labels follow the receipts format: a would_block stop is right only for a wrong done", async () => {
  const s = setup("labels", { files: taskById("p-dedupe").solution, final: "Done.", cost: 0.02, stop: { decision: { would_block: true, claims_done: 0.9, claims_verified: 0.1 } } });
  if (!hasPython) return;
  await runSession({ out: s.out, plan: plan("p-dedupe"), opts: s.opts });
  const bad = setup("labels2", { files: taskById("p-dedupe").wrong, final: "Done.", cost: 0.02, stop: { decision: { would_block: true, claims_done: 0.9, claims_verified: 0.1 } } });
  await runSession({ out: bad.out, plan: plan("p-dedupe"), opts: bad.opts });
  const ok = writeLabels(s.out);
  const wrong = writeLabels(bad.out);
  assert.equal(ok.labelled, 1);
  assert.equal(wrong.labelled, 1);
  assert.equal(JSON.parse(readFileSync(join(ok.merged, "labels.jsonl"), "utf8").trim()).label, "wrong");
  assert.equal(JSON.parse(readFileSync(join(wrong.merged, "labels.jsonl"), "utf8").trim()).label, "right");
  assert.ok(readFileSync(join(wrong.merged, "stops.jsonl"), "utf8").includes('"would_block":true'));
});

test("the project directory is found even when Claude Code's naming differs from ours, and by session file as a last resort", () => {
  const projects = join(root, "projects-naming");
  const work = join(root, "work-naming", "n-clamp__haiku__r1");
  mkdirSync(work, { recursive: true });
  mkdirSync(join(projects, "-some-prefix-work-n_clamp__haiku__r1"), { recursive: true });
  assert.equal(findProjectDir(projects, work, "n-clamp__haiku__r1"), join(projects, "-some-prefix-work-n_clamp__haiku__r1"));
  const other = join(root, "projects-holder");
  mkdirSync(join(other, "-completely-different"), { recursive: true });
  writeFileSync(join(other, "-completely-different", "sess-1.jsonl"), "{}\n");
  assert.equal(findProjectDir(other, work, "n-clamp__haiku__r1", "sess-1"), join(other, "-completely-different"));
  assert.equal(findProjectDir(other, work, "n-clamp__haiku__r1", "sess-2"), null);
});

test("a session whose transcript cannot be found is warned about and stage 2 counts only usable asked stops", async () => {
  const s = setup("warn", { files: taskById("n-clamp").solution, final: "Done.", cost: 0.02, stop: { decision: { would_block: false } } });
  const lines: string[] = [];
  const r = await runAll({ out: s.out, plans: [plan("n-clamp")], opts: { ...s.opts, projectsDir: join(s.out, "elsewhere") }, log: (l) => lines.push(l) });
  assert.equal(r.ran, 1);
  assert.match(lines.join("\n"), /WARNING no_transcript_found_in_projects_dir/);
  assert.equal(readGrounds(s.out)[0]?.has_transcript, false);
  assert.equal(askedCount(s.out), 1);
  const leakedRun = setup("warn2", { files: taskById("n-clamp").solution, final: "Done.", cost: 0.02, stop: { decision: { would_block: false } }, leak: "x" });
  const cfg = JSON.parse(readFileSync(process.env["STUB_CONFIG"]!, "utf8"));
  writeFileSync(process.env["STUB_CONFIG"]!, JSON.stringify({ ...cfg, leak: join(leakedRun.out, "verifiers", "n-clamp.mjs") }));
  await runSession({ out: leakedRun.out, plan: plan("n-clamp"), opts: leakedRun.opts });
  assert.equal(askedCount(leakedRun.out), 0);
});
