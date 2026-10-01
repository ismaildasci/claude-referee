// Parsers for cargo nextest, dart and flutter test, Julia Test summaries and kaocha. Counts come only from anchored structural lines.
// Worst case wins; a log without its final summary, a run of zero tests, a cancelled, flaky or skipped run never counts as a clean pass.

import { NEXTEST_MARK } from "./more.ts";
import type { RunnerParser } from "./types.ts";
import { mk, prepare } from "./util.ts";

const NX_SUMMARY = /^\s*Summary \[\s*[\d.]+s\] (?:(\d+)\/)?(\d+) tests? run: (.*)$/;
const NX_STATUS = /^\s*((?:TRY \d+ )?[A-Z][A-Z-]*(?: \d+\/\d+)?)\s+\[\s*[\d.]+s\]\s+(?:\(\s*\d+\/\d+\)\s+)?(\S.*)$/;
const NX_FAIL_LABEL = /^(?:FAIL|XFAIL|LEAK-FAIL|LKFAIL|TIMEOUT|TMT|ABORT|SEGV|SIG[A-Z0-9]+)$/;
const NX_CAVEAT_LABEL = /^(?:FLAKY|LEAK|TIMEOUT-PASS|TMPASS)\b/;
const NX_CANCEL = /^\s*(?:Cancelling due to|warning: \d+\/\d+ tests? were not run)/;
const NX_COMPILE = /^error(?:\[E\d+\])?: (?!could not compile|test run failed|command |no tests to run|aborting due to)/;
const NX_GENERATED = /^warning: `[^`]+`(?: \([^)]*\))? generated (\d+) warnings?/;

function nxCount(details: string, word: string): number {
  const m = new RegExp(`(\\d+) ${word}\\b`).exec(details);
  return m ? Number(m[1]) : 0;
}

const nextest: RunnerParser = {
  name: "cargo nextest",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => NEXTEST_MARK.test(l))) return null;
    const failing = new Set<string>();
    let best: { failed: number; passed: number; skipped: number; incomplete: boolean; line: string } | null = null;
    let caveat = false;
    let cancelled = false;
    let compile = 0;
    let couldNot = false;
    let commandFailed = false;
    let runFailed = false;
    let noTests = false;
    let warnings = 0;
    for (const line of lines) {
      const s = NX_SUMMARY.exec(line);
      if (s) {
        const details = s[3] as string;
        const finished = Number(s[1] ?? s[2]);
        const initial = Number(s[2]);
        const failed = nxCount(details, "failed") + nxCount(details, "exec failed") + nxCount(details, "timed out");
        const candidate = {
          failed,
          passed: nxCount(details, "passed"),
          skipped: nxCount(details, "skipped"),
          incomplete: finished < initial || Number(s[2]) === 0 || nxCount(details, "flaky") + nxCount(details, "leaky") > 0 || /cancelled/.test(details),
          line,
        };
        if (best === null || candidate.failed > best.failed) best = candidate;
        continue;
      }
      const st = NX_STATUS.exec(line);
      if (st) {
        const label = st[1] as string;
        if (NX_FAIL_LABEL.test(label)) failing.add(st[2] as string);
        else if (NX_CAVEAT_LABEL.test(label) || label.startsWith("TRY ")) caveat = true;
        continue;
      }
      const g = NX_GENERATED.exec(line);
      if (g) warnings += Number(g[1]);
      else if (NX_CANCEL.test(line)) cancelled = true;
      else if (NX_COMPILE.test(line)) compile++;
      else if (/^error: could not compile /.test(line)) couldNot = true;
      else if (/^error: command .* exited with code \d+/.test(line)) commandFailed = true;
      else if (/^error: test run failed\s*$/.test(line)) runFailed = true;
      else if (/^error: no tests to run\b/.test(line)) noTests = true;
    }
    const errors = Math.max(compile, couldNot || commandFailed ? 1 : 0);
    const failed = Math.max(best?.failed ?? 0, failing.size, runFailed ? 1 : 0);
    const incomplete = best === null || best.incomplete || caveat || cancelled || noTests || (errors === 0 && failed === 0 && best.passed === 0);
    return mk("cargo nextest", { passed: best?.passed ?? 0, failed, errors, skipped: best?.skipped ?? 0, warnings }, failing, best?.line ?? null, incomplete);
  },
};

const DART_PROGRESS = /^(?:\d+:)?\d{2}:\d{2} \+(\d+)(?: ~(\d+))?(?: -(\d+))?: (.*)$/;
const DART_FINAL = /^(?:All tests passed!|All tests skipped\.|Some tests failed\.|No tests ran\.)$/;

const dart: RunnerParser = {
  name: "dart test",
  parse(text) {
    const lines = prepare(text);
    let passed = 0;
    let skipped = 0;
    let failed = 0;
    let seen = false;
    let final: string | null = null;
    let finalLine: string | null = null;
    let listing = false;
    const failing = new Set<string>();
    for (const line of lines) {
      const p = DART_PROGRESS.exec(line);
      if (p) {
        seen = true;
        listing = false;
        passed = Math.max(passed, Number(p[1]));
        skipped = Math.max(skipped, Number(p[2] ?? 0));
        failed = Math.max(failed, Number(p[3] ?? 0));
        if (DART_FINAL.test((p[4] as string).trim())) {
          final = (p[4] as string).trim();
          finalLine = line;
        }
        continue;
      }
      if (/^No tests ran\.\s*$/.test(line)) {
        final ??= "No tests ran.";
        seen = seen || lines.some((l) => /^No tests were found\.|^No tests match /.test(l));
        continue;
      }
      if (/^Failing tests:\s*$/.test(line)) listing = true;
      else if (listing && /^ {2}\S/.test(line)) failing.add(line.trim());
      else if (listing && line.trim() !== "") listing = false;
    }
    if (!seen) return null;
    const isFlutter = lines.some((l) => /\bflutter test\b/.test(l));
    const failedAll = Math.max(failed, failing.size, final === "Some tests failed." ? 1 : 0);
    const incomplete = final === null || final === "No tests ran." || (final === "All tests passed!" && passed === 0) || final === "All tests skipped.";
    return mk(isFlutter ? "flutter test" : "dart test", { passed, failed: failedAll, skipped }, failing, finalLine, incomplete);
  },
};

const JL_HEADER = /^Test Summary:\s*\|(.*)$/;
const JL_NAMED = /^(.+?): (?:Test Failed|Error During Test) at\b/;
const JL_UNNAMED = /^(?:Test Failed at\b|ERROR: LoadError: There was an error during testing)/;
const JL_VERDICT = /^\s*Testing (\S+) tests (passed|failed)\b/;
const JL_ROLLUP = /^ERROR: LoadError: Some tests did not pass: (\d+) passed, (\d+) failed, (\d+) errored, (\d+) broken\./;

function columns(header: string, from: number): Map<number, string> {
  const cols = new Map<string, number>();
  for (const m of header.slice(from).matchAll(/\S+/g)) cols.set(m[0], from + (m.index ?? 0) + m[0].length);
  return new Map([...cols].map(([name, end]) => [end, name]));
}

const julia: RunnerParser = {
  name: "julia test",
  parse(text) {
    const lines = prepare(text);
    const totals: Record<string, number> = { Pass: 0, Fail: 0, Error: 0, Broken: 0 };
    const failing = new Set<string>();
    let tables = 0;
    let verdict: string | null = null;
    let rollup: RegExpExecArray | null = null;
    let pkgErrored = false;
    let unnamed = false;
    let started = false;
    let summary: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const h = JL_HEADER.exec(line);
      if (h) {
        tables++;
        const pipe = line.indexOf("|");
        const cols = columns(line, pipe + 1);
        let j = i + 1;
        for (; j < lines.length; j++) {
          const row = lines[j] as string;
          if (row.charAt(pipe) !== "|" || JL_HEADER.test(row)) break;
          if (/^\s/.test(row)) continue;
          for (const m of row.slice(pipe + 1).matchAll(/\S+/g)) {
            const name = cols.get(pipe + 1 + (m.index ?? 0) + m[0].length);
            if (name !== undefined && name in totals && /^\d+$/.test(m[0])) totals[name] = (totals[name] as number) + Number(m[0]);
          }
          summary ??= row;
        }
        i = j - 1;
        continue;
      }
      const n = JL_NAMED.exec(line);
      if (n) {
        failing.add(n[1] as string);
        continue;
      }
      if (JL_UNNAMED.test(line)) {
        unnamed = true;
        continue;
      }
      const v = JL_VERDICT.exec(line);
      if (v) {
        verdict = v[2] as string;
        summary = line;
        continue;
      }
      const r = JL_ROLLUP.exec(line);
      if (r) rollup = r;
      else if (/^ERROR: Package \S+ errored during testing/.test(line)) pkgErrored = true;
      else if (/^\s+Testing (?:Running tests|\S+\s*$)/.test(line)) started = true;
    }
    if (tables === 0 && verdict === null && rollup === null && failing.size === 0 && !pkgErrored && !unnamed) return null;
    const failed = Math.max(totals["Fail"] as number, Number(rollup?.[2] ?? 0), failing.size, unnamed ? 1 : 0, verdict === "failed" ? 1 : 0);
    const errors = Math.max(totals["Error"] as number, Number(rollup?.[3] ?? 0), pkgErrored ? 1 : 0);
    const passed = totals["Pass"] as number;
    const broken = totals["Broken"] as number;
    const incomplete = tables === 0 || passed === 0 || (started && verdict === null && failed + errors === 0);
    return mk("julia test", { passed, failed, errors, skipped: broken }, failing, summary, incomplete);
  },
};

const KAOCHA_SUMMARY = /^(\d+) tests?, (\d+) assertions?, (?:(\d+) errors?, )?(?:(\d+) pending, )?(\d+) failures?\.$/;
const KAOCHA_NAMED = /^(?:FAIL|ERROR) in (\S+) \(\S+:\d+\)\s*$/;
const KAOCHA_DOTS = /^\[[().FEP]+\]?$/;
const KAOCHA_WARN = /^WARNING: (?:No tests were found|All \d+ tests were skipped)/;

const kaocha: RunnerParser = {
  name: "kaocha",
  parse(text) {
    const lines = prepare(text);
    const failing = new Set<string>();
    let best: { tests: number; failed: number; errors: number; pending: number; line: string } | null = null;
    let dots = false;
    let warned = false;
    let dotsBad = 0;
    for (const line of lines) {
      const s = KAOCHA_SUMMARY.exec(line);
      if (s) {
        const candidate = { tests: Number(s[1]), errors: Number(s[3] ?? 0), pending: Number(s[4] ?? 0), failed: Number(s[5]), line };
        if (best === null || candidate.failed + candidate.errors > best.failed + best.errors) best = candidate;
        continue;
      }
      const n = KAOCHA_NAMED.exec(line);
      if (n) {
        failing.add(n[1] as string);
        continue;
      }
      if (KAOCHA_DOTS.test(line)) {
        dots = true;
        dotsBad += (line.match(/[FE]/g) ?? []).length;
      } else if (KAOCHA_WARN.test(line)) warned = true;
    }
    if (best === null && !dots && !warned) return null;
    const errors = best?.errors ?? 0;
    const failed = Math.max(best?.failed ?? 0, failing.size - errors, dotsBad - errors);
    const pending = best?.pending ?? 0;
    const passed = best === null ? 0 : Math.max(best.tests - failed - errors - pending, 0);
    const incomplete = best === null || best.tests === 0 || warned;
    return mk("kaocha", { passed, failed, errors, skipped: pending }, failing, best?.line ?? null, incomplete);
  },
};

export const parsers: readonly RunnerParser[] = [nextest, dart, julia, kaocha];
