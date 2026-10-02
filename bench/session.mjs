// One A/B session: builds the arm's work tree from the frozen case, runs `claude -p`, harvests the transcript, runs the hidden verifier and writes ground.json.
// Resumable like the base-rate study: a finished session (ground.json) is never rerun and spend is written to ledger.jsonl before anything else can fail.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { ARMS } from "./arms.mjs";
import { classifyClaim, sessionClass } from "./classify.mjs";
import { accountTranscript, reconcile, sessionCost } from "./cost.mjs";

export const ALLOWED_TOOLS = "Read,Edit,Write,Bash(node *),Bash(python3 *),Bash(npm test*),Bash(make test*)";
export const SESSION_TIMEOUT_MS = 300_000;
export const PER_SESSION_USD = 0.4;

const readJson = (path, fallback = null) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};
const readLines = (path) => {
  try {
    return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
};
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1) + "\n");
  renameSync(tmp, path);
};

export const paths = (out, id) => ({ work: join(out, "work", id), data: join(out, "data", id), session: join(out, "sessions", id) });
export const ledgerFile = (out) => join(out, "ledger.jsonl");
export const readLedger = (out) => readLines(ledgerFile(out));
export const spentUsd = (entries) => entries.reduce((sum, e) => sum + (Number.isFinite(e.usd) ? e.usd : 0), 0);
export const mayStart = (entries, capUsd, perSessionUsd = PER_SESSION_USD) => spentUsd(entries) + perSessionUsd <= capUsd + 1e-9;

const sha = (text) => createHash("sha256").update(text).digest("hex");

export function loadCases(file) {
  const data = readJson(file);
  if (!data?.tasks) throw new Error(`cannot read cases from ${file}`);
  const hash = sha(JSON.stringify(data.tasks));
  if (hash !== data.hash) throw new Error(`cases.json does not match its recorded hash (${hash.slice(0, 12)} vs ${String(data.hash).slice(0, 12)})`);
  return { hash, tasks: data.tasks, byId: Object.fromEntries(data.tasks.map((t) => [t.id, t])) };
}

function writeTree(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

// Verifiers and the plugin copy live in the out directory, never in a task tree. The case hash is pinned after the first call.
export function prepare({ out, repoRoot, cases }) {
  mkdirSync(join(out, "verifiers"), { recursive: true });
  const pinned = readJson(join(out, "manifest.json"));
  if (pinned && pinned.hash !== cases.hash) throw new Error(`case set changed since the run started (${pinned.hash.slice(0, 12)} -> ${cases.hash.slice(0, 12)}); refusing to continue`);
  const hookFile = join(repoRoot, "plugins/claude-referee/dist/hook.mjs");
  const pluginSha = existsSync(hookFile) ? sha(readFileSync(hookFile)) : null;
  if (!pinned) writeJson(join(out, "manifest.json"), { hash: cases.hash, ids: cases.tasks.map((t) => t.id), plugin_hook_sha256: pluginSha, pinned_at: new Date().toISOString() });
  for (const t of cases.tasks) writeFileSync(join(out, "verifiers", `${t.id}.${t.verifier_ext}`), t.verifier);
  const plugin = join(out, "plugin");
  if (!existsSync(plugin) && existsSync(join(repoRoot, "plugins/claude-referee"))) {
    cpSync(join(repoRoot, "plugins/claude-referee"), plugin, { recursive: true });
    const hooksPath = join(plugin, "hooks/hooks.json");
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    for (const groups of Object.values(hooks.hooks)) for (const group of groups) for (const hook of group.hooks) {
      hook.args = ["-u", "CLAUDE_PLUGIN_DATA", hook.command, ...hook.args];
      hook.command = "env";
    }
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  }
}

function git(dir, args) {
  const r = spawnSync("git", ["-c", "user.name=bench", "-c", "user.email=bench@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || "").slice(0, 200)}`);
}

export function makeWorkTree(dir, task, arm) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeTree(dir, task.files);
  writeTree(dir, arm.files(task));
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "starter"]);
}

export function parseRun(stdout) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    return null;
  }
  const result = Array.isArray(value) ? value.findLast((v) => v?.type === "result") : value;
  return result && typeof result === "object" ? result : null;
}

