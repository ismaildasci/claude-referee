// parseEvidence: turns piped check output into facts (runner counts, exit code, failing names) or reports it unparsed.
// Several summaries or failure markers are merged worst-case; unrecognised output is "unparsed" and can never become met.

import { parsers as compiled } from "./compiled.ts";
import { parsers as builds } from "./builds.ts";
import { parsers as js } from "./js.ts";
import { parsers as more } from "./more.ts";
import { parsers as moreTools } from "./more-tools.ts";
import { parsers as native } from "./native.ts";
import { parsers as phpRuby } from "./php-ruby.ts";
import { parsers as python } from "./python.ts";
import { parsers as scenarios } from "./scenarios.ts";
import { parsers as suites } from "./suites.ts";
import type { RunnerFacts, RunnerParser } from "./types.ts";

export type { RunnerFacts, RunnerParser } from "./types.ts";

export type Trust = "parsed" | "exit_code" | "unparsed";

export interface ParsedEvidence {
  readonly trust: Trust;
  readonly exit_code: number | null;
  readonly exit_lines: readonly string[];
  readonly runners: readonly RunnerFacts[];
  readonly conflict: boolean;
  readonly lines: number;
}

const PARSERS: readonly RunnerParser[] = [...python, ...js, ...compiled, ...phpRuby, ...more, ...suites, ...scenarios, ...builds, ...native, ...moreTools];

export function parseEvidence(text: string): ParsedEvidence {
  const runners = PARSERS.map((p) => p.parse(text)).filter((r): r is RunnerFacts => r !== null);
  const exitMatches = [...text.matchAll(/^.{0,60}?\bexit (?:code|status)\s*[:=]?\s*(-?\d+)/gim)];
  const exit = exitMatches.map((m) => Number(m[1]));
  const exit_lines = exitMatches.slice(0, 3).map((m) => m[0].trim().slice(0, 80));
  const exit_code = exit.length === 0 ? null : exit.some((c) => c !== 0) ? (exit.find((c) => c !== 0) as number) : 0;
  const conflict = runners.some((r) => r.failed + r.errors > 0) && (runners.some((r) => r.failed + r.errors === 0 && r.passed > 0) || exit_code === 0);
  const trust: Trust = runners.length > 0 ? "parsed" : exit_code !== null ? "exit_code" : "unparsed";
  return { trust, exit_code, exit_lines, runners, conflict, lines: text.split("\n").length };
}
