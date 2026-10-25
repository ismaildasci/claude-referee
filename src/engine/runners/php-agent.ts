// Pint, PHPStan and Rector agent-format JSON summaries (docs/decisions/php-agent-json.md), and laravel/pao's Pest, PHPUnit and Paratest lines as test runners (docs/decisions/pao-test-json.md): one object per run, seen glued to other output.
// An object counts only at a line start, after a `N:` grep prefix, or right after another summary's closing brace; text before it on the line rules it out.
// Facts are counts, failing test names and fixed sentences (never paths, file names or messages); the worst result per tool wins; `fixed` (files rewritten) or a test object that does not parse marks the run incomplete.

import type { RunnerFacts, RunnerParser } from "./types.ts";
import { buildOnly, mk, prepare } from "./util.ts";

type Result = "passed" | "failed" | "fixed";
interface Summary {
  readonly result: Result;
  readonly errors: number;
  readonly changed: number;
  readonly text: string;
}
interface PaoTests {
  readonly tests?: unknown;
  readonly passed?: unknown;
  readonly failed?: unknown;
  readonly errors?: unknown;
  readonly skipped?: unknown;
  readonly incomplete?: unknown;
  readonly risky?: unknown;
  readonly failures?: readonly { readonly test?: unknown }[];
  readonly error_details?: readonly { readonly test?: unknown }[];
}

const TEST_TOOLS: ReadonlySet<string> = new Set(["pest", "phpunit", "paratest"]);
const HEAD = /\{"tool":"(pint|phpstan|rector|pest|phpunit|paratest)","result":"(passed|failed|fixed)"/y;
const LEAD = /^\s*(?:\d+:)?/;
const PHPSTAN_ERRORS = /^\{"tool":"phpstan","result":"\w+","errors":(\d+)/;
const RECTOR_TOTALS = /^\{"tool":"rector","result":"\w+","totals":\{"changed_files":(\d+),"errors":(\d+)\}/;

function objectEnd(line: string, from: number): number {
  let depth = 0;
  let quoted = false;
  for (let i = from; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === "\\") i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i + 1;
  }
  const next = line.indexOf('{"tool":', from + 1);
  return next === -1 ? line.length : next;
}

function summariesIn(line: string): Map<string, Summary[]> {
  const found = new Map<string, Summary[]>();
  let at = (LEAD.exec(line) as RegExpExecArray)[0].length;
  for (;;) {
    HEAD.lastIndex = at;
    const head = HEAD.exec(line);
    if (!head) return found;
    const end = objectEnd(line, at);
    const text = line.slice(at, end);
    const [tool, result] = [head[1] as string, head[2] as Result];
    const rector = RECTOR_TOTALS.exec(text);
    const errors = Number(PHPSTAN_ERRORS.exec(text)?.[1] ?? rector?.[2] ?? 0);
    const seen = found.get(tool) ?? [];
    seen.push({ result, errors, changed: Number(rector?.[1] ?? 0), text });
    found.set(tool, seen);
    at = end;
  }
}

function factsFor(tool: string, all: readonly Summary[]): RunnerFacts {
  const errors = Math.max(...all.map((s) => s.errors));
  const changed = Math.max(...all.map((s) => s.changed));
  const failed = errors > 0 || changed > 0 || all.some((s) => s.result === "failed");
  const fixed = !failed && all.some((s) => s.result === "fixed");
  if (tool === "rector") {
    const summary = failed ? `rector would change ${changed} files and reported ${errors} errors` : "rector dry run found nothing to change";
    return buildOnly(mk("rector", { failed: changed, errors }, [], summary, false));
  }
  const reported = Math.max(errors, failed ? 1 : 0);
  const summary = tool === "phpstan" ? (failed ? `phpstan reported ${reported} errors` : "phpstan reported no errors") : fixed ? "pint rewrote files (result fixed)" : failed ? "pint reported style issues (result failed)" : "pint reported no style issues";
  return buildOnly(mk(tool, { errors: reported }, [], summary, fixed));
}

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
const asTests = (text: string): PaoTests | null => {
  try {
    return JSON.parse(text) as PaoTests;
  } catch {
    return null;
  }
};

function testFacts(tool: string, all: readonly Summary[]): RunnerFacts {
  const read = all.map((s) => asTests(s.text));
  const last = read.at(-1) ?? null;
  const failed = Math.max(...read.map((r) => count(r?.failed)));
  const reported = Math.max(...read.map((r) => count(r?.errors)));
  const errors = failed + reported === 0 && all.some((s) => s.result === "failed") ? 1 : reported;
  const passed = Math.max(0, count(last?.passed) - count(last?.incomplete) - count(last?.risky));
  const skipped = count(last?.skipped) + count(last?.incomplete) + count(last?.risky);
  const details = read.flatMap((r) => [...(Array.isArray(r?.failures) ? r.failures : []), ...(Array.isArray(r?.error_details) ? r.error_details : [])]);
  const names = new Set(details.map((d) => d?.test).filter((t): t is string => typeof t === "string"));
  const tests = count(last?.tests);
  const summary = failed + errors > 0 ? `${tool} failed: ${failed} failed, ${errors} errors of ${tests} tests (agent JSON)` : `${tool} passed ${passed} of ${tests} tests (agent JSON)`;
  return mk(tool, { passed, failed, errors, skipped }, names, summary, read.some((r) => r === null));
}

const runner = (tool: string): RunnerParser => ({
  name: tool,
  parse(text) {
    const all = prepare(text).flatMap((line) => summariesIn(line).get(tool) ?? []);
    return all.length === 0 ? null : TEST_TOOLS.has(tool) ? testFacts(tool, all) : factsFor(tool, all);
  },
});

export const parsers: readonly RunnerParser[] = ["pint", "phpstan", "rector", "pest", "phpunit", "paratest"].map(runner);