function runClaude({ claude, prompt, cwd, model, plugin, dataDir, perSessionUsd, timeoutMs, extraEnv }) {
  const args = ["-p", prompt, "--setting-sources", "project,local", "--permission-mode", "acceptEdits", "--allowedTools", ALLOWED_TOOLS, "--model", model, "--output-format", "json", "--max-budget-usd", String(perSessionUsd)];
  if (plugin) args.splice(2, 0, "--plugin-dir", plugin);
  const env = { ...process.env, REFEREE_DATA_DIR: dataDir, ...extraEnv };
  delete env["CLAUDE_PLUGIN_DATA"];
  delete env["CLAUDE_CONFIG_DIR"];
  return new Promise((resolveRun) => {
    const started = Date.now();
    const child = spawn(claude, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolveRun({ status: null, stdout, stderr: String(e), timedOut, ms: Date.now() - started });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolveRun({ status, stdout, stderr, timedOut, ms: Date.now() - started });
    });
  });
}

const alnum = (text) => text.replace(/[^A-Za-z0-9]/g, "");
export const encodeProjectDir = (path) => path.replace(/[^A-Za-z0-9]/g, "-");

// Finds the project directory Claude Code made for the work tree: the exact encoding, then the same name ignoring punctuation, then whichever holds the session's transcript.
export function findProjectDir(projectsDir, workDir, id, sessionId = "") {
  if (!existsSync(projectsDir)) return null;
  const exact = join(projectsDir, encodeProjectDir(realpathSync(workDir)));
  if (existsSync(exact)) return exact;
  const names = readdirSync(projectsDir);
  const loose = names.find((name) => alnum(name).endsWith(alnum(`work${id}`)));
  if (loose) return join(projectsDir, loose);
  const holder = sessionId ? names.find((name) => existsSync(join(projectsDir, name, `${sessionId}.jsonl`))) : undefined;
  return holder ? join(projectsDir, holder) : null;
}

// Copies every transcript file of the session (the main one first); removes the project directory only when it lies inside projectsDir.
export function harvestTranscripts({ projectsDir, workDir, id, sessionId, dest }) {
  const dir = findProjectDir(projectsDir, workDir, id, sessionId);
  if (!dir) return { main: false, extra: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const wanted = sessionId && files.includes(`${sessionId}.jsonl`) ? `${sessionId}.jsonl` : files[0];
  let main = false;
  let extra = 0;
  if (wanted) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(dir, wanted), dest);
    main = true;
    for (const f of files.filter((x) => x !== wanted)) {
      cpSync(join(dir, f), join(dirname(dest), `extra-${f}`));
      extra++;
    }
  }
  if (main && resolve(dir).startsWith(resolve(projectsDir) + sep)) rmSync(dir, { recursive: true, force: true });
  return { main, extra };
}

