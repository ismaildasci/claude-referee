// Real-log study step 2: redaction screen, offline parse (trust, runner facts) and the unparsed-can-never-be-met check.
// Usage: node prepare.mjs DIR; reads DIR/cases-raw.jsonl, writes DIR/cases-screened.jsonl and DIR/prepare.json.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doneEvidence, doneRequest } from "../../src/cli/commands/done.ts";
import { redact } from "../../src/engine/redact.ts";
import { loadPack, packDirs } from "../../src/engine/pack.ts";
import { parseEvidence } from "../../src/engine/runners/index.ts";

const dir = process.argv[2];
if (!dir) throw new Error("usage: prepare.mjs DIR");
const raw = readFileSync(join(dir, "cases-raw.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pack = loadPack("generic", packDirs(process.env));
const report = { raw: raw.length, redaction_stopped: 0, stopped_kinds: {}, kept: 0, code_check_violations: [] };
const kept = [];
for (const c of raw) {
  const clipped = doneEvidence(c.evidence);
  const stops = redact({ evidence: clipped }, { home: "/Users/x", extra: pack.redact }).stopped;
  if (stops.length > 0) {
    report.redaction_stopped += 1;
    for (const s of stops) report.stopped_kinds[s.kind] = (report.stopped_kinds[s.kind] ?? 0) + 1;
    continue;
  }
  const parsed = parseEvidence(clipped);
  const native = clipped.replace(/\nexit code: -?\d+$/, "");
  const nativeParsed = parseEvidence(native);
  if (!c.failed && nativeParsed.trust === "unparsed") {
    const { finish } = doneRequest(pack, undefined, [c.criterion], native);
    const verdict = finish([{ id: "done", answers: { c1: { type: "noul", noul: 1 } }, stopped: [], cached: false }]).verdict;
    if (verdict === "met") report.code_check_violations.push(c.id);
  }
  kept.push({
    ...c,
    chars_cut: Math.max(0, c.evidence.length - 14_000),
    trust: parsed.trust,
    parsed: parsed.runners.length > 0,
    exit_lines: parsed.exit_lines,
    runners: parsed.runners.map((r) => ({ runner: r.runner, passed: r.passed, failed: r.failed, errors: r.errors, skipped: r.skipped, warnings: r.warnings ?? 0, incomplete: r.incomplete === true })),
    native_trust: nativeParsed.trust,
  });
}
report.kept = kept.length;
writeFileSync(join(dir, "cases-screened.jsonl"), `${kept.map((c) => JSON.stringify(c)).join("\n")}\n`);
writeFileSync(join(dir, "prepare.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
