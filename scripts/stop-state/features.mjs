// Inputs of the stop-state study (docs/decisions/stop-state-design.md): ground records, the task split, change content, requirements and check results from a transcript, the 26 configurations and their request state.
// Pure apart from reading study directories; transcripts are read from local study directories and never copied into the repository.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stopSkipReason } from "../../src/engine/stopgate/decide.ts";
import { analyzeTranscript } from "../../src/engine/stopgate/transcript.ts";
import { parseEvidence } from "../../src/engine/runners/index.ts";
import { mulberry32, SEED } from "./stats.mjs";

export const SIZES = [2000, 6000, 16000];
export const SPEC_CAP = 6000;
export const EXCLUDED = ["leaked", "run_failed", "error", "unresolved"];

const L = "(?<![\\p{L}\\p{N}])";
const R = "(?![\\p{L}\\p{N}])";
const SUCCESS = new RegExp(`${L}(?:done|complete|completed|finished|implemented|fixed|works|working|passes|passing|passed|resolved|ready|all tests pass|tamam|tamamlandı|bitti|çalışıyor|düzeltildi)${R}`, "iu");
const NEGATIVE = new RegExp(
  `${L}(?:could not|couldn't|can't|cannot|unable|not (?:yet )?(?:complete|completed|done|finished|working|implemented|verified|tested)|still (?:fail\\w*|broken)|doesn't work|does not work|didn't (?:run|test|verify)|did not (?:run|test|verify)|haven't|have not|blocked|partial|partially|unverified|untested)${R}`,
  "iu",
);

export function classifyClaim(text) {
  const t = String(text ?? "").replace(/[‘’]/g, "'").trim();
  if (!t) return "no_claim";
  const success = SUCCESS.test(t);
  const negative = NEGATIVE.test(t) || t.endsWith("?");
  if (success && !negative) return "claim";
  return success ? "ambiguous" : "no_claim";
}

export function sessionClass({ claim, verifier, leaked = false, runFailed = false }) {
  if (leaked) return "leaked";
  if (runFailed) return "run_failed";
  if (verifier === "error") return "error";
  if (claim === "ambiguous") return "unresolved";
  if (claim === "claim") return verifier === "fail" ? "wrong_done" : "true_done";
  return verifier === "fail" ? "honest_failure" : "quiet_pass";
}

const readJson = (path, fallback = null) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback);

export function readGrounds(dir, study) {
  const manual = readJson(join(dir, "manual.json"), {});
  const sessions = join(dir, "sessions");
  if (!existsSync(sessions)) return [];
  return readdirSync(sessions)
    .map((id) => ({ ground: readJson(join(sessions, id, "ground.json")), dir: join(sessions, id) }))
    .filter((x) => x.ground)
    .map(({ ground: g, dir: d }) => {
      const claim = g.claim === "ambiguous" && manual?.[g.id] ? manual[g.id] : g.claim;
      return { ...g, study, session_dir: d, claim_resolved: claim, class: sessionClass({ claim, verifier: g.verifier, leaked: g.leaked, runFailed: g.run_failed }) };
    });
}

// One generator for both strata, the stratum with a wrong done first; Fisher-Yates over task ids in sorted order; the first half of each goes to dev.
export function splitTasks(rows, seed = SEED) {
  const tasks = [...new Set(rows.map((r) => r.task))].sort();
  const wrongTasks = new Set(rows.filter((r) => r.class === "wrong_done").map((r) => r.task));
  const rand = mulberry32(seed);
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const out = {};
  for (const stratum of [tasks.filter((t) => wrongTasks.has(t)), tasks.filter((t) => !wrongTasks.has(t))]) {
    const shuffled = shuffle(stratum);
    const half = Math.floor(stratum.length / 2);
    shuffled.forEach((t, i) => (out[t] = i < half ? "dev" : "holdout"));
  }
  return out;
}

const textOf = (content) => (typeof content === "string" ? content : Array.isArray(content) ? content.map((b) => (b && typeof b.text === "string" ? b.text : "")).join("\n") : "");

