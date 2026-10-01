// Parsers for jest, vitest, mocha, eslint, tsc and node:test output. Only structured markers and counts are read; prose in the log is ignored.
// Worst case wins: a failure marker anywhere beats a passing summary line, and a log cut off before its summary never counts as a pass.

import type { RunnerFacts, RunnerParser } from "./types.ts";

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const MAX_FAILING = 10;
const MAX_NAME = 120;
const MAX_SUMMARY = 200;

interface Counts {
  passed: number;
  failed: number;
  skipped: number;
}

interface Tally {
  line: string | null;
  last: Counts;
  failedMax: number;
}

function toLines(text: string): string[] {
  return text.replace(ANSI, "").split(/\r\n|\r|\n/);
}

function clip(line: string | null): string | null {
  return line === null ? null : line.trim().slice(0, MAX_SUMMARY);
}

function listFailing(ids: Iterable<string>): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim().slice(0, MAX_NAME);
    if (id !== "" && !out.includes(id)) out.push(id);
    if (out.length === MAX_FAILING) break;
  }
  return out;
}

function countsOf(body: string): Counts {
  const c: Counts = { passed: 0, failed: 0, skipped: 0 };
  for (const m of body.matchAll(/(\d+)\s+(failed|passed|skipped|todo|pending|total)\b/g)) {
    const n = Number(m[1]);
    if (m[2] === "failed") c.failed += n;
    else if (m[2] === "passed") c.passed += n;
    else if (m[2] !== "total") c.skipped += n;
  }
  return c;
}

function tally(lines: readonly string[], re: RegExp): Tally {
  const t: Tally = { line: null, last: { passed: 0, failed: 0, skipped: 0 }, failedMax: 0 };
  for (const l of lines) {
    const m = re.exec(l);
    if (m === null) continue;
    t.line = l;
    t.last = countsOf(m[1] ?? "");
    t.failedMax = Math.max(t.failedMax, t.last.failed);
  }
  return t;
}

function facts(runner: string, f: Omit<RunnerFacts, "runner" | "failing" | "summary_line"> & { failing: Iterable<string>; summary: string | null }): RunnerFacts {
  return { runner, passed: f.passed, failed: f.failed, errors: f.errors, skipped: f.skipped, failing: listFailing(f.failing), summary_line: clip(f.summary) };
}

function parseJest(text: string): RunnerFacts | null {
  const lines = toLines(text);
  const tests = tally(lines, /^\s*Tests:\s+(?=.*\b\d+\s+(?:failed|passed|skipped|todo|total)\b)(\d.*)$/);
  const suites = tally(lines, /^\s*Test Suites:\s+(\d.*)$/);
  const noTests = lines.find((l) => /^\s*No tests found\b/.test(l)) ?? null;
  const ids = new Set<string>();
  const files = new Set<string>();
  let runErrors = 0;
  for (const l of lines) {
    const h = /^\s*● (.+?)\s*$/.exec(l);
    if (h !== null) {
      const name = h[1] ?? "";
      if (/^Test suite failed to run\b/.test(name)) runErrors += 1;
      else if (!/^(?:Console|Validation Warning|Deprecation Warning)\b/.test(name)) ids.add(name);
      continue;
    }
    const f = /^\s*FAIL\s+(\S*[./]\S*)(?:\s+\(.*\))?\s*$/.exec(l);
    if (f !== null) files.add(f[1] ?? "");
  }
  if (tests.line === null && suites.line === null && noTests === null && ids.size === 0 && files.size === 0 && runErrors === 0) return null;
  const failed = Math.max(tests.failedMax, ids.size, ids.size === 0 && runErrors === 0 ? files.size : 0);
  const errors = Math.max(runErrors, failed === 0 ? suites.failedMax : 0);
  return facts("jest", {
    passed: tests.last.passed,
    failed,
    errors,
    skipped: tests.last.skipped,
    failing: ids.size > 0 ? ids : files,
    summary: tests.line ?? suites.line ?? noTests,
  });
}

