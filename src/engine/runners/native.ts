// Parsers for ninja, MSBuild (dotnet build), docker buildx plain progress, make, maven and swift build and test output.
// Counts come from anchored lines only; an error, a missing completion marker or a cut-off log never counts as a clean build.

import type { RunnerParser } from "./types.ts";
import { mk, prepare } from "./util.ts";

const SRC_ERROR = /^\S[^\s:]*:\d+(?::\d+)?: (?:fatal )?error:|^(?:clang(?:\+\+)?|gcc|g\+\+|cc|c\+\+|ld|lld|link)(?:-\d+)?: (?:fatal )?error:|: fatal error:|^collect2: error:|\bundefined reference to\b|^CMake Error\b/;
const SRC_WARNING = /^\S[^\s:]*:\d+(?::\d+)?: warning:|^CMake Warning\b/;

const NINJA_STATUS = /^\[(\d+)\/(\d+)\] (.*)$/;
const NINJA_EDGE = /^(?:Building (?:[A-Z]+|Swift|ASM\S*) object |Compiling (?:[A-Z]+|C\+\+) object |Linking (?:[A-Z]+|Swift) (?:executable|static library|shared library|shared module|module library|object file)\b|Linking target |Install the project\.\.\.|Running (?:utility|custom) command|Automatic (?:MOC|UIC|RCC)|Re-running CMake)/;
const NINJA_LINE = /^ninja: (?:Entering directory|no work to do|build stopped|error|fatal)/;
const MESON_TEST = /^\s*\d+\/\d+ \S.* \/ \S.*\s(?:OK|FAIL|SKIP|TIMEOUT|EXPECTEDFAIL|UNEXPECTEDPASS)\s/;
const NINJA_ERROR = /^FAILED: |^ninja: (?:build stopped|error|fatal)/;

const ninja: RunnerParser = {
  name: "ninja",
  parse(text) {
    const lines = prepare(text);
    let claimed = false;
    let status: RegExpExecArray | null = null;
    let statusIndex = -1;
    let noWork = false;
    let errors = 0;
    let warnings = 0;
    for (const [i, line] of lines.entries()) {
      const s = NINJA_STATUS.exec(line);
      if (s !== null) {
        if (NINJA_EDGE.test(s[3] as string)) claimed = true;
        status = s;
        statusIndex = i;
        continue;
      }
      if (NINJA_LINE.test(line)) claimed = true;
      if (/^ninja: no work to do\.?\s*$/.test(line)) noWork = true;
      if (NINJA_ERROR.test(line) || SRC_ERROR.test(line)) errors++;
      else if (SRC_WARNING.test(line)) warnings++;
    }
    if (!claimed || lines.some((l) => MESON_TEST.test(l))) return null;
    const n = Number(status?.[1] ?? 0);
    const total = Number(status?.[2] ?? 0);
    const installTail = status !== null && n === total - 1 && /^Install the project\.\.\./.test(status[3] as string) && lines.slice(statusIndex + 1).some((l) => /^-- Install configuration:/.test(l));
    const complete = noWork || (status !== null && total > 0 && (n === total || installTail));
    return mk("ninja", { passed: noWork ? 0 : status === null ? 0 : n, errors, warnings }, [], status === null ? "ninja: no work to do." : status[0], errors === 0 && !complete);
  },
};

const MSB_OK = /^\s*Build succeeded\.\s*$/;
const MSB_FAILED = /^\s*Build FAILED\.\s*$/;
const MSB_COUNT = /^\s*(\d+) (Warning|Error)\(s\)\s*$/;
const MSB_DIAG = /: (error|warning) ((?:CS|VB|FS|BC|MSB|NETSDK|NU|CA|IDE|SYSLIB|RZ|WIX)\d{3,5}): /;

const msbuild: RunnerParser = {
  name: "msbuild",
  parse(text) {
    const lines = prepare(text);
    let ok = 0;
    let failed = false;
    let errorCount = 0;
    let warningCount = 0;
    const errorDiags = new Set<string>();
    const warningDiags = new Set<string>();
    let summary: string | null = null;
    for (const line of lines) {
      if (MSB_OK.test(line)) {
        ok++;
        summary = line.trim();
        continue;
      }
      if (MSB_FAILED.test(line)) {
        failed = true;
        summary = line.trim();
        continue;
      }
      const c = MSB_COUNT.exec(line);
      if (c) {
        if (c[2] === "Error") errorCount += Number(c[1]);
        else warningCount += Number(c[1]);
        continue;
      }
      const d = MSB_DIAG.exec(line);
      if (d) (d[1] === "error" ? errorDiags : warningDiags).add(line.replace(/\s*\[[^\]]*\]\s*$/, "").trim());
    }
    if (ok === 0 && !failed && errorDiags.size === 0) return null;
    const errors = Math.max(errorCount, errorDiags.size, failed ? 1 : 0);
    const warnings = Math.max(warningCount, warningDiags.size);
    return mk("msbuild", { passed: ok, errors, warnings }, errorDiags, summary, ok === 0 && errors === 0);
  },
};