export function runVerifier({ out, task, workDir, timeoutMs = 30_000 }) {
  const verifier = join(out, "verifiers", `${task.id}.${task.verifier_ext}`);
  const cmd = task.verifier_ext === "mjs" ? "node" : "python3";
  const r = spawnSync(cmd, [verifier, workDir], { cwd: workDir, encoding: "utf8", timeout: timeoutMs });
  const status = r.status === 0 ? "pass" : r.status === 1 ? "fail" : "error";
  return { status, exit: r.status, tail: `${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-1500) };
}

// Stop hook runs and /goal verdicts as Claude Code records them in the transcript: `system` lines with subtype stop_hook_summary and `goal_status` attachments.
function transcriptEvents(transcript) {
  const summaries = [];
  const goal = [];
  for (const raw of String(transcript).split("\n")) {
    if (!raw.includes("stop_hook_summary") && !raw.includes("goal_status")) continue;
    try {
      const e = JSON.parse(raw);
      if (e?.subtype === "stop_hook_summary") summaries.push({ prevented: e.preventedContinuation === true, errors: (e.hookErrors ?? []).length });
      if (e?.attachment?.type === "goal_status" && e.attachment.sentinel !== true) goal.push(e.attachment.met === true);
    } catch {
      continue;
    }
  }
  return { summaries, goal };
}

// What each arm's mechanism left in the artefacts, counted from files and never from Jev: referee stops, hook runs and blocks, goal verdicts.
export function armEvidence({ armId, dataDir, transcript }) {
  const ev = transcriptEvents(transcript);
  const hooks = { stop_hook_runs: ev.summaries.length, stop_hook_blocks: ev.summaries.filter((x) => x.prevented).length, stop_hook_errors: ev.summaries.reduce((s, x) => s + x.errors, 0) };
  if (armId === "referee") {
    const stops = readLines(join(dataDir, "stops.jsonl"));
    const asked = stops.filter((s) => !s.skipped);
    return { ...hooks, stops: stops.length, asked: asked.length, would_block: asked.filter((s) => s.decision?.would_block === true).length, skipped: stops.filter((s) => s.skipped).map((s) => s.skipped), last: stops.at(-1) ? { mode: stops.at(-1).mode, skipped: stops.at(-1).skipped ?? null, would_block: stops.at(-1).decision?.would_block ?? null, ms: stops.at(-1).ms ?? null } : null };
  }
  if (armId === "goal") return { ...hooks, goal_verdicts: ev.goal.length, goal_met: ev.goal.filter(Boolean).length };
  if (armId === "testhook") return hooks;
  return {};
}

export async function runSession({ out, plan, cases, opts = {} }) {
  const { claude = "claude", projectsDir, perSessionUsd = PER_SESSION_USD, timeoutMs = SESSION_TIMEOUT_MS, extraEnv = {} } = opts;
  const task = cases.byId[plan.task];
  const arm = ARMS[plan.arm];
  if (!task || !arm) throw new Error(`unknown task or arm in ${plan.id}`);
  const p = paths(out, plan.id);
  if (existsSync(join(p.session, "ground.json"))) return { id: plan.id, skipped: true };
  mkdirSync(p.session, { recursive: true });
  const runFile = join(p.session, "run.json");
  let run = readJson(runFile);
  if (!run) {
    makeWorkTree(p.work, task, arm);
    rmSync(p.data, { recursive: true, force: true });
    mkdirSync(p.data, { recursive: true });
    const r = await runClaude({ claude, prompt: arm.prompt(task), cwd: p.work, model: plan.model, plugin: arm.plugin ? join(out, "plugin") : null, dataDir: p.data, perSessionUsd, timeoutMs, extraEnv: arm.plugin ? extraEnv : {} });
    const parsed = parseRun(r.stdout);
    const reported = parsed && Number.isFinite(parsed.total_cost_usd);
    appendFileSync(ledgerFile(out), JSON.stringify({ id: plan.id, usd: reported ? parsed.total_cost_usd : perSessionUsd, estimated: !reported, ts: new Date().toISOString() }) + "\n");
    run = { plan, ran_at: new Date().toISOString(), status: r.status, timed_out: r.timedOut, ms: r.ms, stderr_tail: r.stderr.slice(-500), result: parsed };
    writeJson(runFile, run);
  }
  const parsed = run.result;
  const sessionUuid = typeof parsed?.session_id === "string" ? parsed.session_id : "";
  const transcriptFile = join(p.session, "transcript.jsonl");
  let extra = 0;
  if (!existsSync(transcriptFile) && projectsDir) extra = harvestTranscripts({ projectsDir, workDir: p.work, id: plan.id, sessionId: sessionUuid, dest: transcriptFile }).extra;
  const transcript = existsSync(transcriptFile) ? readFileSync(transcriptFile, "utf8") : "";
  const extras = existsSync(p.session) ? readdirSync(p.session).filter((f) => f.startsWith("extra-")) : [];
  const allTranscript = [transcript, ...extras.map((f) => readFileSync(join(p.session, f), "utf8"))].join("\n");
  const warnings = [];
  if (!transcript) warnings.push(projectsDir ? "no_transcript_found_in_projects_dir" : "no_projects_dir");
  if (extra > 0 || extras.length > 0) warnings.push("extra_transcript_files");
  const verifier = runVerifier({ out, task, workDir: p.work });
  writeFileSync(join(p.session, "verifier.txt"), `exit ${verifier.exit}\n${verifier.tail}`);
  const finalMessage = typeof parsed?.result === "string" ? parsed.result : "";
  const runFailed = !parsed || parsed.is_error === true || run.timed_out === true;
  const claim = classifyClaim(finalMessage);
  const isLeaked = [join(out, "verifiers"), task.id + "." + task.verifier_ext].some((m) => allTranscript.includes(m));
  let account = null;
  try {
    account = accountTranscript(allTranscript);
  } catch (e) {
    warnings.push(`cost_error:${String(e.message).slice(0, 120)}`);
  }
  const cost = sessionCost({ account, result: parsed, capUsd: perSessionUsd });
  const ground = {
    id: plan.id,
    task: plan.task,
    role: task.role,
    kind: task.kind,
    lang: task.lang,
    arm: plan.arm,
    model: plan.model,
    model_id: parsed?.modelUsage ? Object.keys(parsed.modelUsage).join(",") : null,
    rep: plan.rep,
    block: plan.block ?? null,
    position: plan.position ?? null,
    stage: plan.stage ?? null,
    session_id: sessionUuid || null,
    verifier: verifier.status,
    final_message: finalMessage,
    claim,
    leaked: isLeaked,
    run_failed: runFailed,
    timed_out: run.timed_out === true,
    has_transcript: transcript !== "",
    warnings: [...warnings, ...(account?.warnings ?? [])],
    arm_evidence: armEvidence({ armId: plan.arm, dataDir: p.data, transcript: allTranscript }),
    cost_usd: cost.usd,
    cost_source: cost.source,
    cost_account: account,
    cost_reconcile: account ? reconcile(account, parsed) : null,
    duration_ms: parsed?.duration_ms ?? run.ms,
    turns: parsed?.num_turns ?? null,
    class: sessionClass({ claim, verifier: verifier.status, leaked: isLeaked, runFailed }),
  };
  writeJson(join(p.session, "ground.json"), ground);
  return { id: plan.id, ground };
}

// Runs the plans in order; stops before a session whose worst case would pass the cap.
export async function runAll({ out, plans, cases, capUsd, perSessionUsd = PER_SESSION_USD, opts = {}, log = () => {} }) {
  const summary = { ran: 0, skipped: 0, stopped: null };
  for (const plan of plans) {
    if (existsSync(join(paths(out, plan.id).session, "ground.json"))) {
      summary.skipped++;
      continue;
    }
    const ledger = readLedger(out);
    if (!mayStart(ledger, capUsd, perSessionUsd)) {
      summary.stopped = "budget";
      log(`budget cap reached: spent ${spentUsd(ledger).toFixed(4)} of ${capUsd} USD, the next session could cost up to ${perSessionUsd}`);
      break;
    }
    const r = await runSession({ out, plan, cases, opts: { ...opts, perSessionUsd } });
    summary.ran++;
    log(`${plan.id}: ${r.ground?.class} (${r.ground?.cost_usd ?? "?"} USD, ${r.ground?.cost_source})${r.ground?.warnings?.length ? ` WARNING ${r.ground.warnings.join(",")}` : ""}`);
  }
  summary.spent_usd = Math.round(spentUsd(readLedger(out)) * 10000) / 10000;
  return summary;
}

export function readGrounds(out) {
  const manual = readJson(join(out, "manual.json"), {});
  const dir = join(out, "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((id) => readJson(join(dir, id, "ground.json")))
    .filter(Boolean)
    .map((g) => {
      const resolved = g.claim === "ambiguous" && manual?.[g.id] ? manual[g.id] : g.claim;
      return { ...g, claim_resolved: resolved, class: sessionClass({ claim: resolved, verifier: g.verifier, leaked: g.leaked, runFailed: g.run_failed }) };
    });
}

export const ambiguousPending = (out) => readGrounds(out).filter((g) => g.claim === "ambiguous" && !readJson(join(out, "manual.json"), {})[g.id]);

export function setManual(out, id, value) {
  if (!["claim", "no_claim"].includes(value)) throw new Error("the manual label is claim or no_claim");
  const file = join(out, "manual.json");
  const manual = readJson(file, {});
  manual[id] = value;
  writeJson(file, manual);
}
