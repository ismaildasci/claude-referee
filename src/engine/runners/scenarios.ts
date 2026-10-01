// Parsers for Perl prove, Python behave and tox. Counts come only from anchored summary lines, never free text.
// Skipped, undefined or untested items, a missing summary and a run that tested nothing never count as a clean pass.

import type { RunnerParser } from "./types.ts";
import { mk, prepare } from "./util.ts";

const PROVE_FILES = /^Files=(\d+), Tests=(\d+),/;
const PROVE_RESULT = /^Result: (PASS|FAIL|NOTESTS)\s*$/;
const PROVE_FILE = /^(\S+\.t) \.{2,}(?: (.*))?$/;
const PROVE_REPORT = /^(\S+\.t) \(Wstat: \d+ Tests: \d+ Failed: (\d+)\)/;
const PROVE_DIRECTIVE = /^\s*(?:not )?ok \d+\b.*# (?:skip|todo)\b/i;

const prove: RunnerParser = {
  name: "prove",
  parse(text) {
    const lines = prepare(text);
    let files: RegExpExecArray | null = null;
    let result: string | null = null;
    let successful = false;
    let fileLines = 0;
    let skipped = 0;
    let failedSum = 0;
    let todo = 0;
    let dubious = false;
    const failing = new Set<string>();
    for (const line of lines) {
      const f = PROVE_FILES.exec(line);
      if (f) {
        files = f;
        continue;
      }
      const r = PROVE_RESULT.exec(line);
      if (r) {
        result = r[1] as string;
        continue;
      }
      const rep = PROVE_REPORT.exec(line);
      if (rep) {
        failing.add(rep[1] as string);
        failedSum += Number(rep[2]);
        continue;
      }
      const file = PROVE_FILE.exec(line);
      if (file) {
        fileLines++;
        if (/^skipped\b/.test(file[2] ?? "")) skipped++;
        continue;
      }
      if (PROVE_DIRECTIVE.test(line)) skipped++;
      else if (/^All tests successful\./.test(line)) successful = true;
      else if (/^Dubious, test returned/.test(line)) dubious = true;
      else if (/^\s+TODO passed:/.test(line)) todo++;
    }
    if (files === null && result === null && fileLines === 0) return null;
    const tests = Number(files?.[2] ?? 0);
    const failed = Math.max(failedSum, failing.size, result === "FAIL" || dubious ? 1 : 0);
    const complete = files !== null && (result !== null || successful) && result !== "NOTESTS" && tests > 0;
    const summary = files === null ? null : `Files=${files[1]}, Tests=${files[2]}${result === null ? "" : ` Result: ${result}`}`;
    return mk("prove", { passed: Math.max(tests - failed, 0), failed, skipped: skipped + todo }, failing, summary, !complete);
  },
};

const BEHAVE_SUMMARY = /^(\d+) (features?|scenarios?|steps?) passed, (\d+) failed(?:, (.*))?$/;
const BEHAVE_LIST = /^(?:Failing|Errored) scenarios:\s*$/;
const BEHAVE_LISTED = /^\s+(\S+\.feature:\d+)\s+(.*)$/;
const BEHAVE_ERROR_PARTS = /^(?:error|hook_error|cleanup_error)s?$/;

