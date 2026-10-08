// Runner-parser helpers (ANSI, clipping, facts; formats in docs/decisions/runner-parsers-met-recall.md). stripTransport drops one GitHub line prefix, as scripts/real-ci/lib.mjs; stripAnsi (CSI) is the colour strip done and the Stop gate share.
// wrapperExits reads only non-zero codes from turbo, nx, bun run/--filter, concurrently and npm 10+ exit reports; a zero never adds an exit line.
// exitMatches is the one exit-line rule (source frames, test titles, open quotes and assertion messages rejected; hex read as its value), see docs/decisions/parser-defects-2026-10-06.md.

import type { RunnerFacts } from "./types.ts";

// CSI (also as one 8-bit byte), OSC up to BEL or ST (hyperlinks too) and charset designations; see docs/decisions/ansi-wide.md.
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u009b[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b\n]*(?:\u0007|\u001b\\)?|\u001b[()][\s\S]/g;
export const MAX_FAILING = 10;
export const MAX_NAME = 120;
export const MAX_SUMMARY = 200;

const TRANSPORT = /^\uFEFF?(?:[^\t\r\n]+\t[^\t\r\n]+\t)?\uFEFF?\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z(?: |(?=\r?$))/gm;

export const stripTransport = (text: string): string => text.replace(TRANSPORT, "");
export const stripAnsi = (text: string): string => text.replace(ANSI, "");

export const prepare = (text: string): string[] => stripAnsi(text).split(/\r?\n/);
export const clip = (value: string, max: number): string => value.trim().slice(0, max);

export function mk(
  runner: string,
  counts: { passed?: number; failed?: number; errors?: number; skipped?: number; warnings?: number; expected_failures?: number },
  failing: Iterable<string>,
  summary: string | null,
  incomplete: boolean,
): RunnerFacts {
  return {
    runner,
    passed: counts.passed ?? 0,
    failed: counts.failed ?? 0,
    errors: counts.errors ?? 0,
    skipped: counts.skipped ?? 0,
    ...(counts.warnings === undefined ? {} : { warnings: counts.warnings }),
    ...(counts.expected_failures === undefined || counts.expected_failures === 0 ? {} : { expected_failures: counts.expected_failures }),
    ...(incomplete ? { incomplete: true } : {}),
    failing: [...failing].slice(0, MAX_FAILING).map((n) => clip(n, MAX_NAME)),
    summary_line: summary === null ? null : clip(summary, MAX_SUMMARY),
  };
}

export const buildOnly = (facts: RunnerFacts): RunnerFacts => ({ ...facts, build_only: true });

const EXIT_PHRASE = /^(.{0,60}?)\bexit (?:code|status)\s*[:=]?\s*(0[xX][\da-fA-F]+|-?\d+)(?![\dxX])/gim;
const EXIT_GUTTER = /^\s*(?:[>❯]\s*)?\d+\s*\|/;
const EXIT_TITLE = /^\s*(?:[✔✓√○↓﹣▶]|\((?:pass|skip|todo)\)|ok \d+\b|# Subtest:)/;
const EXIT_FAIL_LEAD = /^\s*(?:[✗✕✖×✘●⚠]|\(fail\)|not ok \d+\b)/;
const EXIT_ASSERT = /\b(?:expected|expect(?:s|ing)?|should|want(?:ed)?|assert\w*)\s*$/i;
const EXIT_GOT = /^[ \t]*[,;]?[ \t]*(?:but[ \t]+)?(?:got|received|actual|want(?:ed)?|expected)\b/i;

function insideQuote(prefix: string): boolean {
  const bare = prefix.replace(/(?<=\p{L})['’](?=\p{L})/gu, "");
  return [/"/g, /'/g, /`/g].some((q) => (bare.match(q)?.length ?? 0) % 2 === 1);
}

function restOfLine(text: string, m: RegExpExecArray): string {
  const from = m.index + m[0].length;
  const end = text.indexOf("\n", from);
  return text.slice(from, end === -1 ? undefined : end);
}

export function exitMatches(text: string): RegExpExecArray[] {
  return [...text.matchAll(EXIT_PHRASE)].filter((m) => {
    const prefix = m[1] ?? "";
    if (EXIT_GUTTER.test(m[0]) || EXIT_TITLE.test(m[0]) || insideQuote(prefix) || EXIT_ASSERT.test(prefix) || EXIT_GOT.test(restOfLine(text, m))) return false;
    return !(EXIT_FAIL_LEAD.test(m[0]) && Number(m[2]) === 0);
  });
}

const WRAPPER_EXIT: readonly { re: RegExp; code?: number }[] = [
  { re: /^\[[^\]\s]+\] .+ exited with code (-?\d+)\s*$/ },
  { re: /^error: script "[^"]*" exited with code (-?\d+)\s*$/ },
  { re: /^\S+ \S+: Exited with code (-?\d+)\s*$/ },
  { re: /^(?:\S+:)?\s*ERROR\s+(?:run failed: )?command\b.* exited \((-?\d+)\)\s*$/ },
  { re: /^(?:\S+:\s+)?npm error code (-?\d+)\s*$/ },
  { re: /^\s*NX\s+Running targets? \S.* failed\s*$/, code: 1 },
];

export function wrapperExits(text: string): { line: string; code: number }[] {
  return prepare(text).flatMap((line) => {
    const hit = WRAPPER_EXIT.map(({ re, code }) => ({ m: re.exec(line), code })).find((h) => h.m !== null);
    const code = hit?.code ?? Number(hit?.m?.[1]);
    return hit === undefined || code === 0 ? [] : [{ line: line.trim(), code }];
  });
}

export function exitCodes(lines: readonly string[]): number[] {
  return lines.flatMap((line) => exitMatches(line).slice(0, 1).map((m) => Number(m[2])));
}
