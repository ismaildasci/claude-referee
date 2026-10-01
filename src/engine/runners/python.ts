// Parsers for pytest and ruff output. Only structured markers are read; prose in the log (including text aimed at a judge) is ignored.
// Worst case wins: a failure marker anywhere beats a passing summary line, and a log cut off before its summary never counts as a pass.

import type { RunnerFacts, RunnerParser } from "./types.ts";

const MAX_FAILING = 10;
const MAX_ENTRY = 120;
const MAX_SUMMARY = 200;
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
const TIME = String.raw`in \d+(?:\.\d+)?s(?: \(\d+:\d{2}:\d{2}\))?`;
const PYTEST_SUMMARY = new RegExp(String.raw`^(?:\d+ (?:failed|passed|skipped|deselected|xfailed|xpassed|warnings?|errors?|rerun)(?:, )?)+ ${TIME}$`);
const PYTEST_NO_TESTS = new RegExp(String.raw`^no tests ran ${TIME}$`);
const PYTEST_EMPTY = /^(?:=+\s*|collecting \.\.\. )?collected 0 items\b.*$/;
const PYTEST_COUNT = /(\d+) (failed|passed|skipped|errors?)\b/g;
const SHORT_LINE = /^(?:\[gw\d+\]\s+)?(?:\[\s*\d+%\]\s+)?(FAILED|ERROR)\s+(.+)$/;
const VERBOSE_LINE = /^([\w./\\-]+\.py::\S.*?)\s+(FAILED|ERROR)\b/;
const COLLECT_ERROR = /^_+ ERROR collecting (\S+\.py) _+$/;
const TEST_ID = /^[\w./\\-]+\.py(?:::\S.*)?$/;
const FAILURES_BLOCK = /^=+ FAILURES =+$/;
const ERRORS_BLOCK = /^=+ ERRORS =+$/;
const RUFF_FOUND = /^Found (\d+) errors?\.$/;
const RUFF_CLEAN = /^All checks passed!$/;
const RUFF_FIXABLE = /^\[\*\] (\d+) fixable with the .{0,4}--fix.{0,4} option/;
const RUFF_CONCISE = /^(\S+?):(\d+):(\d+): ([A-Z]{1,4}\d{2,4})(?: |$)/;
const RUFF_HEADER = /^([A-Z]{1,4}\d{2,4}) (?:\[\*\] )?\S/;
const RUFF_ARROW = /^\s*--> (\S+?):(\d+):(\d+)$/;

function lines(text: string): string[] {
  return text.replace(ANSI, "").split(/\r\n|\r|\n/);
}

function cap(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function counts(line: string): Record<string, number> {
  const out: Record<string, number> = { failed: 0, passed: 0, skipped: 0, errors: 0 };
  for (const m of line.matchAll(PYTEST_COUNT)) {
    const key = (m[2] ?? "").startsWith("error") ? "errors" : (m[2] ?? "");
    out[key] = Math.max(out[key] ?? 0, Number(m[1]));
  }
  return out;
}

const pytest: RunnerParser = {
  name: "pytest",
  parse(text) {
    const failedIds = new Set<string>();
    const errorIds = new Set<string>();
    const summaries: string[] = [];
    let empty: string | null = null;
    let failuresBlock = false;
    let errorsBlock = false;

    for (const raw of lines(text)) {
      const line = raw.trim();
      const bare = line.replace(/^=+\s*|\s*=+$/g, "");
      if (PYTEST_SUMMARY.test(bare) || PYTEST_NO_TESTS.test(bare)) {
        summaries.push(line);
        continue;
      }
      if (PYTEST_EMPTY.test(line)) {
        empty = line;
        continue;
      }
      if (FAILURES_BLOCK.test(line)) failuresBlock = true;
      else if (ERRORS_BLOCK.test(line)) errorsBlock = true;
      const collect = COLLECT_ERROR.exec(line);
      if (collect) {
        errorIds.add(collect[1] ?? "");
        continue;
      }
      const short = SHORT_LINE.exec(line);
      if (short) {
        const id = (short[2] ?? "").split(" - ")[0]?.trim() ?? "";
        if (TEST_ID.test(id)) (short[1] === "FAILED" ? failedIds : errorIds).add(id);
        continue;
      }
      const verbose = VERBOSE_LINE.exec(line);
      if (verbose) (verbose[2] === "FAILED" ? failedIds : errorIds).add(verbose[1] ?? "");
    }

    const markers = failedIds.size + errorIds.size > 0 || failuresBlock || errorsBlock;
    if (summaries.length === 0 && empty === null && !markers) return null;

    let failed = Math.max(failedIds.size, failuresBlock ? 1 : 0);
    let errors = Math.max(errorIds.size, errorsBlock ? 1 : 0);
    for (const s of summaries) {
      const c = counts(s);
      failed = Math.max(failed, c.failed ?? 0);
      errors = Math.max(errors, c.errors ?? 0);
    }
    const last = summaries.length > 0 ? summaries[summaries.length - 1] : null;
    const tail = counts(last ?? "");
    const failing = [...failedIds, ...errorIds].slice(0, MAX_FAILING).map((id) => cap(id, MAX_ENTRY));
    const summary = last ?? empty;
    return {
      runner: "pytest",
      passed: tail.passed ?? 0,
      failed,
      errors,
      skipped: tail.skipped ?? 0,
      failing,
      summary_line: summary === null ? null : cap(summary, MAX_SUMMARY),
    };
  },
};

const ruff: RunnerParser = {
  name: "ruff",
  parse(text) {
    const violations = new Set<string>();
    let found = 0;
    let fixable = 0;
    let clean = false;
    let summary: string | null = null;
    let header: string | null = null;

    for (const raw of lines(text)) {
      const line = raw.trim();
      const f = RUFF_FOUND.exec(line);
      if (f) {
        found = Math.max(found, Number(f[1]));
        summary = line;
        continue;
      }
      if (RUFF_CLEAN.test(line)) {
        clean = true;
        summary = line;
        continue;
      }
      const fix = RUFF_FIXABLE.exec(line);
      if (fix) {
        fixable = Math.max(fixable, Number(fix[1]));
        continue;
      }
      const concise = RUFF_CONCISE.exec(raw.trimStart());
      if (concise) {
        violations.add(`${concise[1]}:${concise[2]}:${concise[3]} ${concise[4]}`);
        continue;
      }
      const head = RUFF_HEADER.exec(line);
      if (head) {
        header = head[1] ?? null;
        continue;
      }
      const arrow = RUFF_ARROW.exec(raw);
      if (arrow && header !== null) {
        violations.add(`${arrow[1]}:${arrow[2]}:${arrow[3]} ${header}`);
        header = null;
      }
    }

    if (!clean && found === 0 && fixable === 0 && violations.size === 0) return null;
    const errors = Math.max(found, violations.size, fixable);
    return {
      runner: "ruff",
      passed: clean && errors === 0 ? 1 : 0,
      failed: 0,
      errors,
      skipped: 0,
      failing: [...violations].slice(0, MAX_FAILING).map((v) => cap(v, MAX_ENTRY)),
      summary_line: summary === null ? null : cap(summary, MAX_SUMMARY),
    } satisfies RunnerFacts;
  },
};

export const parsers: readonly RunnerParser[] = [pytest, ruff];