function parseVitest(text: string): RunnerFacts | null {
  const lines = toLines(text);
  const tests = tally(lines, /^\s*Tests\s+(\d.*)$/);
  const files = tally(lines, /^\s*Test Files\s+(\d.*)$/);
  const noFiles = lines.find((l) => /^\s*No test files found\b/.test(l)) ?? null;
  const ids = new Set<string>();
  const loadFails = new Set<string>();
  const markedFiles = new Set<string>();
  let unhandled = 0;
  for (const l of lines) {
    const f = /^\s*FAIL\s+(\S.*?)\s*$/.exec(l);
    if (f !== null) {
      const id = f[1] ?? "";
      if (id.includes(" > ")) ids.add(id);
      else if (/\[.*\]$/.test(id)) loadFails.add(id);
      continue;
    }
    const m = /^\s*❯ (\S+) \(\d+ tests?(?: \| (\d+) failed)?/.exec(l);
    if (m !== null && Number(m[2] ?? 0) > 0) {
      markedFiles.add(m[1] ?? "");
      continue;
    }
    const e = /^\s*Errors\s+(\d+) errors?\b/.exec(l);
    if (e !== null) unhandled = Math.max(unhandled, Number(e[1]));
  }
  const marked = ids.size + loadFails.size + markedFiles.size;
  if (tests.line === null && files.line === null && noFiles === null && marked === 0 && unhandled === 0) return null;
  const failed = Math.max(tests.failedMax, ids.size, ids.size === 0 && markedFiles.size > 0 ? markedFiles.size : 0);
  const errors = Math.max(loadFails.size, unhandled, failed === 0 ? files.failedMax : 0);
  return facts("vitest", {
    passed: tests.last.passed,
    failed,
    errors,
    skipped: tests.last.skipped,
    failing: ids.size + loadFails.size > 0 ? [...ids, ...loadFails] : markedFiles,
    summary: tests.line ?? files.line ?? noFiles,
  });
}

function parseMocha(text: string): RunnerFacts | null {
  const lines = toLines(text);
  let passLine: string | null = null;
  let failLine: string | null = null;
  let pendLine: string | null = null;
  let passIdx = -1;
  let pendIdx = -1;
  let failIdx = -1;
  let passed = 0;
  let skipped = 0;
  let failedMax = 0;
  let evidence = false;
  lines.forEach((l, i) => {
    const m = /^\s*(\d+) (passing|failing|pending)\b/.exec(l);
    if (m !== null) {
      const n = Number(m[1]);
      if (m[2] === "passing") [passLine, passIdx, passed] = [l, i, n];
      else if (m[2] === "pending") [pendLine, pendIdx, skipped] = [l, i, n];
      else [failLine, failIdx, failedMax] = [l, i, Math.max(failedMax, n)];
    } else if (/^\s*[✔✓]\s/.test(l)) evidence = true;
  });
  if (pendIdx < passIdx) skipped = 0;
  const hasSummary = passLine !== null || failLine !== null || pendLine !== null;
  const ids = new Map<number, string>();
  if (hasSummary || evidence) {
    lines.forEach((l, i) => {
      const m = /^\s{2,}(\d+)\) (\S.*?)\s*$/.exec(l);
      if (m === null) return;
      let name = m[2] ?? "";
      const next = i > failIdx && failIdx >= 0 ? /^\s{5,}(\S.*):\s*$/.exec(lines[i + 1] ?? "") : null;
      if (next !== null) name = `${name} > ${next[1] ?? ""}`;
      ids.set(Number(m[1]), name);
    });
  }
  if (!hasSummary && ids.size === 0) return null;
  return facts("mocha", {
    passed,
    failed: Math.max(failedMax, ids.size),
    errors: 0,
    skipped,
    failing: ids.values(),
    summary: passLine ?? failLine ?? pendLine,
  });
}

