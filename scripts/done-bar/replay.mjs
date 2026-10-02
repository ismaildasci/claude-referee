// Offline replay of recorded done suites for the split bar: evidence class from the repo's own parser, verdict from the recorded answer.
// A recording is used only when its question and state hashes match what current code builds, as eval score requires; no request is sent.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { doneEvidence, doneRequest } from "../../src/cli/commands/done.ts";
import { findRecording, parseCases, parseRecordings } from "../../src/engine/evals.ts";
import { loadPack, packDirs, threshold } from "../../src/engine/pack.ts";
import { parseEvidence } from "../../src/engine/runners/index.ts";
import { questionHash, redactRequest, stateHash } from "../../src/engine/session.ts";
import { classOfTrust, clusterKey } from "./lib.mjs";

export function evidenceClass(text) {
  return classOfTrust(parseEvidence(doneEvidence(text)).trust);
}

export function replaySuite(root, name, env = process.env) {
  const dir = join(root, name);
  const cases = parseCases(readFileSync(join(dir, "cases.jsonl"), "utf8"));
  const suiteCriteria = JSON.parse(readFileSync(join(dir, "suite.json"), "utf8")).criteria;
  const file = join(dir, "recorded.jsonl");
  const recordings = existsSync(file) ? parseRecordings(readFileSync(file, "utf8")) : [];
  const models = [...new Set(recordings.map((r) => r.model))].reverse();
  const pack = loadPack("generic", packDirs(env));
  const metAt = threshold(pack, undefined, "done.met", "met", 0.7);
  return cases.map((item) => {
    const raw = typeof item.evidence === "string" ? item.evidence : "";
    const evidence = doneEvidence(raw);
    const cls = evidenceClass(raw);
    const criterion = String(item.criterion ?? item.criteria ?? suiteCriteria);
    const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
    const base = { suite: name, id: item.id, split: item.split, group: item.group ?? null, criterion, expected: item.expected, cls, cluster: clusterKey(raw, item.expected) };
    if (planned.length === 0) {
      const r = finish([]);
      return { ...base, code_decided: true, status: "code", verdict: r.verdict, p: null, reason: r.reason ?? null, model: null };
    }
    const first = planned[0];
    const redacted = redactRequest(first, homedir(), pack.redact);
    const key = { qhash: questionHash(first.questions), shash: stateHash(redacted.body.state) };
    for (const model of models) {
      const found = findRecording(recordings, { case: item.id, model, ...key });
      if (found.status === "ok") {
        const r = finish([{ id: first.id, answers: found.line.answers, stopped: [], cached: true }]);
        return { ...base, code_decided: false, status: "ok", verdict: r.verdict, raw_met: Number(r.p) >= metAt, p: r.p ?? null, reason: r.reason ?? null, model };
      }
    }
    const stale = recordings.some((r) => r.case === item.id);
    return { ...base, code_decided: false, status: stale ? "stale" : "missing", verdict: null, p: null, reason: null, model: null };
  });
}