const DK_DONE = /^#(\d+) (?:DONE \d[\d.]*s|CACHED)\s*$/;
const DK_VERTEX = /^#(\d+) (\[[^\]]*\].*|exporting .*|importing .*)$/;
const DK_ERROR = /^#\d+ ERROR\b|^ERROR: (?:failed to (?:solve|build)|process )/;
const DK_CANCELED = /^#\d+ CANCELED\s*$/;
const DK_WARN = /^(\d+) warnings? found\b/;

const docker: RunnerParser = {
  name: "docker build",
  parse(text) {
    const lines = prepare(text);
    const done = new Set<string>();
    const exporting = new Set<string>();
    let hasVertex = false;
    let errors = 0;
    let canceled = 0;
    let warnings = 0;
    let lastDone: string | null = null;
    for (const line of lines) {
      const d = DK_DONE.exec(line);
      if (d) {
        done.add(d[1] as string);
        lastDone = line;
        continue;
      }
      const v = DK_VERTEX.exec(line);
      if (v) {
        hasVertex = true;
        if ((v[2] as string).startsWith("exporting ")) exporting.add(v[1] as string);
        continue;
      }
      if (DK_ERROR.test(line)) errors++;
      else if (DK_CANCELED.test(line)) canceled++;
      else warnings += Number(DK_WARN.exec(line)?.[1] ?? 0);
    }
    if (done.size === 0 || !hasVertex) return null;
    const exported = [...exporting].some((id) => done.has(id));
    return mk("docker build", { passed: done.size, errors: errors + canceled, warnings }, [], errors > 0 ? null : lastDone, errors + canceled === 0 && !exported);
  },
};

const MAKE_LINE = /^(?:g|mingw32-)?make(?:\[\d+\])?: /;
const MAKE_FAIL = /^(?:g|mingw32-)?make(?:\[\d+\])?: (?:\*\*\* |\[[^\]]*\] Error \d+)|^(?:g|mingw32-)?make(?:\[\d+\])?: \*\*\* No rule to make target/;
const MAKE_WARN = /^(?:g|mingw32-)?make(?:\[\d+\])?: warning:/;

// A clean make log has no success marker of its own, so make is claimed only when it shows an error (failed or ignored); clean logs stay with the exit line.
const make: RunnerParser = {
  name: "make",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => MAKE_LINE.test(l))) return null;
    let errors = 0;
    let warnings = 0;
    let summary: string | null = null;
    for (const line of lines) {
      if (MAKE_FAIL.test(line)) {
        errors++;
        summary ??= line.trim();
      } else if (SRC_ERROR.test(line)) errors++;
      else if (MAKE_WARN.test(line) || SRC_WARNING.test(line)) warnings++;
    }
    if (errors === 0) return null;
    return mk("make", { errors, warnings }, [], summary, false);
  },
};

const SWIFT_BUILD_MARK = /^(?:Building for (?:debugging|production)\.\.\.|Build (?:of (?:product|target) '[^']*' )?complete! \(|\[\d+\/\d+\] (?:Compiling|Emitting module|Write sources|Planning build)\b)/;
const SWIFT_BUILD_OK = /^Build (?:of (?:product|target) '[^']*' )?complete! \(/;
const SWIFT_ERROR = /^\S[^\s:]*:\d+:\d+: error: |^error: /;
const SWIFT_WARNING = /^\S[^\s:]*:\d+:\d+: warning: /;
const XCTEST_MARK = /^Test (?:Suite|Case) '/;
const TESTING_RUN = /^(?:\S )?Test run with (\d+) tests? in (\d+) suites? (passed|failed) after\b/;

const swiftBuild: RunnerParser = {
  name: "swift build",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => SWIFT_BUILD_MARK.test(l))) return null;
    if (lines.some((l) => XCTEST_MARK.test(l) || TESTING_RUN.test(l))) return null;
    let ok = 0;
    let errors = 0;
    let warnings = 0;
    let summary: string | null = null;
    for (const line of lines) {
      if (SWIFT_BUILD_OK.test(line)) {
        ok++;
        summary = line.trim();
      } else if (SWIFT_ERROR.test(line)) errors++;
      else if (SWIFT_WARNING.test(line)) warnings++;
    }
    return mk("swift build", { passed: ok, errors, warnings }, [], summary, ok === 0 && errors === 0);
  },
};

const XC_SUITE_END = /^Test Suite '([^']*)' (passed|failed) at /;
const XC_EXECUTED = /^\s*Executed (\d+) tests?, with (?:(\d+) tests? skipped and )?(\d+) failures? \((\d+) unexpected\)/;
const XC_CASE = /^Test Case '([^']*)' (passed|failed|skipped) \(/;
const XC_ERROR = /^\S[^\s:]*:\d+: error: (-\[[^\]]*\]|\S+) : /;
const TESTING_FAIL = /^(?:\S )?Test "(.*)" failed after\b/;
const TESTING_SKIP = /^(?:\S )?Test "(.*)" skipped\b/;