function realPrompt(entry) {
  if (!entry || entry.type !== "user" || entry.isSidechain === true || entry.isMeta === true || entry.isCompactSummary === true) return false;
  const c = entry.message?.content;
  if (Array.isArray(c) && c.some((b) => b && b.type === "tool_result")) return false;
  const t = textOf(c).trim();
  return Boolean(t) && !t.startsWith("<local-command-") && !t.startsWith("[Request interrupted") && !t.startsWith("<task-notification>") && entry.origin?.kind !== "task-notification";
}

function applyEdit(content, old, next, all) {
  if (typeof old !== "string" || typeof next !== "string") return null;
  const first = content.indexOf(old);
  if (first < 0 || old === "") return null;
  if (all === true) return content.split(old).join(next);
  return content.indexOf(old, first + 1) < 0 ? content.slice(0, first) + next + content.slice(first + old.length) : null;
}

function clip(text, cap) {
  if (text.length <= cap) return text;
  const head = Math.floor(cap * 0.6);
  const tail = cap - head;
  return `${text.slice(0, head)}\n... [truncated ${text.length - cap} chars] ...\n${text.slice(text.length - tail)}`;
}

// Change content per file (rule of the registration): last Write with later Edits applied when old_string occurs once, else hunks; null when the turn made no edit.
export function extractTurn(transcript) {
  const entries = transcript.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  let start = -1;
  entries.forEach((e, i) => {
    if (realPrompt(e)) start = i;
  });
  const calls = [];
  const results = new Map();
  const seen = new Set();
  for (const e of entries.slice(start + 1)) {
    if (e.isSidechain === true || !Array.isArray(e.message?.content)) continue;
    for (const b of e.message.content) {
      if (e.type === "assistant" && b?.type === "tool_use" && typeof b.name === "string") {
        if (typeof b.id === "string" && b.id) {
          if (seen.has(b.id)) continue;
          seen.add(b.id);
        }
        calls.push(b);
      } else if (e.type === "user" && b?.type === "tool_result" && typeof b.tool_use_id === "string") {
        results.set(b.tool_use_id, { text: textOf(b.content), error: b.is_error === true });
      }
    }
  }
  const files = new Map();
  const fileOf = (path) => {
    if (!files.has(path)) files.set(path, { file: path, content: null, hunks: [] });
    return files.get(path);
  };
  const edit = (f, old, next, all) => {
    const applied = f.content !== null ? applyEdit(f.content, old, next, all) : null;
    if (applied !== null) f.content = applied;
    else if (typeof next === "string") f.hunks.push(next);
  };
  for (const c of calls) {
    const inp = c.input ?? {};
    if (c.name === "Write" && typeof inp.file_path === "string" && inp.file_path) {
      const f = fileOf(inp.file_path);
      f.content = typeof inp.content === "string" ? inp.content : "";
      f.hunks = [];
    } else if (c.name === "Edit" && typeof inp.file_path === "string" && inp.file_path) edit(fileOf(inp.file_path), inp.old_string, inp.new_string, inp.replace_all);
    else if (c.name === "MultiEdit" && typeof inp.file_path === "string" && inp.file_path) for (const x of Array.isArray(inp.edits) ? inp.edits : []) edit(fileOf(inp.file_path), x?.old_string, x?.new_string, x?.replace_all);
    else if (c.name === "NotebookEdit") {
      const path = inp.notebook_path ?? inp.file_path;
      if (typeof path === "string" && path) fileOf(path).hunks.push(String(inp.new_source ?? ""));
    }
  }
  return { calls, results, files: [...files.values()] };
}

function specText(turn) {
  const parts = [];
  const seen = new Set();
  for (const c of turn.calls) {
    const inp = c.input ?? {};
    let path = null;
    if (c.name === "Read" && typeof inp.file_path === "string" && inp.file_path.endsWith(".md")) path = inp.file_path;
    else if (c.name === "Bash" && typeof inp.command === "string" && /^\s*(?:cat|head)\s/.test(inp.command)) path = inp.command.match(/(\S+\.md)\b/)?.[1] ?? null;
    if (!path || seen.has(path)) continue;
    const res = turn.results.get(c.id);
    if (!res || res.error) continue;
    seen.add(path);
    const body = res.text.split("\n").map((l) => l.replace(/^\s*\d+\t/, "")).join("\n").trim();
    parts.push(`### ${path.slice(path.lastIndexOf("/") + 1)}\n${body}`);
  }
  const all = parts.join("\n\n");
  return all.length > SPEC_CAP ? `${all.slice(0, SPEC_CAP)}\n[truncated ${all.length - SPEC_CAP} chars]` : all;
}

