// bun test: summary lines (" N pass/fail/skip/todo/error", "snapshots: ... N failed", "Ran N tests across N files."), "(fail)/(skip)/(todo)" lines, also behind bun --filter's "pkg script: " prefix.
// Claims only a log that shows a failure (or "regex ... matched 0 tests", an error); a clean bun log keeps its exit-code reading, so recorded case done-v2-h4/h4-c-02 keeps its facts.

import type { RunnerFacts, RunnerParser } from "./types.ts";
import { mk, prepare } from "./util.ts";

function parseBun(text: string): RunnerFacts | null {
  const last: Record<string, number> = {};
  let ran: string | null = null;
  let failMax = 0;
  let errorMax = 0;
  let snapFailed = false;
  let empty: string | null = null;
  const ids = new Set<string>();
  const parked = new Set<string>();
  const read = (l: string): boolean => {
    if (/^Ran \d+ tests? across \d+ files?\./.test(l)) {
      ran = l;
      return true;
    }
    const c = /^\s*(\d+) (pass|fail|skip|todo|errors?)\s*$/.exec(l);
    if (c !== null) {
      const [n, key] = [Number(c[1]), (c[2] as string).replace(/^errors$/, "error")];
      last[key] = n;
      if (key === "fail") failMax = Math.max(failMax, n);
      if (key === "error") errorMax = Math.max(errorMax, n);
      return true;
    }
    if (/^snapshots: .*\b[1-9]\d* failed\b/.test(l)) {
      snapFailed = true;
      return true;
    }
    if (/^error: regex .* matched 0 tests\b/.test(l)) {
      empty = l;
      return true;
    }
    const f = /^\((fail|skip|todo)\) (.+?)(?: \[\d+(?:\.\d+)?m?s\])?\s*$/.exec(l);
    if (f !== null) (f[1] === "fail" ? ids : parked).add(f[2] as string);
    return f !== null;
  };
  for (const l of prepare(text)) read(l) || read(l.replace(/^\S+ \S+: /, ""));
  const summary = ran !== null;
  if (empty !== null && !summary && ids.size === 0) return mk("bun test", { errors: 1 }, [], empty, true);
  if (ids.size === 0 && !snapFailed && !(summary && failMax + errorMax > 0)) return null;
  const counts = {
    passed: summary ? (last["pass"] ?? 0) : 0,
    failed: Math.max(summary ? failMax : 0, ids.size, snapFailed ? 1 : 0),
    errors: summary ? errorMax : 0,
    skipped: Math.max(summary ? (last["skip"] ?? 0) + (last["todo"] ?? 0) : 0, parked.size),
  };
  return mk("bun test", counts, ids, ran, !summary);
}

export const parsers: readonly RunnerParser[] = [{ name: "bun test", parse: parseBun }];
