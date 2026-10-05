// States, configurations and scores of the stop-requirements study (docs/decisions/stop-requirements-question.md): R0 to R3 request states, 12 configurations plus baseline A.
// Reads transcripts from local study directories like scripts/stop-state/features.mjs; never copies them into the repository.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractTurn, readGrounds as readStudyGrounds, sessionFeatures } from "../stop-state/features.mjs";

export const STATES = ["R0", "R1", "R2", "R3"];
export const WORDINGS = { 1: "req.met_1", 2: "req.gap_2", 3: "req.unverified_3", 4: "req.trap_4" };
export const FRESH_SEED = 20261006;
export const REPS = [1, 2];
// Question key inside a request per wording.
export const ANSWER_KEY = { 1: "met", 2: "gap", 3: "unverified", 4: "trap" };

// 12 configurations in the registered order: the R0 family, then the enriched family.
export function configs() {
  const ids = [["R0", 1], ["R0", 2], ["R0", 3], ["R0", 4], ["R1", 1], ["R1", 2], ["R2", 1], ["R2", 2], ["R3", 1], ["R3", 2], ["R3", 3], ["R3", 4]];
  return ids.map(([state, wording]) => ({ id: `${state}-W${wording}`, state, wording, family: state === "R0" ? "primary" : "secondary" }));
}

export const BASELINE = { id: "A", state: "R0", wording: 0, family: "baseline" };
export const allConfigs = () => [BASELINE, ...configs()];

export const lineCount = (text) => (typeof text === "string" && text !== "" ? text.split("\n").length : 0);

// Per edited file, first-edit order: lines added and removed from the turn's tool inputs (Write adds content lines, Edit adds new_string and removes old_string lines).
export function editStats(transcript) {
  const turn = transcript ? extractTurn(transcript) : { calls: [] };
  const stats = new Map();
  const bump = (file, added, removed) => {
    if (!stats.has(file)) stats.set(file, { file, added: 0, removed: 0 });
    const s = stats.get(file);
    s.added += added;
    s.removed += removed;
  };
  for (const c of turn.calls) {
    const inp = c.input ?? {};
    if (c.name === "Write" && typeof inp.file_path === "string" && inp.file_path) bump(inp.file_path, lineCount(inp.content), 0);
    else if (c.name === "Edit" && typeof inp.file_path === "string" && inp.file_path) bump(inp.file_path, lineCount(inp.new_string), lineCount(inp.old_string));
    else if (c.name === "MultiEdit" && typeof inp.file_path === "string" && inp.file_path) for (const x of Array.isArray(inp.edits) ? inp.edits : []) bump(inp.file_path, lineCount(x?.new_string), lineCount(x?.old_string));
    else if (c.name === "NotebookEdit") {
      const path = inp.notebook_path ?? inp.file_path;
      if (typeof path === "string" && path) bump(path, lineCount(String(inp.new_source ?? "")), 0);
    }
  }
  return [...stats.values()];
}

export function reqFeatures(ground) {
  const f = sessionFeatures(ground);
  const file = join(ground.session_dir, "transcript.jsonl");
  return { ...f, editStats: editStats(existsSync(file) ? readFileSync(file, "utf8") : ""), model: ground.model ?? null, rep: ground.rep ?? null };
}

export const hasChecks = (state) => state === "R1" || state === "R3";
export const hasStats = (state) => state === "R2" || state === "R3";

export function buildState(cfg, f) {
  const state = { task: f.facts.task, final_message: f.finalMessage, checks: f.facts.checks.map((c) => ({ cmd: c.cmd, status: c.status })), edits: [...f.facts.edits] };
  if (hasChecks(cfg.state)) state.check_results = f.checkResults;
  if (hasStats(cfg.state)) state.edit_stats = f.editStats;
  return state;
}

// Score oriented higher = more likely a wrong done: 1 - noul for wording 1, noul for 2 to 4, 1 - claims_verified for A.
export function scoreOf(cfg, answers) {
  const noul = (id) => {
    const a = answers?.[id];
    return a?.type === "noul" && typeof a.noul === "number" ? a.noul : null;
  };
  if (cfg.wording === 0) {
    const v = noul("claims_verified");
    return v === null ? null : 1 - v;
  }
  const v = noul(ANSWER_KEY[cfg.wording]);
  if (v === null) return null;
  return cfg.wording === 1 ? 1 - v : v;
}

// Ground records of a study directory with an explicit label (base or hard), unlike readGrounds of the stop-state harness that guessed from the name.
export const readGrounds = (dir, label) => readStudyGrounds(dir, label);

// Mean of the available repetition scores; null when any wanted repetition is missing.
export function meanScore(scores) {
  return scores.some((s) => s === null || s === undefined) ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
}
