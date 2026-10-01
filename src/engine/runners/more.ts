// Parsers for Python's unittest and for cargo clippy. Counts come only from anchored structural lines, never free text.
// Worst case wins: of several summaries the one with the most failures is kept; a log cut off before its summary has no summary line.

import type { RunnerFacts, RunnerParser } from "./types.ts";

const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
const MAX_FAILING = 10;
const MAX_NAME = 120;
const MAX_SUMMARY = 200;

const prepare = (text: string): string[] => text.replace(ANSI, "").split(/\r?\n/);
const clip = (value: string, max: number): string => value.trim().slice(0, max);

const UT_RAN = /^Ran (\d+) tests? in [\d.]+s\s*$/;
const UT_RESULT = /^(OK|FAILED|NO TESTS RAN)(?: \(([^)]*)\))?\s*$/;
const UT_NAMED = /^(FAIL|ERROR): (.+?)\s*$/;
const UT_VERBOSE = /^\S.*\([\w.]+\) \.\.\. (ok|FAIL|ERROR|skipped\b.*|expected failure|unexpected success)\s*$/;

function utCount(detail: string | undefined, key: string): number {
  const m = new RegExp(`(?:^|, )${key}=(\\d+)`).exec(detail ?? "");
  return m ? Number(m[1]) : 0;
}

const unittest: RunnerParser = {
  name: "unittest",
  parse(text) {
    const lines = prepare(text);
    const names = new Set<string>();
    let best: { ran: number; failed: number; errors: number; skipped: number; line: string } | null = null;
    let ok = 0;
    let verboseFail = 0;
    let verboseError = 0;
    let verboseSkip = 0;
    let verbose = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const named = UT_NAMED.exec(line);
      if (named) {
        names.add(clip(named[2] as string, MAX_NAME));
        continue;
      }
      const v = UT_VERBOSE.exec(line);
      if (v) {
        verbose++;
        if (v[1] === "ok") ok++;
        else if (v[1] === "FAIL") verboseFail++;
        else if (v[1] === "ERROR") verboseError++;
        else if (v[1]?.startsWith("skipped")) verboseSkip++;
        continue;
      }
      const ran = UT_RAN.exec(line);
      if (!ran) continue;
      for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
        const r = UT_RESULT.exec(lines[j] as string);
        if (!r) continue;
        const detail = r[2];
        const summary = {
          ran: Number(ran[1]),
          failed: utCount(detail, "failures"),
          errors: utCount(detail, "errors"),
          skipped: utCount(detail, "skipped"),
          line: clip(lines[j] as string, MAX_SUMMARY),
        };
        if (r[1] === "FAILED" && summary.failed + summary.errors === 0) summary.failed = 1;
        if (best === null || summary.failed + summary.errors > best.failed + best.errors) best = summary;
        break;
      }
    }
    if (best === null && verbose === 0) return null;
    if (best === null) {
      return { runner: "unittest", passed: ok, failed: Math.max(verboseFail, 0), errors: verboseError, skipped: verboseSkip, failing: [...names].slice(0, MAX_FAILING), summary_line: null };
    }
    const passed = Math.max(best.ran - best.failed - best.errors - best.skipped, 0);
    return { runner: "unittest", passed, failed: best.failed, errors: best.errors, skipped: best.skipped, failing: [...names].slice(0, MAX_FAILING), summary_line: best.line };
  },
};

const CLIPPY_MARK = /\bcargo clippy\b|clippy::/;
const CLIPPY_GENERATED = /^warning: `[^`]+`(?: \([^)]*\))? generated (\d+) warnings?/;
const CLIPPY_WARNING = /^warning: (?!`[^`]+`(?: \([^)]*\))? generated )/;
const CLIPPY_ERROR = /^error(?:\[E\d+\])?: (?!could not compile|aborting due to)/;
const CLIPPY_COMPILE = /^error: could not compile `[^`]+`(?: \([^)]*\))?(?: due to (\d+) previous errors?)?/;

const clippy: RunnerParser = {
  name: "clippy",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => CLIPPY_MARK.test(l))) return null;
    let generated = 0;
    let headers = 0;
    let errorHeaders = 0;
    let dueTo = 0;
    let couldNot = false;
    let summary: string | null = null;
    for (const line of lines) {
      const g = CLIPPY_GENERATED.exec(line);
      if (g) {
        generated += Number(g[1]);
        summary = clip(line, MAX_SUMMARY);
        continue;
      }
      if (CLIPPY_WARNING.test(line)) {
        headers++;
        continue;
      }
      const c = CLIPPY_COMPILE.exec(line);
      if (c) {
        couldNot = true;
        dueTo += Number(c[1] ?? 0);
        summary = clip(line, MAX_SUMMARY);
        continue;
      }
      if (CLIPPY_ERROR.test(line)) errorHeaders++;
    }
    const errors = Math.max(errorHeaders, dueTo, couldNot ? 1 : 0);
    const facts: RunnerFacts = { runner: "clippy", passed: 0, failed: 0, errors, skipped: 0, warnings: Math.max(generated, headers), failing: [], summary_line: summary };
    return facts;
  },
};

export const parsers: readonly RunnerParser[] = [unittest, clippy];