const swiftTest: RunnerParser = {
  name: "swift test",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => XCTEST_MARK.test(l) || TESTING_RUN.test(l) || TESTING_FAIL.test(l))) return null;
    let all: { tests: number; skipped: number; failures: number } | null = null;
    const bundles: { tests: number; skipped: number; failures: number }[] = [];
    const failedIds = new Set<string>();
    let suiteFailed = false;
    let skippedCases = 0;
    let testing: { tests: number; failed: boolean } | null = null;
    let testingSkipped = 0;
    let xcSummary: string | null = null;
    let testingSummary: string | null = null;
    let suiteName: string | null = null;
    for (const line of lines) {
      const end = XC_SUITE_END.exec(line);
      if (end) {
        suiteName = end[1] as string;
        if (end[2] === "failed") suiteFailed = true;
        continue;
      }
      const ex = XC_EXECUTED.exec(line);
      if (ex) {
        const counts = { tests: Number(ex[1]), skipped: Number(ex[2] ?? 0), failures: Number(ex[3]) + Number(ex[4]) };
        if (suiteName === "All tests" || suiteName === "Selected tests") {
          all = counts;
          xcSummary = line.trim();
        } else if (suiteName?.endsWith(".xctest")) bundles.push(counts);
        suiteName = null;
        continue;
      }
      suiteName = null;
      const c = XC_CASE.exec(line);
      if (c) {
        if (c[2] === "failed") failedIds.add(c[1] as string);
        else if (c[2] === "skipped") skippedCases++;
        continue;
      }
      if (XC_ERROR.test(line)) {
        failedIds.add(line.trim());
        continue;
      }
      const r = TESTING_RUN.exec(line);
      if (r) {
        testing = { tests: Number(r[1]), failed: r[3] === "failed" };
        testingSummary = line.trim();
        continue;
      }
      const f = TESTING_FAIL.exec(line);
      if (f) {
        failedIds.add(f[1] as string);
        continue;
      }
      if (TESTING_SKIP.test(line)) testingSkipped++;
    }
    const xc = all ?? (bundles.length > 0 ? bundles.reduce((a, b) => ({ tests: a.tests + b.tests, skipped: a.skipped + b.skipped, failures: a.failures + b.failures }), { tests: 0, skipped: 0, failures: 0 }) : null);
    const total = (xc?.tests ?? 0) + (testing?.tests ?? 0);
    const failed = Math.max(xc?.failures ?? 0, failedIds.size, suiteFailed || testing?.failed ? 1 : 0);
    const skipped = Math.max(xc?.skipped ?? 0, skippedCases) + testingSkipped;
    const hasSummary = xc !== null || testing !== null;
    const shown = [xc !== null && xc.tests > 0 ? xcSummary : null, testing !== null && testing.tests > 0 ? testingSummary : null].filter((x): x is string => x !== null);
    const summary = shown.length > 0 ? shown.join(" ; ") : (xcSummary ?? testingSummary);
    return mk("swift test", { passed: Math.max(0, total - failed - skipped), failed, skipped }, failedIds, summary, !hasSummary || (total === 0 && failed === 0));
  },
};

const MVN_MARK = /^\[(?:INFO|ERROR)\] (?:BUILD (?:SUCCESS|FAILURE)\s*$|Reactor Summary\b|Scanning for projects\.\.\.)|^\[ERROR\] Failed to execute goal /;
const MVN_TESTS = /^\[(?:INFO|WARNING|ERROR)\] Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)\s*$/;
const MVN_FAIL = /^\[ERROR\] (?:BUILD FAILURE|COMPILATION ERROR\b|Failed to execute goal )|^\[(?:INFO|ERROR)\] BUILD FAILURE\s*$/;
const MVN_REACTOR_FAIL = /^\[(?:INFO|ERROR)\] \S.* \.{3,} FAILURE \[/;

const maven: RunnerParser = {
  name: "maven",
  parse(text) {
    const lines = prepare(text);
    if (!lines.some((l) => MVN_MARK.test(l))) return null;
    let ok = 0;
    let errors = 0;
    let warnings = 0;
    let run = 0;
    let testFailures = 0;
    let skipped = 0;
    let summary: string | null = null;
    for (const line of lines) {
      if (/^\[INFO\] BUILD SUCCESS\s*$/.test(line)) {
        ok++;
        summary = line.trim();
        continue;
      }
      const t = MVN_TESTS.exec(line);
      if (t) {
        run += Number(t[1]);
        testFailures += Number(t[2]) + Number(t[3]);
        skipped += Number(t[4]);
        continue;
      }
      if (MVN_FAIL.test(line) || MVN_REACTOR_FAIL.test(line)) {
        errors++;
        summary ??= line.trim();
      } else if (/^\[WARNING\] (?!Tests run:)/.test(line)) warnings++;
    }
    return mk("maven", { passed: run > 0 ? Math.max(0, run - testFailures - skipped) : ok, failed: testFailures, errors, skipped, warnings }, [], summary, ok === 0 && errors === 0 && testFailures === 0);
  },
};

export const parsers: readonly RunnerParser[] = [ninja, msbuild, docker, make, maven, swiftBuild, swiftTest];