function parseEslint(text: string): RunnerFacts | null {
  const lines = toLines(text);
  let summary: string | null = null;
  let errorsMax = 0;
  let file = "";
  const entries = new Set<string>();
  let sawLine = false;
  for (const l of lines) {
    const s = /^\s*✖\s+(\d+) problems?\s+\((\d+) errors?,\s*(\d+) warnings?\)/.exec(l);
    if (s !== null) {
      summary = l;
      errorsMax = Math.max(errorsMax, Number(s[2]));
      continue;
    }
    const d = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.*?)(?:\s{2,}([@\w/.-]+))?\s*$/.exec(l);
    if (d !== null) {
      sawLine = true;
      if (d[3] === "error") entries.add(`${file === "" ? "" : `${file}:`}${d[1]}:${d[2]} ${d[5] ?? "error"}`);
      continue;
    }
    if (/^\S*[./\\]\S*$/.test(l)) file = l;
  }
  if (summary === null && !sawLine) return null;
  return facts("eslint", { passed: 0, failed: 0, errors: Math.max(errorsMax, entries.size), skipped: 0, failing: entries, summary });
}

function parseTsc(text: string): RunnerFacts | null {
  const lines = toLines(text);
  let summary: string | null = null;
  let errorsMax = 0;
  const entries = new Set<string>();
  for (const l of lines) {
    const s = /^\s*(?:\[[^\]]*\]\s*)?Found (\d+) errors?\b/.exec(l);
    if (s !== null) {
      summary = l;
      errorsMax = Math.max(errorsMax, Number(s[1]));
      continue;
    }
    const a = /^\s*(\S+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):/.exec(l) ?? /^\s*(\S+?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):/.exec(l);
    if (a !== null) {
      entries.add(`${a[1]}:${a[2]}:${a[3]} ${a[4]}`);
      continue;
    }
    const g = /^\s*error\s+(TS\d+):/.exec(l);
    if (g !== null) entries.add(g[1] ?? "");
  }
  if (summary === null && entries.size === 0) return null;
  const errors = Math.max(errorsMax, entries.size);
  return facts("tsc", { passed: summary !== null && errors === 0 ? 1 : 0, failed: 0, errors, skipped: 0, failing: entries, summary });
}

function parseNodeTest(text: string): RunnerFacts | null {
  const lines = toLines(text);
  const num = (key: string): number | null => {
    const hit = [...lines].reverse().map((l) => new RegExp(`^ℹ ${key} (\\d+)\\s*$`).exec(l)).find((m) => m !== null);
    return hit ? Number(hit[1]) : null;
  };
  const tests = num("tests");
  const pass = num("pass");
  const fail = num("fail");
  const ids = new Set<string>();
  let inFailing = false;
  for (const l of lines) {
    if (/^✖ failing tests:\s*$/.test(l)) inFailing = true;
    const m = /^✖ (.+?) \(\d+(?:\.\d+)?ms\)\s*$/.exec(l);
    if (m !== null && !inFailing) ids.add(m[1] as string);
  }
  const summary = tests !== null && pass !== null && fail !== null ? lines.filter((l) => /^ℹ (?:tests|pass|fail) \d+\s*$/.test(l)).slice(-3).join(" ") : null;
  const failed = Math.max(fail ?? 0, ids.size);
  if (summary === null && failed === 0) return null;
  return facts("node:test", { passed: pass ?? 0, failed, errors: 0, skipped: num("skipped") ?? 0, failing: ids, summary });
}

export const parsers: readonly RunnerParser[] = [
  { name: "jest", parse: parseJest },
  { name: "vitest", parse: parseVitest },
  { name: "mocha", parse: parseMocha },
  { name: "eslint", parse: parseEslint },
  { name: "tsc", parse: parseTsc },
  { name: "node:test", parse: parseNodeTest },
];
