// Delegation A/B: pinned case hash, prompt text quoted in PREREG, arm files, plan balance, label rule, scoring, transcript and receipt parsing, a session against a stub `claude`, analysis and the pilot rule.

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ALONE_SUFFIX, CHUNK_SIZE, DELEGATION_ARMS, TASK_TEXT, chunkFiles, delegateSuffix } from "../bench/arms.mjs";
import { isTracked, sha256, armItemsJsonl, itemsHash } from "../bench/delegation-items.mjs";
import { K_MAX, analyzeDelegation, detectLeak, jevCost, judgeStats, loadDelegationCases, planDelegation, planDry, prepareDelegation, readDelegationGrounds, runDelegationSession, scoreFindings, sizeDelegationPilot, toolStats, transcriptTools, type Ground, type Item } from "../bench/delegation-session.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const prereg = readFileSync(join(repoRoot, "bench/PREREG.md"), "utf8");
const cases = loadDelegationCases(join(repoRoot, "bench/cases-delegation.json"));
const root = mkdtempSync(join(tmpdir(), "bench-deleg-"));

const mk = (n: number, tracked: number[]): Item[] => Array.from({ length: n }, (_, i) => ({ id: `n${String(i + 1).padStart(3, "0")}`, text: `// TODO: item ${i + 1}`, label: tracked.includes(i + 1) }));

test("the case file matches its hash, PREREG pins that hash, and the sizes are the registered ones", () => {
  assert.ok(prereg.includes(cases.hash));
  assert.equal(cases.cases.length, 4);
  assert.equal(cases.cases.reduce((s, c) => s + c.n_items, 0), 188);
  assert.equal(cases.cases.reduce((s, c) => s + c.n_tracked, 0), 60);
  for (const c of cases.cases) assert.match(c.sha, /^[0-9a-f]{40}$/);
  const raw = JSON.parse(readFileSync(join(repoRoot, "bench/cases-delegation.json"), "utf8"));
  assert.ok(!JSON.stringify(raw).includes("TODO("), "no item text in the committed file");
});

test("the prompt text PREREG quotes is the text the arms build", () => {
  assert.ok(prereg.includes(`> ${TASK_TEXT("N", "REPO")}`));
  assert.ok(prereg.includes(`\`${ALONE_SUFFIX}\``));
  assert.ok(prereg.includes(`> ${delegateSuffix("PLUGIN").trimStart()}`));
  assert.ok(prereg.includes('{"pack":"bench-todo","hooks":{"sessionStart":false,"stopGate":"off"}}'));
});

test("alone gets no plugin and no extra files; delegate gets chunks of at most 20, a referee.json with both hooks off, and the plugin path", () => {
  const items = mk(45, []);
  const task = { repo: "o/r", items };
  assert.equal(DELEGATION_ARMS["alone"]!.plugin, false);
  assert.deepEqual(DELEGATION_ARMS["alone"]!.files(task), {});
  assert.ok(DELEGATION_ARMS["alone"]!.prompt(task).endsWith(ALONE_SUFFIX));
  assert.ok(DELEGATION_ARMS["alone"]!.prompt(task).includes("has 45 lines"));
  const d = DELEGATION_ARMS["delegate"]!;
  assert.equal(d.plugin, true);
  const files = d.files(task);
  assert.deepEqual(Object.keys(files).sort(), [".claude/referee.json", "chunks/c01.jsonl", "chunks/c02.jsonl", "chunks/c03.jsonl"]);
  const lines = Object.entries(chunkFiles(items)).map(([, v]) => v.trim().split("\n").length);
  assert.deepEqual(lines, [CHUNK_SIZE, CHUNK_SIZE, 5]);
  const ref = JSON.parse(files[".claude/referee.json"]!);
  assert.deepEqual(ref, { pack: "bench-todo", hooks: { sessionStart: false, stopGate: "off" } });
  assert.ok(d.prompt(task, { plugin: "/p/plugin" }).includes("node /p/plugin/dist/cli.mjs judge --question todo.tracked"));
  assert.ok(!JSON.stringify(Object.values(files)).includes("label"));
});

