// Maintainer count of how often the first `done` call of a verification is met, by call form, from local Claude Code transcripts (docs/decisions/done-run-scoped.md). Counts only, no text.
// Usage: node scripts/first-call.mjs [--since 2026-10-25T17:30:00Z] [--exclude <text in the project folder name>]... [--projects <dir>]
// A first call is a done call of one transcript (main, subagent or workflow agent) that follows a met call or starts the transcript; forms: run_scoped, run_default, run_own (own --criteria) and piped (anything else).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DONE = /(?:claude-referee|cli\.mjs"?)\s+done\b/;
const SCOPED = /--run[= ]+["'](?:eslint|oxlint|vitest)\s/;

export function formOf(command) {
  if (!/--run\b/.test(command)) return "piped";
  return SCOPED.test(command) ? "run_scoped" : /--criteria\b/.test(command) ? "run_own" : "run_default";
}

// The done calls of one transcript, in order: { ts, form, verdict, exitOnly } for every call whose result printed a verdict.
export function doneCalls(text) {
  const open = new Map();
  const calls = [];
  for (const line of text.split("\n")) {
    if (line === "") continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const content = row?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "tool_use" && part.name === "Bash" && typeof part.input?.command === "string" && DONE.test(part.input.command) && !/--dry-run\b/.test(part.input.command)) open.set(part.id, { ts: row.timestamp ?? "", form: formOf(part.input.command) });
      else if (part?.type === "tool_result" && open.has(part.tool_use_id)) {
        const out = typeof part.content === "string" ? part.content : Array.isArray(part.content) ? part.content.map((c) => c?.text ?? "").join("\n") : "";
        const verdict = /"verdict"\s*:\s*"(met|unsure|missing)"/.exec(out)?.[1];
        if (verdict) calls.push({ ...open.get(part.tool_use_id), verdict, exitOnly: /"trust"\s*:\s*"exit_code"/.test(out) });
      }
    }
  }
  return calls;
}

export function tally(transcripts, since = "") {
  const forms = {};
  const totals = { calls: 0, first_calls: 0, retries_before_a_met: 0 };
  for (const text of transcripts) {
    let first = true;
    let streak = 0;
    for (const call of doneCalls(text)) {
      if (call.ts < since) continue;
      totals.calls += 1;
      const row = (forms[call.form] ??= { first_calls: 0, first_met: 0, first_refused_exit_only: 0 });
      if (first) {
        totals.first_calls += 1;
        row.first_calls += 1;
        if (call.verdict === "met") row.first_met += 1;
        else if (call.exitOnly) row.first_refused_exit_only += 1;
      }
      if (call.verdict === "met") {
        totals.retries_before_a_met += streak;
        streak = 0;
      } else streak += 1;
      first = call.verdict === "met";
    }
  }
  return { ...totals, forms };
}

function transcriptFiles(dir, depth = 0) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && depth < 6 && entry.name !== "tool-results") out.push(...transcriptFiles(path, depth + 1));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(path);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] !== undefined ? [args[i + 1]] : []));
  const since = value("--since")[0] ?? "";
  const root = value("--projects")[0] ?? join(homedir(), ".claude", "projects");
  const exclude = value("--exclude");
  const files = transcriptFiles(root).filter((f) => !exclude.some((x) => relative(root, f).split(sep)[0].includes(x)) && (since === "" || statSync(f).mtime.toISOString() >= since));
  console.log(JSON.stringify({ since: since || null, transcripts: files.length, ...tally(files.map((f) => readFileSync(f, "utf8")), since) }));
}