const behave: RunnerParser = {
  name: "behave",
  parse(text) {
    const lines = prepare(text);
    let passed: number | null = null;
    let passedFeatures = 0;
    let failed = 0;
    let errors = 0;
    let skipped = 0;
    let summary: string | null = null;
    let listing = false;
    let scenarioLines = 0;
    let assertLine = false;
    const failing = new Set<string>();
    for (const line of lines) {
      const s = BEHAVE_SUMMARY.exec(line);
      if (s) {
        listing = false;
        const kind = (s[2] as string).replace(/s$/, "");
        failed = Math.max(failed, Number(s[3]));
        if (kind === "scenario") {
          passed = Math.max(passed ?? 0, Number(s[1]));
          summary = line;
        } else if (kind === "feature") passedFeatures = Math.max(passedFeatures, Number(s[1]));
        let errorsHere = 0;
        let skippedHere = 0;
        for (const part of (s[4] ?? "").split(", ")) {
          const m = /^(\d+) (\w+)$/.exec(part.trim());
          if (!m) continue;
          if (BEHAVE_ERROR_PARTS.test(m[2] as string)) errorsHere += Number(m[1]);
          else skippedHere += Number(m[1]);
        }
        errors = Math.max(errors, errorsHere);
        skipped = Math.max(skipped, skippedHere);
        continue;
      }
      if (BEHAVE_LIST.test(line)) {
        listing = true;
        continue;
      }
      if (listing) {
        const l = BEHAVE_LISTED.exec(line);
        if (l) failing.add(`${l[1]} ${l[2]}`);
        else if (line.trim() !== "") listing = false;
        continue;
      }
      if (/^\s+Scenario(?: Outline)?: .*# \S+\.feature:\d+/.test(line)) scenarioLines++;
      else if (/^\s+ASSERT FAILED\b|^\s+Assertion Failed\b/.test(line)) assertLine = true;
    }
    if (summary === null && scenarioLines === 0 && failing.size === 0) return null;
    const failedAll = Math.max(failed, failing.size, summary === null && assertLine ? 1 : 0);
    const total = passed ?? passedFeatures;
    return mk("behave", { passed: total, failed: failedAll, errors, skipped }, failing, summary, summary === null || total === 0);
  },
};

const TOX4_ENV = /^\s*(\S+): (OK|SKIP|NOT AVAILABLE|FAIL code (-?\d+)|IGNORED FAIL code (-?\d+)) \(/;
const TOX_FINAL_OK = /^\s*congratulations :\)(?: \([\d.]+ seconds\))?\s*$/;
const TOX_FINAL_FAIL = /^\s*evaluation failed :\((?: \([\d.]+ seconds\))?\s*$/;
const TOX3_SEPARATOR = /^_{3,} summary _{3,}$/;
const TOX3_ENV = /^(ERROR:|SKIPPED:)?\s+(\S+): (.+)$/;

const tox: RunnerParser = {
  name: "tox",
  parse(text) {
    const lines = prepare(text);
    let ok = 0;
    let bad = 0;
    let skipped = 0;
    let envs = 0;
    let final: string | null = null;
    let finalFailed = false;
    let tox3 = false;
    const failing = new Set<string>();
    for (const line of lines) {
      if (TOX3_SEPARATOR.test(line)) {
        tox3 = true;
        continue;
      }
      const e = TOX4_ENV.exec(line);
      if (e) {
        envs++;
        if (e[2] === "OK") ok++;
        else if (e[2] === "SKIP" || e[2] === "NOT AVAILABLE") skipped++;
        else {
          bad++;
          failing.add(e[1] as string);
        }
        continue;
      }
      if (TOX_FINAL_OK.test(line)) final = line;
      else if (TOX_FINAL_FAIL.test(line)) {
        final = line;
        finalFailed = true;
      } else if (tox3) {
        const t = TOX3_ENV.exec(line);
        if (!t) continue;
        envs++;
        const [, prefix, env, status] = t as unknown as [string, string | undefined, string, string];
        if (prefix === undefined && status === "commands succeeded") ok++;
        else if (prefix === "SKIPPED:" || (prefix === undefined && /^(?:skipped tests|InterpreterNotFound|platform mismatch)/.test(status))) skipped++;
        else {
          bad++;
          failing.add(env);
        }
      }
    }
    if (envs === 0 && final === null) return null;
    return mk("tox", { passed: ok, failed: Math.max(bad, finalFailed ? 1 : 0), skipped }, failing, final, final === null || ok + bad + skipped === 0);
  },
};

export const parsers: readonly RunnerParser[] = [prove, behave, tox];
