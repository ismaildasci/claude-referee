// Parsers for go test, cargo test and dotnet test. Counts come only from anchored structural lines, never free text.
// Worst case wins: a failure marker or failed count above 0 is kept even when another line claims everything passed.

import type { RunnerFacts, RunnerParser } from "./types.ts";

const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?)/g;
const MAX_FAILING = 10;
const MAX_NAME = 120;
const MAX_SUMMARY = 200;

function prepare(text: string): string[] {
  return text.replace(ANSI, "").split(/\r?\n/);
}

function facts(
  runner: string,
  passed: number,
  failed: number,
  errors: number,
  skipped: number,
  ids: ReadonlySet<string>,
  summary: string | null,
  incomplete = false,
): RunnerFacts {
  return {
    runner,
    passed,
    failed,
    errors,
    skipped,
    failing: [...ids].slice(0, MAX_FAILING).map((n) => n.slice(0, MAX_NAME)),
    summary_line: summary === null ? null : summary.trim().slice(0, MAX_SUMMARY),
    ...(incomplete ? { incomplete: true } : {}),
  };
}

// Subtests (`TestX/sub`) are reported next to their parent, so only top-level ids are counted.
function topLevel(ids: ReadonlySet<string>): number {
  const top = [...ids].filter((n) => !n.includes("/")).length;
  return top > 0 ? top : ids.size;
}

const GO_PKG_OK = /^ok\s+\S+\s+(?:[\d.]+s\b|\(cached\))(.*)$/;
const GO_PKG_FAIL = /^FAIL\s+\S+\s+(?:[\d.]+s\b|\[(?:build|setup) failed\])/;
const GO_NO_FILES = /^\?\s+\S+\s+\[no test files\]/;
const GO_TEST = /^\s*--- (FAIL|PASS|SKIP): (\S+)/;
const GO_RUN = /^\s*=== (?:RUN|PAUSE|CONT)\s/;
const GO_RUN_ID = /^\s*=== RUN\s+(\S+)/;

const go: RunnerParser = {
  name: "go test",
  parse(text) {
    const lines = prepare(text);
    const summaries: string[] = [];
    const failedIds = new Set<string>();
    const passedIds = new Set<string>();
    const skippedIds = new Set<string>();
    const startedIds = new Set<string>();
    let okPackages = 0;
    let failedPackages = 0;
    let buildFailed = 0;
    let other = false;
    let panic = false;
    let goroutine = false;
    let bareFail = false;
    let failFirst: string | null = null;
    let okLast: string | null = null;
    for (const line of lines) {
      const ok = GO_PKG_OK.exec(line);
      if (ok) {
        summaries.push(line);
        okLast = line;
        if (!/\[no tests to run\]/.test(ok[1] ?? "")) okPackages++;
        continue;
      }
      if (GO_PKG_FAIL.test(line)) {
        summaries.push(line);
        failFirst ??= line;
        if (/\[(?:build|setup) failed\]/.test(line)) buildFailed++;
        else failedPackages++;
        continue;
      }
      if (GO_NO_FILES.test(line)) {
        summaries.push(line);
        continue;
      }
      const t = GO_TEST.exec(line);
      if (t) {
        other = true;
        const id = t[2] as string;
        if (t[1] === "FAIL") failedIds.add(id);
        else if (t[1] === "PASS") passedIds.add(id);
        else skippedIds.add(id);
        continue;
      }
      const started = GO_RUN_ID.exec(line);
      if (started) startedIds.add(started[1] as string);
      if (GO_RUN.test(line)) other = true;
      else if (/^panic: /.test(line)) panic = true;
      else if (/^goroutine \d+ \[/.test(line)) goroutine = true;
      else if (/^FAIL\s*$/.test(line)) bareFail = true;
    }
    const recognised = summaries.length > 0 || other || (panic && goroutine);
    if (!recognised) return null;
    const unfinished = [...startedIds].some((id) => !failedIds.has(id) && !passedIds.has(id) && !skippedIds.has(id)) ? 1 : 0;
    const errors = buildFailed + unfinished + (panic && (goroutine || other || summaries.length > 0) ? 1 : 0);
    const failed = Math.max(failedPackages, topLevel(failedIds), bareFail && errors === 0 ? 1 : 0);
    if (summaries.length === 0 && failed === 0 && errors === 0) return null;
    const passed = Math.max(okPackages, topLevel(passedIds));
    const summary = summaries.length === 0 ? null : (failFirst ?? okLast ?? (summaries[summaries.length - 1] as string));
    return facts("go test", passed, failed, errors, topLevel(skippedIds), failedIds, summary);
  },
};

const CARGO_RESULT = /^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored;/;
const CARGO_TEST = /^test (.+?) \.\.\. (ok|FAILED|ignored)\b/;
const CARGO_STDOUT = /^---- (.+?) stdout ----$/;
const CARGO_COMPILE = /^error\[E\d+\]/;
const CARGO_LIST_ITEM = /^ {4}([\w:]+|\S+ - .+ \(line \d+\))$/;
const CARGO_TARGETS_FAILED = /^error: (\d+) targets? failed:/;

const cargo: RunnerParser = {
  name: "cargo test",
  parse(text) {
    const lines = prepare(text);
    const results: string[] = [];
    const failedIds = new Set<string>();
    const compile = new Set<string>();
    let passed = 0;
    let failedSum = 0;
    let ignored = 0;
    let okLines = 0;
    let failedStatus = false;
    let failedFirst: string | null = null;
    let couldNotCompile = false;
    let testFailedLine = false;
    let targetsFailed = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      const r = CARGO_RESULT.exec(line);
      if (r) {
        results.push(line);
        passed += Number(r[2]);
        failedSum += Number(r[3]);
        ignored += Number(r[4]);
        if (r[1] === "FAILED") {
          failedStatus = true;
          failedFirst ??= line;
        }
        continue;
      }
      const t = CARGO_TEST.exec(line);
      if (t) {
        if (t[2] === "FAILED") failedIds.add(t[1] as string);
        else if (t[2] === "ok") okLines++;
        continue;
      }
      const s = CARGO_STDOUT.exec(line);
      if (s) {
        failedIds.add(s[1] as string);
        continue;
      }
      if (/^failures:\s*$/.test(line)) {
        for (let j = i + 1; j < lines.length; j++) {
          const item = CARGO_LIST_ITEM.exec(lines[j] as string);
          if (!item) break;
          failedIds.add(item[1] as string);
        }
        continue;
      }
      if (CARGO_COMPILE.test(line)) compile.add(line);
      else if (/^error: could not compile /.test(line)) couldNotCompile = true;
      else if (/^error: test failed, to rerun pass/.test(line)) testFailedLine = true;
      else targetsFailed = Math.max(targetsFailed, Number(CARGO_TARGETS_FAILED.exec(line)?.[1] ?? 0));
    }
    const errors = compile.size > 0 ? compile.size : couldNotCompile ? 1 : 0;
    const failed = Math.max(failedSum, failedIds.size, targetsFailed, failedStatus || testFailedLine ? 1 : 0);
    if (results.length === 0 && failed === 0 && errors === 0) return null;
    const summary = results.length === 0 ? null : (failedFirst ?? (results[results.length - 1] as string));
    return facts("cargo test", results.length > 0 ? passed : okLines, failed, errors, ignored, failedIds, summary);
  },
};