test("plan: seeded, both arms per block, each arm first equally often, dry run is one block", () => {
  const ids = cases.cases.map((c) => c.id);
  const plan = planDelegation({ caseIds: ids, reps: 2, stage: "pilot" });
  assert.equal(plan.length, 16);
  assert.equal(new Set(plan.map((p) => p.id)).size, 16);
  assert.deepEqual(plan, planDelegation({ caseIds: ids, reps: 2, stage: "pilot" }));
  for (const arm of ["alone", "delegate"]) assert.equal(plan.filter((p) => p.arm === arm && p.position === 0).length, 4);
  for (const b of new Set(plan.map((p) => p.block))) assert.deepEqual(plan.filter((p) => p.block === b).map((p) => p.arm).sort(), ["alone", "delegate"]);
  const dry = planDry();
  assert.deepEqual(dry.map((p) => [p.case, p.arm, p.stage]), [["d-pytest", "alone", "dry"], ["d-pytest", "delegate", "dry"]]);
});

test("the label rule: references, owners and URLs are tracked, plain notes are not", () => {
  for (const t of ["// TODO: see #123", "# FIXME gh-45 later", "// TODO(joe): x", "// TODO(1.11): drop", "// XXX @alice fix", "/* HACK https://example.org/a */", "// TODO: issue 77", "// TODO PR 8"]) assert.equal(isTracked(t), true, t);
  for (const t of ["// TODO: clean up", "# FIXME this is slow", "// TODO (later) nothing", "// HACK for ie"]) assert.equal(isTracked(t), false, t);
  const items = mk(3, [2]);
  assert.equal(itemsHash(items), itemsHash(mk(3, [2])));
  assert.notEqual(itemsHash(items), itemsHash(mk(3, [3])));
  assert.equal(armItemsJsonl(items).trim().split("\n").length, 3);
  assert.ok(!armItemsJsonl(items).includes("label"));
});

test("scoring: tp, fp, fn, and invalid or repeated ids counted apart", () => {
  const items = mk(10, [1, 2, 3, 4]);
  const s = scoreFindings(items, ["n001", "n002", "n002", "n009", "zzz", 7]);
  assert.deepEqual([s.tp, s.fp, s.fn, s.invalid, s.duplicates, s.found, s.positives, s.items], [2, 1, 2, 2, 1, 3, 4, 10]);
  assert.deepEqual(scoreFindings(items, []), { tp: 0, fp: 0, fn: 4, invalid: 0, duplicates: 0, found: 0, positives: 4, items: 10 });
});

const use = (id: string, name: string, input: Record<string, unknown>) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } });
const res = (id: string, content: unknown) => JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } });

test("transcript parsing: judge calls, chunks, counts, errors, tool counts and script use", () => {
  const t = [
    use("a", "Bash", { command: "node /p/dist/cli.mjs judge --question todo.tracked --items chunks/c01.jsonl" }),
    res("a", '{"ok":true,"verdict":"flagged","items":20,"yes":5,"no":12,"review":2,"unanswered":["n009"],"stopped":["n010"],"flagged":["n001"],"receipt":"r"}'),
    use("b", "Bash", { command: "node /p/dist/cli.mjs judge --question todo.tracked --items chunks/c02.jsonl" }),
    res("b", [{ type: "text", text: '{"ok":false,"error":"rate_limited","message":"x"}' }]),
    use("c", "Write", { file_path: "/w/findings.json", content: "[]" }),
    use("d", "Read", { file_path: "/w/items.jsonl" }),
  ].join("\n");
  const tools = transcriptTools(t);
  const j = judgeStats(tools);
  assert.deepEqual([j.calls, j.answered, j.chunks_judged, j.yes, j.no, j.review, j.unanswered, j.stopped, j.errors], [2, 1, 1, 5, 12, 2, 1, 1, ["rate_limited"]]);
  const st = toolStats(tools);
  assert.deepEqual(st.counts, { Read: 1, Write: 1, Edit: 0, Bash: 2, other: 0 });
  assert.equal(st.scripted, false);
  const alone = [use("a", "Bash", { command: "python3 solve.py" }), use("b", "Write", { file_path: "/w/findings.json", content: "[]" }), use("c", "Bash", { command: "python3 late.py" })].join("\n");
  assert.equal(toolStats(transcriptTools(alone)).scripted, true);
  assert.equal(toolStats(transcriptTools([use("b", "Write", { file_path: "/w/findings.json", content: "[]" }), use("c", "Bash", { command: "python3 late.py" })].join("\n"))).scripted, false);
});

