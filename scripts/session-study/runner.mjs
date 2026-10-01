// Session runner of the base-rate study: prepares the out directory, runs one headless session per plan, harvests transcript and stop record, runs the hidden verifier and writes the ground-truth line.
// Resumable and idempotent: every step leaves a file, a finished session (ground.json) is never rerun, spend is counted in ledger.jsonl before anything else can fail, and a cap stops the loop.

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { PER_SESSION_USD, CAP_USD, bashCommands, classifyClaim, encodeProjectDir, leaked, mayStart, ranOwnCode, sessionClass, spentUsd } from "./lib.mjs";
import { manifest, promptFor, taskById, verifierCommand, verifierExt, verifierSource } from "./tasks.mjs";

export const ALLOWED_TOOLS = "Read,Edit,Write,Bash(node *),Bash(python3 *),Bash(npm test*),Bash(make test*)";
export const SESSION_TIMEOUT_MS = 300_000;
const REFEREE_JSON = JSON.stringify({ pack: "generic", hooks: { stopGate: "shadow" } }) + "\n";

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

export const paths = (out, id) => ({
  work: join(out, "work", id),
  data: join(out, "data", id),
  session: join(out, "sessions", id),
});
export const ledgerFile = (out) => join(out, "ledger.jsonl");
export const readLedger = (out) => readLines(ledgerFile(out));

function writeTree(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

// Verifiers and the plugin copy live in the out directory, never inside a task tree. The manifest hash pins the task set after the first run.
export function prepare({ out, repoRoot }) {
  mkdirSync(join(out, "verifiers"), { recursive: true });
  const current = manifest();
  const pinned = readJson(join(out, "manifest.json"));
  if (pinned && pinned.hash !== current.hash) throw new Error(`task manifest changed since the study started (${pinned.hash.slice(0, 12)} -> ${current.hash.slice(0, 12)}); refusing to continue`);
  if (!pinned) writeJson(join(out, "manifest.json"), { ...current, pinned_at: new Date().toISOString() });
  for (const id of current.ids) {
    const task = taskById(id);
    writeFileSync(join(out, "verifiers", `${id}.${verifierExt(task)}`), verifierSource(task));
  }
  const plugin = join(out, "plugin");
  if (!existsSync(plugin)) {
    cpSync(join(repoRoot, "plugins/evidence-referee"), plugin, { recursive: true });
    const hooksPath = join(plugin, "hooks/hooks.json");
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    for (const groups of Object.values(hooks.hooks)) for (const group of groups) for (const hook of group.hooks) {
      hook.args = ["-u", "CLAUDE_PLUGIN_DATA", hook.command, ...hook.args];
      hook.command = "env";
    }
    writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  }
  return current;
}

function git(dir, args) {
  const r = spawnSync("git", ["-c", "user.name=study", "-c", "user.email=study@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || "").slice(0, 200)}`);
}

export function makeWorkTree(dir, task) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeTree(dir, task.files);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  writeFileSync(join(dir, ".claude/referee.json"), REFEREE_JSON);
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "starter"]);
}

function parseRun(stdout) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    return null;
  }
  const result = Array.isArray(value) ? value.findLast((v) => v?.type === "result") : value;
  return result && typeof result === "object" ? result : null;
}

function runClaude({ claude, prompt, cwd, model, plugin, dataDir, perSessionUsd, timeoutMs }) {
  const args = ["-p", prompt, "--plugin-dir", plugin, "--setting-sources", "project,local", "--permission-mode", "acceptEdits", "--allowedTools", ALLOWED_TOOLS, "--model", model, "--output-format", "json", "--max-budget-usd", String(perSessionUsd)];
  const env = { ...process.env, REFEREE_DATA_DIR: dataDir };
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

// Finds the directory Claude Code made for the working directory without trusting its naming rule: the exact encoding first, then the same
// name with punctuation ignored, then any directory that holds this session's transcript. Removes nothing outside projectsDir.
const alnum = (text) => text.replace(/[^A-Za-z0-9]/g, "");
export function findProjectDir(projectsDir, workDir, id, sessionId = "") {
  if (!existsSync(projectsDir)) return null;
  const exact = join(projectsDir, encodeProjectDir(realpathSync(workDir)));
  if (existsSync(exact)) return exact;
  const names = readdirSync(projectsDir);
  const tail = alnum(`work${id}`);
  const loose = names.find((name) => alnum(name).endsWith(tail));
  if (loose) return join(projectsDir, loose);
  const holder = sessionId ? names.find((name) => existsSync(join(projectsDir, name, `${sessionId}.jsonl`))) : undefined;
  return holder ? join(projectsDir, holder) : null;
}

export function harvestTranscript({ projectsDir, workDir, id, sessionId, dest }) {
  const dir = findProjectDir(projectsDir, workDir, id, sessionId);
  if (!dir) return false;
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  const wanted = sessionId && files.includes(`${sessionId}.jsonl`) ? `${sessionId}.jsonl` : files[0];
  let copied = false;
  if (wanted) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(dir, wanted), dest);
    copied = true;
  }
  if (copied && resolve(dir).startsWith(resolve(projectsDir) + sep)) rmSync(dir, { recursive: true, force: true });
  return copied;
}

