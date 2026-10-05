// Real-log study step 6: joins kept cases with recorded Jev answers into table.jsonl (no log text) and the parser backlog.
// Usage: node analyze.mjs DIR SUITE_ROOT OUT_DIR; verdicts come from the same doneRequest the done command and eval score use.
// A recording counts only when its question and state hashes match what the current code builds; otherwise verdict is null (stale).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { doneEvidence, doneRequest } from "../../src/cli/commands/done.ts";
import { findRecording } from "../../src/engine/evals.ts";
import { parseEvidence } from "../../src/engine/runners/index.ts";
import { loadPack, packDirs } from "../../src/engine/pack.ts";
import { questionHash, redactRequest, stateHash } from "../../src/engine/session.ts";
import { negativeKind } from "./lib.mjs";

const [dir, root, out] = process.argv.slice(2);
if (!dir || !root || !out) throw new Error("usage: analyze.mjs DIR SUITE_ROOT OUT_DIR");
const lines = (file) => readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const kept = lines(join(dir, "kept.jsonl"));
const recordedFile = join(root, "done-v2-real", "recorded.jsonl");
const recordings = existsSync(recordedFile) ? lines(recordedFile) : [];
const whys = new Map(lines(join(dir, "labels1.jsonl")).map((r) => [r.id, r.why ?? ""]));
const pack = loadPack("generic", packDirs(process.env));
const table = [];
for (const c of kept) {
  const facts = parseEvidence(doneEvidence(c.evidence));
  const { planned, finish } = doneRequest(pack, undefined, [c.criterion], doneEvidence(c.evidence));
  let result;
  const certain = planned.length === 0 ? null : finish([{ id: "done", answers: { c1: { type: "noul", noul: 1 } }, stopped: [], cached: true }]).verdict;
  if (planned.length === 0) result = finish([]);
  else {
    const first = planned[0];
    const key = { qhash: questionHash(first.questions), shash: stateHash(redactRequest(first, homedir(), pack.redact).body.state) };
    const models = [...new Set(recordings.map((r) => r.model))].reverse();
    const found = models.map((model) => findRecording(recordings, { case: c.id, model, ...key })).find((f) => f.status === "ok");
    result = found?.status === "ok" ? finish([{ id: "done", answers: found.line.answers, stopped: [], cached: true }]) : { verdict: null, p: null };
  }
  table.push({
    id: c.id, repo: c.repo, language: c.language, license: c.license, run_id: c.run_id, job_id: c.job_id, step_number: c.step_number,
    purpose: c.purpose, criterion: c.criterion, tool: c.tool, conclusion: c.conclusion, exit_code: c.exit_code,
    evidence_sha256: c.evidence_sha256, chars: c.chars, chars_cut: c.chars_cut,
    parsed: facts.runners.length > 0, trust: facts.trust, runners: facts.runners.map((r) => ({ runner: r.runner, passed: r.passed, failed: r.failed, errors: r.errors, skipped: r.skipped, warnings: r.warnings ?? 0, incomplete: r.incomplete === true })),
    label1: c.label1, label2: c.label2, expected: c.expected, negative_kind: c.expected === "missing" && !c.failed ? negativeKind(whys.get(c.id) ?? "") : null,
    code_decided: planned.length === 0, met_reachable: certain === "met", verdict: result.verdict, p: planned.length === 0 ? null : result.p ?? null, reason: result.reason ?? null,
  });
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "table.jsonl"), `${table.map((r) => JSON.stringify(r)).join("\n")}\n`);
if (recordings.length) writeFileSync(join(out, "recorded.jsonl"), readFileSync(recordedFile, "utf8"));
const backlog = {};
for (const r of table.filter((x) => !x.parsed)) {
  const b = (backlog[r.tool] ??= { tool: r.tool, purpose: r.purpose, cases: 0, expected_met: 0, repos: new Set() });
  if (r.expected === "met") b.expected_met += 1;
  b.cases += 1;
  b.repos.add(r.repo);
}
const ranked = Object.values(backlog).map((b) => ({ tool: b.tool, purpose: b.purpose, cases: b.cases, expected_met: b.expected_met, repos: b.repos.size })).sort((a, b) => b.expected_met - a.expected_met || b.cases - a.cases || b.repos - a.repos);
writeFileSync(join(out, "backlog.json"), JSON.stringify(ranked, null, 1));
const byRunner = {};
for (const r of table.filter((x) => x.parsed)) for (const k of new Set(r.runners.map((x) => x.runner))) byRunner[k] = (byRunner[k] ?? 0) + 1;
writeFileSync(join(out, "parsed-runners.json"), JSON.stringify(byRunner, null, 1));
console.log(`table ${table.length}; unparsed tools ${ranked.length}`);