test("Jev cost is summed from the session's receipts", () => {
  const dir = join(root, "receipts-data");
  mkdirSync(join(dir, "receipts/abc"), { recursive: true });
  writeFileSync(join(dir, "receipts/abc/2026-10.jsonl"), [JSON.stringify({ cost_usd: 0.0001, input_tokens: 500, requests: 20, cached: 0 }), JSON.stringify({ cost_usd: 0.0002, input_tokens: 700, requests: 20, cached: 3 }), "not json"].join("\n"));
  assert.deepEqual(jevCost(dir), { cost_usd: 0.0003, input_tokens: 1200, requests: 40, cached: 3, receipts: 2 });
  assert.equal(jevCost(join(root, "nothing")).requests, 0);
});

const STUB = `#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const cfg = JSON.parse(readFileSync(process.env.STUB_CONFIG, "utf8"));
const cwd = process.cwd();
appendFileSync(cfg.argvLog, JSON.stringify({ argv: process.argv.slice(2), cwd }) + "\\n");
const delegate = process.argv.includes("--plugin-dir");
writeFileSync(join(cwd, "findings.json"), JSON.stringify(delegate ? cfg.delegateFound : cfg.aloneFound));
const sid = "sess-" + cwd.replace(/[^A-Za-z0-9]/g, "").slice(-14);
if (delegate) {
  mkdirSync(join(process.env.REFEREE_DATA_DIR, "receipts/p1"), { recursive: true });
  writeFileSync(join(process.env.REFEREE_DATA_DIR, "receipts/p1/2026-10.jsonl"), JSON.stringify({ cost_usd: 0.0004, input_tokens: 900, requests: 5, cached: 0 }) + "\\n");
}
const dir = join(cfg.projectsDir, realpathSync(cwd).replace(/[^A-Za-z0-9]/g, "-"));
mkdirSync(dir, { recursive: true });
const usage = { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 1000, cache_creation_input_tokens: 2000, cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 1000 } };
const asst = (rid, content) => JSON.stringify({ type: "assistant", requestId: rid, uuid: rid, message: { id: "m" + rid, model: "claude-haiku-4-5-20251001", usage, content } });
const lines = [];
if (delegate) {
  lines.push(asst("r1", [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "node " + process.argv[process.argv.indexOf("--plugin-dir") + 1] + "/dist/cli.mjs judge --question todo.tracked --items chunks/c01.jsonl" } }]));
  lines.push(JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ ok: true, verdict: "flagged", items: 6, yes: 2, no: 3, review: 1, flagged: ["n001", "n002"], review_ids: ["n006"] }) }] } }));
}
lines.push(asst("r2", [{ type: "tool_use", id: "t2", name: "Write", input: { file_path: cwd + "/findings.json", content: "[]" } }]));
writeFileSync(join(dir, sid + ".jsonl"), lines.join("\\n") + "\\n");
console.log(JSON.stringify({ type: "result", is_error: false, result: "I found some.", session_id: sid, total_cost_usd: 0.01, duration_ms: 1500, num_turns: 4, modelUsage: { "claude-haiku-4-5-20251001": {} } }));
`;

function stubSetup(name: string, config: Record<string, unknown>) {
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
  return { out, opts: { claude: bin, projectsDir }, argvLog };
}

