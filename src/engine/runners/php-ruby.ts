// PHPUnit and RSpec parsers. ANSI is stripped, then summaries, failure blocks and ids are read from structured lines only.
// Worst case wins: a later "OK" or "0 failures" never hides an earlier failure marker; no marker at all returns null.

import type { RunnerFacts, RunnerParser } from "./types.ts";

const MAX_FAILING = 10;
const MAX_NAME = 120;
const MAX_SUMMARY = 200;

function lines(text: string): string[] {
  return text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/\s+$/, ""));
}

function cap(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) : t;
}

function dedupeNames(names: readonly string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const c = cap(n, MAX_NAME);
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, MAX_FAILING);
}

interface Candidate {
  readonly index: number;
  readonly line: string;
  readonly passed: number;
  readonly skipped: number;
}

function counts(rest: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of rest.matchAll(/([A-Za-z][A-Za-z ]*?):\s*(\d+)/g)) {
    const key = (m[1] as string).toLowerCase();
    out[key] = Math.max(out[key] ?? 0, Number(m[2]));
  }
  return out;
}

const phpunit: RunnerParser = {
  name: "phpunit",
  parse(text) {
    const all = lines(text);
    const candidates: Candidate[] = [];
    const failureIds = new Map<string, string>();
    const errorIds = new Map<string, string>();
    let section: "failure" | "error" | "other" | null = null;
    let summaryFailures = 0;
    let summaryErrors = 0;
    let headerFailures = 0;
    let headerErrors = 0;
    let failFloor = 0;
    let errFloor = 0;
    let progressFail = false;

    all.forEach((line, index) => {
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^OK \((\d+) tests?, (\d+) assertions?\)/))) {
        candidates.push({ index, line, passed: Number(m[1]), skipped: 0 });
        section = null;
      } else if (/^OK, but .*!$/.test(line)) {
        candidates.push({ index, line, passed: 0, skipped: 0 });
        section = null;
      } else if ((m = line.match(/^Tests:\s*(\d+)\s*(?:,(.*?))?\.?$/))) {
        const c = counts(m[2] ?? "");
        const failures = c["failures"] ?? 0;
        const errors = c["errors"] ?? 0;
        const skipped = (c["skipped"] ?? 0) + (c["incomplete"] ?? 0) + (c["risky"] ?? 0);
        summaryFailures = Math.max(summaryFailures, failures);
        summaryErrors = Math.max(summaryErrors, errors);
        candidates.push({ index, line, passed: Math.max(0, Number(m[1]) - failures - errors - skipped), skipped });
        section = null;
      } else if (/^No tests executed!/.test(line)) {
        candidates.push({ index, line, passed: 0, skipped: 0 });
        section = null;
      } else if (/^FAILURES!$/.test(line)) {
        failFloor = 1;
        section = null;
      } else if (/^ERRORS!$/.test(line)) {
        errFloor = 1;
        section = null;
      } else if ((m = line.match(/^There (?:was|were) (\d+) ([a-z ]+?)s?:$/i))) {
        const n = Number(m[1]);
        const kind = (m[2] as string).toLowerCase();
        if (kind === "failure") {
          section = "failure";
          headerFailures = Math.max(headerFailures, n);
        } else if (kind === "error") {
          section = "error";
          headerErrors = Math.max(headerErrors, n);
        } else section = "other";
      } else if (section === "failure" || section === "error") {
        if ((m = line.match(/^(\d+)\) ([\w\\]+::\S.*)$/))) {
          (section === "failure" ? failureIds : errorIds).set(`${m[1]}) ${m[2]}`, m[2] as string);
        }
      } else if (/^[.FEWSIRDN]+\s+\d+ \/ \d+ \(\s*\d+%\)$/.test(line.trim())) {
        if (/[FE]/.test(line.trim().split(/\s+/)[0] as string)) progressFail = true;
      }
    });

    const last = candidates[candidates.length - 1];
    let failed = Math.max(summaryFailures, failureIds.size, headerFailures, failFloor);
    const errors = Math.max(summaryErrors, errorIds.size, headerErrors, errFloor);
    if (failed === 0 && errors === 0 && progressFail) failed = 1;
    if (!last && failed === 0 && errors > 0) failed = errors;
    if (!last && failed === 0 && errors === 0) return null;

    return {
      runner: "phpunit",
      passed: last?.passed ?? 0,
      failed,
      errors,
      skipped: last?.skipped ?? 0,
      failing: dedupeNames([...failureIds.values(), ...errorIds.values()]),
      summary_line: last ? cap(last.line, MAX_SUMMARY) : null,
    } satisfies RunnerFacts;
  },
};

const rspec: RunnerParser = {
  name: "rspec",
  parse(text) {
    const all = lines(text);
    const summaries: Candidate[] = [];
    const numbered = new Map<string, string>();
    const located = new Map<string, string>();
    const loadErrors = new Set<string>();
    let section: "failures" | "failed" | "pending" | null = null;
    let summaryFailures = 0;
    let summaryErrors = 0;
    let failuresHeader = false;

    all.forEach((line, index) => {
      let m: RegExpMatchArray | null;
      if (
        (m = line.match(
          /^\s*(\d+) examples?, (\d+) failures?(?:, (\d+) pending)?(?:, (\d+) errors? occurred outside of examples)?\s*$/,
        ))
      ) {
        const failures = Number(m[2]);
        const pending = Number(m[3] ?? 0);
        summaryFailures = Math.max(summaryFailures, failures);
        summaryErrors = Math.max(summaryErrors, Number(m[4] ?? 0));
        summaries.push({ index, line, passed: Math.max(0, Number(m[1]) - failures - pending), skipped: pending });
        section = null;
      } else if (/^Failures:$/.test(line)) {
        section = "failures";
        failuresHeader = true;
      } else if (/^Failed examples:$/.test(line)) {
        section = "failed";
      } else if (/^Pending:$/.test(line)) {
        section = "pending";
      } else if (/^Finished in /.test(line)) {
        section = null;
      } else if ((m = line.match(/^rspec (\.?\/?\S+?:\d+(?:\[[\d:]+\])?|\.?\/\S+)\s*(?:#\s*(.*))?$/))) {
        located.set(m[1] as string, `${m[1]}${m[2] ? ` # ${m[2]}` : ""}`);
      } else if ((m = line.match(/^An error occurred while loading (\S+?)\.?$/))) {
        loadErrors.add(m[1] as string);
      } else if (section === "failures" && (m = line.match(/^\s*(\d+)\) (.+)$/))) {
        const lm = (m[2] as string).match(/^An error occurred while loading (\S+?)\.?$/);
        if (lm) loadErrors.add(lm[1] as string);
        numbered.set(`${m[1]}) ${m[2]}`, m[2] as string);
      }
    });

    const last = summaries[summaries.length - 1];
    const failureIds = [...numbered.values()].filter((n) => !/^An error occurred while loading /.test(n));
    const failed = Math.max(summaryFailures, failureIds.length, located.size, failuresHeader && loadErrors.size === 0 ? 1 : 0);
    const errors = Math.max(summaryErrors, loadErrors.size);
    if (!last && failed === 0 && errors === 0) return null;

    return {
      runner: "rspec",
      passed: last?.passed ?? 0,
      failed,
      errors,
      skipped: last?.skipped ?? 0,
      failing: dedupeNames(located.size > 0 ? [...located.values()] : [...numbered.values()]),
      summary_line: last ? cap(last.line, MAX_SUMMARY) : null,
    } satisfies RunnerFacts;
  },
};

export const parsers: readonly RunnerParser[] = [phpunit, rspec];