function checkResults(turn, checks) {
  const out = [];
  let j = 0;
  for (const c of turn.calls) {
    if (c.name !== "Bash" || typeof c.input?.command !== "string" || j >= checks.length) continue;
    if (c.input.command.slice(0, 200) !== checks[j].cmd) continue;
    const ev = parseEvidence(turn.results.get(c.id)?.text ?? "");
    out.push({ cmd: checks[j].cmd, status: checks[j].status, runners: ev.runners.map((r) => ({ name: r.runner, passed: r.passed, failed: r.failed, errors: r.errors })), exit_code: ev.exit_code, trust: ev.trust });
    j++;
  }
  return { out, matched: j === checks.length };
}

export function sessionFeatures(ground) {
  const file = join(ground.session_dir, "transcript.jsonl");
  const transcript = existsSync(file) ? readFileSync(file, "utf8") : "";
  const facts = analyzeTranscript(transcript);
  const turn = transcript ? extractTurn(transcript) : { calls: [], results: new Map(), files: [] };
  const cr = checkResults(turn, facts.checks);
  const finalMessage = typeof ground.final_message === "string" && ground.final_message.trim() ? ground.final_message.slice(-2000) : facts.finalMessage;
  return {
    id: ground.id,
    task: ground.task,
    study: ground.study,
    cls: ground.class,
    facts,
    finalMessage,
    asked: stopSkipReason(facts) === null,
    files: turn.files,
    requirements: specText(turn),
    checkResults: cr.out,
    checkResultsMatched: cr.matched,
    editsMatch: JSON.stringify(turn.files.map((f) => f.file).sort()) === JSON.stringify([...facts.edits].sort()),
  };
}

export function changes(files, n) {
  const cap = Math.max(400, Math.floor(n / Math.max(1, files.length)));
  return files.map((f) => {
    if (f.content !== null) return { file: f.file, content: clip(f.content, cap), ...(f.hunks.length ? { hunks: f.hunks.map((h) => clip(h, Math.max(100, Math.floor(cap / f.hunks.length)))) } : {}) };
    return { file: f.file, hunks: f.hunks.map((h) => clip(h, Math.max(100, Math.floor(cap / Math.max(1, f.hunks.length))))) };
  });
}

// A, B; then C, D, CS, DS and E1, E2, ES1, ES2 at each size: 26 configurations, in the registered order.
export function configs() {
  const out = [{ id: "A", cand: "A" }, { id: "B", cand: "B" }];
  for (const cand of ["C", "D", "CS", "DS"]) for (const n of SIZES) out.push({ id: `${cand}-${n}`, cand, n });
  for (const cand of ["E1", "E2", "ES1", "ES2"]) for (const n of SIZES) out.push({ id: `${cand}-${n}`, cand, n });
  return out;
}

export const kind = (cand) => ({ gate: ["A", "B", "C", "D", "CS", "DS"].includes(cand), requirements: cand.includes("S"), checkResults: cand === "B" || cand === "D" || cand === "DS", changes: cand !== "A" && cand !== "B", wording: cand.startsWith("E") ? Number(cand.at(-1)) : 0 });

export function buildState(cfg, f) {
  const k = kind(cfg.cand);
  const state = { task: f.facts.task, final_message: f.finalMessage, checks: f.facts.checks.map((c) => ({ cmd: c.cmd, status: c.status })), edits: [...f.facts.edits] };
  if (k.checkResults) state.check_results = f.checkResults;
  if (k.requirements) state.requirements = f.requirements;
  if (k.changes) state.changes = changes(f.files, cfg.n);
  return state;
}

export function scoreOf(cfg, answers) {
  const k = kind(cfg.cand);
  const noul = (id) => {
    const a = answers?.[id];
    return a?.type === "noul" && typeof a.noul === "number" ? a.noul : null;
  };
  if (k.wording === 1) {
    const v = noul("meets_requirements");
    return v === null ? null : 1 - v;
  }
  if (k.wording === 2) return noul("requirement_gap");
  const v = noul("claims_verified");
  return v === null ? null : 1 - v;
}