test("a session against a stub claude: arm reaches the command line, findings are scored, Claude and Jev cost are kept apart, labels stay out of the tree", async () => {
  const items = mk(6, [1, 2, 3]);
  const fake = { hash: "h", cases: [{ id: "d-x", repo: "o/r" }], byId: { "d-x": { id: "d-x", repo: "o/r" } } };
  const s = stubSetup("session", { aloneFound: ["n001", "n004"], delegateFound: ["n001", "n002"] });
  const itemsByCase = { "d-x": items };
  prepareDelegation({ out: s.out, repoRoot, cases: fake as never, itemsByCase });
  assert.ok(existsSync(join(s.out, "plugin/packs/bench-todo/questions/judge.json")));
  assert.ok(!existsSync(join(s.out, "labels")), "no label file is written");
  const plans = planDry("d-x");
  const a = await runDelegationSession({ out: s.out, plan: plans[0]!, cases: fake as never, itemsByCase, opts: s.opts });
  const d = await runDelegationSession({ out: s.out, plan: plans[1]!, cases: fake as never, itemsByCase, opts: s.opts });
  const calls = readFileSync(s.argvLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { argv: string[]; cwd: string });
  assert.ok(!calls[0]!.argv.includes("--plugin-dir"));
  assert.ok(calls[1]!.argv.includes("--plugin-dir"));
  assert.ok(calls[1]!.argv[1]!.includes("chunks/<file>"));
  assert.ok(calls[0]!.argv[1]!.endsWith(ALONE_SUFFIX));
  const g = a.ground as Ground;
  assert.deepEqual([g["score"].tp, g["score"].fp, g["score"].fn], [1, 1, 2]);
  assert.equal(g["jev"].cost_usd, 0);
  assert.equal(g["claude_usd"], 0.00436 * 1);
  assert.equal(g["cost_source"], "transcript");
  const dg = d.ground as Ground;
  assert.deepEqual([dg["score"].tp, dg["score"].fp, dg["score"].fn], [2, 0, 1]);
  assert.equal(dg["jev"].cost_usd, 0.0004);
  assert.equal(dg["combined_usd"], 0.00912);
  assert.equal(dg["judge"].calls, 1);
  assert.equal(dg["judge"].chunks_judged, 1);
  assert.equal(dg["judge"].review, 1);
  assert.equal(dg["n_chunks"], 1);
  assert.equal(dg["leaked"], false);
  assert.ok(!existsSync(join(s.out, "work", plans[0]!.id, "labels")));
  assert.ok(!readFileSync(join(s.out, "work", plans[0]!.id, "items.jsonl"), "utf8").includes("label"));
  const again = await runDelegationSession({ out: s.out, plan: plans[0]!, cases: fake as never, itemsByCase, opts: s.opts });
  assert.equal(again.skipped, true);
  assert.equal(readDelegationGrounds(s.out).length, 2);
});

const row = (c: string, arm: string, tp: number, fp: number, fn: number, claude: number, jev = 0, extra: Record<string, unknown> = {}): Ground => ({ id: `${c}${arm}${tp}${claude}`, case: c, arm, stage: "pilot", leaked: false, run_failed: false, timed_out: false, has_transcript: true, findings_status: "ok", scripted: false, n_chunks: 2, score: { tp, fp, fn, invalid: 0, duplicates: 0, items: (tp + fn) * 4 }, judge: { calls: arm === "delegate" ? 2 : 0, chunks_judged: arm === "delegate" ? 2 : 0, yes: 5, no: 30, review: 3, unanswered: 0, stopped: 0, errors: [] }, jev: { cost_usd: jev, input_tokens: 100, requests: 40, cached: 0 }, claude_usd: claude, combined_usd: claude + jev, cost_account: { tokens: { input: 10, output: 20, cache5m: 0, cache1h: 100, cacheRead: 500 } }, cost_reconcile: { reported_usd: claude }, duration_ms: 1000, turns: 3, tool_counts: { Read: 1, Write: 1, Edit: 0, Bash: 0, other: 0 }, ...extra });

test("analysis: pooled precision and recall with exact intervals, differences, gate, cost ratios and the flag-everything baseline", () => {
  const grounds: Ground[] = [];
  for (const c of ["a", "b", "c", "d"]) for (let rep = 0; rep < 2; rep++) grounds.push(row(c, "alone", 80, 10, 20, 0.1 + rep * 0.01), row(c, "delegate", 80, 10, 20, 0.05, 0.001));
  const r = analyzeDelegation(grounds);
  assert.equal(r.accuracy.alone.recall, 0.8);
  assert.equal(r.accuracy.alone.precision, 0.889);
  assert.deepEqual(r.accuracy.alone.flag_all_baseline, { precision: 0.25, recall: 1 });
  assert.equal(r.recall_diff.diff, 0);
  assert.equal(r.gate.passes, true);
  assert.equal(r.cost.alone.sessions, 8);
  assert.equal(r.cost.delegate.jev_usd, 0.008);
  assert.ok(r.ratios.combined_usd.ratio < 1 && r.ratios.combined_usd.ratio > 0.4);
  assert.ok(r.ratios.claude_tokens.ratio === 1);
  assert.equal(r.delegation.called_judge_on_every_chunk, 8);
  const worse: Ground[] = [];
  for (const c of ["a", "b"]) worse.push(row(c, "alone", 9, 0, 1, 0.1), row(c, "delegate", 2, 0, 8, 0.05));
  assert.equal(analyzeDelegation(worse).gate.passes, false);
  assert.equal(analyzeDelegation([...grounds, row("a", "delegate", 10, 0, 0, 0.01, 0, { leaked: true })]).leaked, 1);
});

