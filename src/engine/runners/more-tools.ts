// Parsers for mix test (ExUnit), ctest and rubocop; formats in docs/decisions/real-logs-2-parsers.md.
// Anchored lines only; a missing summary or completion marker, a failure line, a corrected offense or an empty run never counts as clean.

import type { RunnerParser } from "./types.ts";
import { mk, prepare } from "./util.ts";

const EX_START = /^Running ExUnit with seed: \d+/;
const EX_FINISHED = /^Finished in [\d.]+ (?:seconds?|ms|milliseconds)\b/;
const EX_SUMMARY = /^((?:\d+ (?:doctests?|propert(?:y|ies)), )*)(\d+) tests?, (\d+) failures?((?:,? ?\(?\d+ (?:skipped|invalid|excluded)\)?)*)$/;
const EX_RESULT_OK = /^Result: (\d+) passed \((?:\d+ (?:doctests?|tests?|propert(?:y|ies))(?:, )?)+\)$/;
const EX_FAILURE = /^ {1,4}\d+\) (?:test|doctest|property) (.*)$/;
const EX_ERROR = /^\*\* \(|^== Compilation error in file /;

const mixTest: RunnerParser = {
  name: "mix test",
  parse(text) {
    const lines = prepare(text);
    let starts = 0;
    let summaries = 0;
    let ran = 0;
    let failures = 0;
    let skipped = 0;
    let excluded = 0;
    let invalid = 0;
    let errors = 0;
    let unknown = false;
    let last: string | null = null;
    const failing: string[] = [];
    for (const [i, line] of lines.entries()) {
      if (EX_START.test(line)) {
        starts++;
        continue;
      }
      if (starts === 0) continue;
      const finished = lines.slice(Math.max(0, i - 4), i).some((l) => EX_FINISHED.test(l));
      const s = EX_SUMMARY.exec(line);
      if (s !== null && finished) {
        summaries++;
        last = line;
        for (const m of (s[1] ?? "").matchAll(/(\d+) /g)) ran += Number(m[1]);
        ran += Number(s[2]);
        failures += Number(s[3]);
        for (const m of (s[4] ?? "").matchAll(/(\d+) (skipped|invalid|excluded)/g)) {
          if (m[2] === "invalid") invalid += Number(m[1]);
          else if (m[2] === "excluded") excluded += Number(m[1]);
          else skipped += Number(m[1]);
        }
        continue;
      }
      if (line.startsWith("Result: ")) {
        const r = EX_RESULT_OK.exec(line);
        if (r !== null && finished) {
          summaries++;
          last = line;
          ran += Number(r[1]);
        } else {
          unknown = true;
          if (/fail/i.test(line)) failures++;
        }
        continue;
      }
      const f = EX_FAILURE.exec(line);
      if (f) failing.push(f[1] as string);
      else if (EX_ERROR.test(line)) errors++;
    }
    if (starts === 0) return null;
    const failed = Math.max(failures, failing.length);
    const passed = Math.max(0, ran - failures - skipped - invalid);
    return mk("mix test", { passed, failed, errors: errors + invalid, skipped: skipped + excluded }, failing, last, summaries === 0 || starts > summaries || ran === 0 || unknown);
  },
};

const CT_SUMMARY = /^(\d+)% tests passed, (\d+) tests? failed out of (\d+)\s*$/;
const CT_TOTAL = /^Total Test time \(real\) =/;
const CT_NONE = /^No tests were found!!!/;
const CT_BLOCK = /^The following tests (FAILED|did not run):\s*$/;
const CT_ITEM = /^\s+\d+ - (\S+) \((.*)\)(?:\s+\S.*)?$/;
const CT_RESULT = /^\s*\d+\/\d+ Test\s+#\d+: (\S+) \.+\s*(?:\*\*\*)?(Passed|Failed|Not Run|Skipped|Timeout|Exception[^ ]*|SEGFAULT|Subprocess aborted|Bad Command|Disabled)\b/;

const ctest: RunnerParser = {
  name: "ctest",
  parse(text) {
    const lines = prepare(text);
    let claimed = false;
    let summaries = 0;
    let total = 0;
    let failedSummary = 0;
    let none = false;
    let unterminated = false;
    let block: "FAILED" | "did not run" | null = null;
    let notRun = 0;
    const failing = new Set<string>();
    const resultFails = new Set<string>();
    let last: string | null = null;
    for (const [i, line] of lines.entries()) {
      const s = CT_SUMMARY.exec(line);
      if (s !== null) {
        claimed = true;
        summaries++;
        total += Number(s[3]);
        failedSummary += Number(s[2]);
        last = line.trim();
        if (!lines.slice(i + 1, i + 60).some((l) => CT_TOTAL.test(l))) unterminated = true;
        block = null;
        continue;
      }
      if (CT_NONE.test(line)) {
        claimed = true;
        none = true;
        continue;
      }
      const b = CT_BLOCK.exec(line);
      if (b !== null) {
        claimed = true;
        block = b[1] as "FAILED" | "did not run";
        continue;
      }
      const r = CT_RESULT.exec(line);
      if (r !== null) {
        claimed = true;
        if (r[2] !== "Passed" && r[2] !== "Skipped" && r[2] !== "Not Run" && r[2] !== "Disabled") resultFails.add(r[1] as string);
        block = null;
        continue;
      }
      const item = CT_ITEM.exec(line);
      if (block !== null && item !== null) {
        if (block === "FAILED") failing.add(item[1] as string);
        else notRun++;
        continue;
      }
      if (block !== null && line.trim() !== "" && !/^\s/.test(line)) block = null;
    }
    if (!claimed) return null;
    const failed = Math.max(failedSummary, failing.size, resultFails.size);
    const passed = Math.max(0, total - failed - notRun);
    const names = failing.size > 0 ? failing : resultFails;
    return mk("ctest", { passed, failed, skipped: notRun }, names, last, summaries === 0 || none || total === 0 || unterminated);
  },
};

const RUBO_INSPECTING = /^Inspecting (\d+) files?\s*$/;
const RUBO_SUMMARY = /^(\d+) files? inspected, (?:no offenses|(\d+) offenses?) detected(.*)$/;
const RUBO_OFFENSE = /^(\S[^\s:]*):\d+:\d+: (\[Corrected\] )?[CWEFR]: /;
const RUBO_WARNING = /^(?:Warning|Notice|Deprecat\w*)\b|\bdeprecated\b/i;
const RUBO_ERROR = /^Error: |^An error occurred while \S+ cop was inspecting /;

const rubocop: RunnerParser = {
  name: "rubocop",
  parse(text) {
    const lines = prepare(text);
    let inspecting = 0;
    let summaries = 0;
    let inspected = 0;
    let summaryOffenses = 0;
    let offenseLines = 0;
    let corrected = false;
    let warnings = 0;
    let errors = 0;
    let last: string | null = null;
    const files = new Set<string>();
    for (const line of lines) {
      if (RUBO_INSPECTING.test(line)) {
        inspecting++;
        continue;
      }
      const s = RUBO_SUMMARY.exec(line);
      if (s !== null) {
        summaries++;
        inspected += Number(s[1]);
        summaryOffenses += Number(s[2] ?? 0);
        if (/\bcorrected\b/.test(s[3] ?? "")) corrected = true;
        last = line.trim();
        continue;
      }
      const o = RUBO_OFFENSE.exec(line);
      if (o !== null) {
        offenseLines++;
        files.add(o[1] as string);
        if (o[2] !== undefined) corrected = true;
      } else if (RUBO_WARNING.test(line)) warnings++;
      else if (RUBO_ERROR.test(line)) errors++;
    }
    if (inspecting === 0 && summaries === 0) return null;
    const offenses = Math.max(summaryOffenses, offenseLines);
    return mk("rubocop", { passed: Math.max(0, inspected - files.size), errors: offenses + errors, warnings }, offenses > 0 ? files : [], last, summaries === 0 || inspected === 0 || corrected || inspecting > summaries);
  },
};

export const parsers: readonly RunnerParser[] = [mixTest, ctest, rubocop];