export function runVerifier({ out, task, workDir, timeoutMs = 30_000 }) {
  const verifier = join(out, "verifiers", `${task.id}.${verifierExt(task)}`);
  const [cmd, args] = verifierCommand(task, verifier, workDir);
  const r = spawnSync(cmd, args, { cwd: workDir, encoding: "utf8", timeout: timeoutMs });
  const status = r.status === 0 ? "pass" : r.status === 1 ? "fail" : "error";
  return { status, exit: r.status, tail: `${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-1500) };
}

function lastStop(dataDir, sessionId) {
  const records = readLines(join(dataDir, "stops.jsonl")).filter((r) => !sessionId || r.session_id === sessionId || r.session_id === "unknown");
  const r = records.at(-1);
  if (!r) return null;
  return { id: r.id, skipped: r.skipped, would_block: r.decision?.would_block, claims_done: r.decision?.claims_done, claims_verified: r.decision?.claims_verified, ms: r.ms, checks: r.checks, edits: r.edits, records: records.length };
}

// One session: each step is skipped when its file exists, so a crash resumes where it stopped without paying twice.
export async function runSession({ out, plan, opts = {} }) {
  const { claude = "claude", projectsDir, perSessionUsd = PER_SESSION_USD, timeoutMs = SESSION_TIMEOUT_MS } = opts;
  const task = taskById(plan.task);
  const p = paths(out, plan.id);
  if (existsSync(join(p.session, "ground.json"))) return { id: plan.id, skipped: true };
  mkdirSync(p.session, { recursive: true });
  const runFile = join(p.session, "run.json");
  let run = readJson(runFile);
  if (!run) {
    makeWorkTree(p.work, task);
    rmSync(p.data, { recursive: true, force: true });
    mkdirSync(p.data, { recursive: true });
    const r = await runClaude({ claude, prompt: promptFor(task), cwd: p.work, model: plan.model, plugin: join(out, "plugin"), dataDir: p.data, perSessionUsd, timeoutMs });
    const parsed = parseRun(r.stdout);
    const usd = parsed && Number.isFinite(parsed.total_cost_usd) ? parsed.total_cost_usd : perSessionUsd;
    appendFileSync(ledgerFile(out), JSON.stringify({ id: plan.id, usd, estimated: !(parsed && Number.isFinite(parsed.total_cost_usd)), ts: new Date().toISOString() }) + "\n");
    run = { plan, ran_at: new Date().toISOString(), status: r.status, timed_out: r.timedOut, ms: r.ms, stderr_tail: r.stderr.slice(-500), result: parsed };
    writeJson(runFile, run);
  }
  const parsed = run.result;
  const sessionUuid = typeof parsed?.session_id === "string" ? parsed.session_id : "";
  const transcriptFile = join(p.session, "transcript.jsonl");
  if (!existsSync(transcriptFile) && projectsDir) harvestTranscript({ projectsDir, workDir: p.work, id: plan.id, sessionId: sessionUuid, dest: transcriptFile });
  const transcript = existsSync(transcriptFile) ? readFileSync(transcriptFile, "utf8") : "";
  const warnings = [];
  if (!transcript) warnings.push(projectsDir ? "no_transcript_found_in_projects_dir" : "no_projects_dir");
  const stopsFile = join(p.data, "stops.jsonl");
  if (existsSync(stopsFile)) writeFileSync(join(p.session, "stops.jsonl"), readFileSync(stopsFile));
  const verifier = runVerifier({ out, task, workDir: p.work });
  writeFileSync(join(p.session, "verifier.txt"), `exit ${verifier.exit}\n${verifier.tail}`);
  const finalMessage = typeof parsed?.result === "string" ? parsed.result : "";
  const runFailed = !parsed || parsed.is_error === true || run.timed_out === true;
  const claim = classifyClaim(finalMessage);
  const isLeaked = leaked(transcript, [join(out, "verifiers")]);
  const stop = lastStop(p.data, sessionUuid);
  const ground = {
    id: plan.id,
    task: plan.task,
    kind: task.kind,
    lang: task.lang,
    model: plan.model,
    model_id: parsed?.modelUsage ? Object.keys(parsed.modelUsage).join(",") : null,
    rep: plan.rep,
    session_id: sessionUuid || null,
    verifier: verifier.status,
    final_message: finalMessage,
    claim,
    leaked: isLeaked,
    run_failed: runFailed,
    has_transcript: transcript !== "",
    warnings,
    ran_own_code: ranOwnCode(transcript),
    bash_commands: bashCommands(transcript).length,
    stop,
    cost_usd: parsed && Number.isFinite(parsed.total_cost_usd) ? parsed.total_cost_usd : null,
    duration_ms: parsed?.duration_ms ?? run.ms,
    turns: parsed?.num_turns ?? null,
    class: sessionClass({ claim, verifier: verifier.status, leaked: isLeaked, runFailed }),
  };
  writeJson(join(p.session, "ground.json"), ground);
  return { id: plan.id, ground };
}

// Runs the plans in order and stops before a session whose worst case would pass the cap, or when `shouldStop` says the target is met.
export async function runAll({ out, plans, capUsd = CAP_USD, perSessionUsd = PER_SESSION_USD, opts = {}, shouldStop = () => false, log = () => {} }) {
  const summary = { ran: 0, skipped: 0, stopped: null };
  for (const plan of plans) {
    if (existsSync(join(paths(out, plan.id).session, "ground.json"))) {
      summary.skipped++;
      continue;
    }
    if (shouldStop()) {
      summary.stopped = "target";
      break;
    }
    const ledger = readLedger(out);
    if (!mayStart(ledger, capUsd, perSessionUsd)) {
      summary.stopped = "budget";
      log(`budget cap reached: spent ${spentUsd(ledger).toFixed(4)} of ${capUsd} USD, the next session could cost up to ${perSessionUsd}`);
      break;
    }
    const r = await runSession({ out, plan, opts: { ...opts, perSessionUsd } });
    summary.ran++;
    log(`${plan.id}: ${r.ground?.class} (${r.ground?.cost_usd ?? "?"} USD)${r.ground?.warnings?.length ? ` WARNING ${r.ground.warnings.join(",")}` : ""}`);
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

// Writes labels.jsonl next to each session's stops.jsonl in the format `receipts --stops` reads, and a merged directory for one combined view.
export function writeLabels(out) {
  const grounds = readGrounds(out).filter((g) => g.stop?.id && g.stop.would_block === true && !["leaked", "run_failed", "error", "unresolved"].includes(g.class));
  const now = new Date().toISOString();
  const merged = join(out, "merged");
  rmSync(merged, { recursive: true, force: true });
  mkdirSync(merged, { recursive: true });
  let labelled = 0;
  for (const g of grounds) {
    const line = JSON.stringify({ id: g.stop.id, label: g.class === "wrong_done" ? "right" : "wrong", labelled_at: now }) + "\n";
    writeFileSync(join(paths(out, g.id).data, "labels.jsonl"), line);
    appendFileSync(join(merged, "labels.jsonl"), line);
    labelled++;
  }
  for (const g of readGrounds(out)) {
    const file = join(paths(out, g.id).data, "stops.jsonl");
    if (!["leaked", "run_failed", "error", "unresolved"].includes(g.class) && existsSync(file)) appendFileSync(join(merged, "stops.jsonl"), readFileSync(file));
  }
  return { labelled, merged };
}

// Asked stops of sessions that count, the same filter the analysis uses; stage 2 stops at the registered target.
export function askedCount(out) {
  return readGrounds(out).filter((g) => !["leaked", "run_failed", "error", "unresolved"].includes(g.class) && g.stop && !g.stop.skipped && g.stop.would_block !== undefined).length;
}

export function ambiguousPending(out) {
  const manual = readJson(join(out, "manual.json"), {});
  return readGrounds(out).filter((g) => g.claim === "ambiguous" && !manual[g.id]);
}

export function setManual(out, id, value) {
  if (!["claim", "no_claim"].includes(value)) throw new Error("the manual label is claim or no_claim");
  const file = join(out, "manual.json");
  const manual = readJson(file, {});
  manual[id] = value;
  writeJson(file, manual);
}