test("pilot rule: stop on failures, worse accuracy or no saving; otherwise K from the spread of the per-case log ratio", () => {
  const ok: Ground[] = [];
  const spread = [0.5, 0.52, 0.48, 0.51];
  ["a", "b", "c", "d"].forEach((c, i) => {
    for (let rep = 0; rep < 2; rep++) ok.push(row(c, "alone", 8, 1, 2, 0.1), row(c, "delegate", 8, 1, 2, 0.1 * spread[i]!));
  });
  const run = sizeDelegationPilot(ok);
  assert.equal(run.decision, "run");
  assert.ok(run.cases >= 4 && run.cases <= K_MAX);
  assert.equal(run.reps, 2);
  const noSaving = ok.map((g) => (g["arm"] === "delegate" ? { ...g, combined_usd: 0.2 } : g));
  assert.equal(sizeDelegationPilot(noSaving).decision, "stop");
  assert.ok(sizeDelegationPilot(noSaving).reasons.some((x: string) => x.includes("cost ratio")));
  const worse = ok.map((g) => (g["arm"] === "delegate" ? { ...g, score: { ...g["score"], tp: 2, fn: 8 } } : g));
  assert.ok(sizeDelegationPilot(worse).reasons.some((x: string) => x.includes("recall")));
  const failing = ok.map((g, i) => (i % 2 === 0 && g["arm"] === "alone" ? { ...g, findings_status: "missing" } : g));
  assert.ok(sizeDelegationPilot(failing).reasons.some((x: string) => x.includes("quarter")));
  const wide: Ground[] = [];
  [0.05, 0.9, 0.2, 0.95].forEach((m, i) => wide.push(row(`w${i}`, "alone", 8, 1, 2, 0.1), row(`w${i}`, "delegate", 8, 1, 2, 0.1 * m)));
  const u = sizeDelegationPilot(wide);
  assert.equal(u.decision, "run_underpowered");
  assert.equal(u.cases, K_MAX);
  assert.equal(sha256("x").length, 64);
});

const tu = (name: string, input: Record<string, unknown>) => JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", id: `t${Math.random()}`, name, input }] } });

test("leak detection: relative and absolute reads outside the work tree are leaked, the work tree and plugin copy are not", () => {
  const out = "/o/run";
  const ctx = { out, work: `${out}/work/s1`, plugin: `${out}/plugin` };
  assert.equal(detectLeak(tu("Read", { file_path: `${out}/work/s1/items.jsonl` }), ctx), false);
  assert.equal(detectLeak(tu("Read", { file_path: "items.jsonl" }), ctx), false);
  assert.equal(detectLeak(tu("Read", { file_path: `${out}/plugin/packs/bench-todo/questions/judge.json` }), ctx), false);
  assert.equal(detectLeak(tu("Bash", { command: "ls /usr/bin | head" }), ctx), false);
  assert.equal(detectLeak(tu("Read", { file_path: "../../labels/d-pytest.json" }), ctx), true);
  assert.equal(detectLeak(tu("Bash", { command: "cat ../s2/findings.json" }), ctx), true);
  assert.equal(detectLeak(tu("Read", { file_path: `${out}/work/s2/findings.json` }), ctx), true);
  assert.equal(detectLeak(tu("Bash", { command: "cat ground.json" }), ctx), true);
});

test("a leaked session removes its whole (case, rep) block from the analysis and the pilot rule, so the arms stay paired", () => {
  const g = [row("a", "alone", 5, 0, 5, 1), row("a", "delegate", 5, 0, 5, 0.5, 0, { leaked: true }), row("b", "alone", 5, 0, 5, 1), row("b", "delegate", 5, 0, 5, 2)];
  const r = analyzeDelegation(g);
  assert.equal(r.leaked, 1);
  assert.equal(r.excluded_sessions, 2);
  assert.equal(r.cost.alone.sessions, 1);
  assert.equal(r.cost.delegate.sessions, 1);
  assert.equal(r.ratios.combined_usd.ratio, 2);
  const withRep = g.map((x, i) => ({ ...x, rep: 1 + (i > 1 ? 1 : 0) }));
  assert.equal(analyzeDelegation(withRep).cost.alone.sessions, 1);
  assert.equal(sizeDelegationPilot(withRep).cost_ratio, 2);
});