const DOTNET_SUMMARY = /^\s*(Passed|Failed)!\s+-\s+Failed:\s*(\d+),\s*Passed:\s*(\d+),\s*Skipped:\s*(\d+),\s*Total:\s*(\d+)/;
const DOTNET_FAILED = /^\s+Failed (.+?) \[[^\]]*\]\s*$/;
const DOTNET_PASSED = /^\s+Passed (.+?) \[[^\]]*\]\s*$/;
const VSTEST_RUN = /^\s*Test Run (Successful|Failed|Aborted|Canceled)\.?\s*$/;
const VSTEST_TOTAL = /^\s*Total tests:\s*(\d+)\s*$/;
const VSTEST_COUNT = /^\s+(Passed|Failed|Skipped):\s*(\d+)\s*$/;
const DOTNET_ERROR = /^(.*?)\s*(?:\[[^\]]*\.\w*proj\])?\s*$/;

const dotnet: RunnerParser = {
  name: "dotnet test",
  parse(text) {
    const lines = prepare(text);
    const summaries: string[] = [];
    const failedIds = new Set<string>();
    const buildErrors = new Set<string>();
    let passed = 0;
    let failedSum = 0;
    let skipped = 0;
    let passedLines = 0;
    let failedStatus = false;
    let failedFirst: string | null = null;
    let noTests: string | null = null;
    let runFailed = false;
    let buildFailed = false;
    let vsOpen = false;
    let vsTotal = 0;
    let vsAccounted = 0;
    let vsCut = false;
    for (const line of lines) {
      const vr = VSTEST_RUN.exec(line);
      if (vr) {
        vsOpen = true;
        if (vr[1] === "Successful") summaries.push(line);
        else if (vr[1] === "Failed") runFailed = true;
        else vsCut = true;
        continue;
      }
      if (vsOpen) {
        const vt = VSTEST_TOTAL.exec(line);
        if (vt) {
          vsTotal += Number(vt[1]);
          continue;
        }
        const vc = VSTEST_COUNT.exec(line);
        if (vc) {
          const n = Number(vc[2]);
          vsAccounted += n;
          if (vc[1] === "Passed") passed += n;
          else if (vc[1] === "Failed") failedSum += n;
          else skipped += n;
          continue;
        }
      }
      const s = DOTNET_SUMMARY.exec(line);
      if (s) {
        summaries.push(line);
        failedSum += Number(s[2]);
        passed += Number(s[3]);
        skipped += Number(s[4]);
        if (s[1] === "Failed") {
          failedStatus = true;
          failedFirst ??= line;
        }
        continue;
      }
      const f = DOTNET_FAILED.exec(line);
      if (f) {
        failedIds.add(f[1] as string);
        continue;
      }
      if (DOTNET_PASSED.test(line)) {
        passedLines++;
        continue;
      }
      if (/:\s+error (?!TS\d)[A-Z]{2,4}\d{3,5}:/.test(line)) {
        buildErrors.add((DOTNET_ERROR.exec(line)?.[1] ?? line).trim());
        continue;
      }
      if (/^\s*No test is available\b/.test(line)) noTests ??= line;
      else if (/^\s*Test Run Failed\.?\s*$/.test(line)) runFailed = true;
      else if (/^\s*Build FAILED\.?\s*$/.test(line)) buildFailed = true;
    }
    const errors = buildErrors.size > 0 ? buildErrors.size : buildFailed ? 1 : 0;
    const failed = Math.max(failedSum, failedIds.size, failedStatus || runFailed ? 1 : 0);
    const hasSummary = summaries.length > 0 || noTests !== null || vsCut;
    if (!hasSummary && failed === 0 && errors === 0) return null;
    const summary = summaries.length > 0 ? (failedFirst ?? (summaries[summaries.length - 1] as string)) : noTests;
    return facts("dotnet test", summaries.length > 0 || vsAccounted > 0 ? passed : passedLines, failed, errors, skipped, failedIds, summary, vsCut || vsTotal !== vsAccounted);
  },
};

export const parsers: readonly RunnerParser[] = [go, cargo, dotnet];
