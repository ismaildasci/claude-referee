// done: does the check output show each criterion holds? One request; every criterion is a Noul on the same evidence.
// Recognised runner output is parsed in code and only those facts reach Jev; unrecognised output can never become met.
// A non-zero exit code in the evidence is missing without a request; skipped, risky or incomplete tests cap met at unsure.
// Exit-code-only evidence for a lint or clean criterion that shows a warning, notice, failure or skip message, or a swallowed exit code, is capped at unsure.
// A parsed run that is cut off, empty, cancelled, flaky or changed files, or a lint or clean criterion with parsed warnings, is capped the same way.

import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { RefereeError } from "../../engine/errors.ts";
import { parseEvidence, type ParsedEvidence } from "../../engine/runners/index.ts";
import type { Result } from "../../engine/output.ts";
import { threshold, type Pack, type Thresholds } from "../../engine/pack.ts";
import type { Outcome, Planned } from "../../engine/session.ts";
import type { Command } from "../types.ts";
import { JEV_COST, JEV_EFFECTS, JEV_ERRORS, clip, jevCommand, list, openPack, question, readSource, str, stripAnsi, withData } from "../shared.ts";

type Verdict = "met" | "unsure" | "missing";

const NEXT: Readonly<Record<Exclude<Verdict, "met">, string>> = {
  missing: "The evidence doesn't show the criterion. Run the check that proves it and pipe its output in; the same evidence gives the same answer.",
  unsure: "The evidence is ambiguous. Pipe the full output of the check that proves the criterion, or narrow the criterion.",
};

export function doneEvidence(text: string): string {
  return clip(stripAnsi(text), 2_000, 12_000);
}

const SKIPPED_NEXT = "Some tests were skipped, risky or incomplete, so done won't say met. Look at them: if they are expected (a platform-only test), say so yourself; otherwise run the skipped ones.";
const NO_TESTS = /\b(?:no tests? (?:to run|found|were found|executed|ran|collected|matched)|0 tests? (?:run|ran|executed|collected|found|completed)|tests? run: 0(?!\d)|nothing to run)/i;
const INCOMPLETE_NEXT = "The run is cut off, empty, cancelled, flaky or changed files, so done won't say met. Run the full check again and pipe all of its output in.";
const NO_TESTS_NEXT = "The log itself says no tests ran, so done won't say met. Run the tests that were meant to run and pipe their output in.";
const SKIP_WORDS = /^OK, but .*\b(?:incomplete|skipped|risky)\b/i;

function hasSkips(parsed: ParsedEvidence): boolean {
  return parsed.runners.some((r) => r.skipped > 0 || (r.summary_line !== null && SKIP_WORDS.test(r.summary_line)));
}

function hasIncomplete(parsed: ParsedEvidence): boolean {
  return parsed.runners.some((r) => r.incomplete === true);
}

function hasParsedWarnings(parsed: ParsedEvidence): boolean {
  return parsed.runners.some((r) => (r.warnings ?? 0) > 0);
}

const UNPARSED_NEXT = 'No recognised runner summary or exit code in the evidence, so it cannot count as met. Pipe the runner\'s full output, or add an exit code line: { your-command; echo "exit code: $?"; } 2>&1 | claude-referee done --criteria "..."';

const CLEAN_CRITERION = /\b(?:lint\w*|clean|warning[- ]?free|no warnings?)\b/i;
const WARN_WORDS = /\b(?:warnings?|notices?|deprecat\w*)\b/i;
const WARN_NEGATED = /\b(?:0|no|zero|without) (?:warnings?|notices?)\b/gi;
const WARN_FLAG = /--?[\w-]*warn[\w-]*(?:[ =]\S+)?/gi;
const PROBLEM_WORDS = /\b(?:fail\w*|skipp\w*|partial\w*|errors?|violations?|findings?)\b/i;
const PROBLEM_NEGATED = /\b(?:0|no|zero|without) (?:errors?|findings?|violations?|failures?)\b/gi;
const SWALLOWED = /\|\|\s*true\b|--no-fail\b|--exit-zero\b/i;
const WARNING_NEXT = "The log shows a warning, notice, failure or skip wording, or a swallowed exit code, and only an exit code backs the lint criterion, so done won't say met. Pipe the linter's full summary, or say yourself that the warning is acceptable.";

export function hasWarningMessage(evidence: string): boolean {
  return WARN_WORDS.test(evidence.replace(WARN_FLAG, " ").replace(WARN_NEGATED, " "));
}

export function hasProblemMessage(evidence: string): boolean {
  const log = evidence.replace(/(?:^|\n)[ \t]*\$[^\n]*/g, " ").replace(PROBLEM_NEGATED, " ");
  return PROBLEM_WORDS.test(log) || SWALLOWED.test(evidence);
}

function factsOf(parsed: ParsedEvidence): Record<string, unknown> {
  return { trust: parsed.trust, exit_code: parsed.exit_code, exit_lines: parsed.exit_lines, runners: parsed.runners, conflict: parsed.conflict, lines: parsed.lines };
}

export function doneRequest(pack: Pack, thresholds: Thresholds | undefined, criteria: readonly string[], evidence: string): { planned: Planned[]; finish: (outcomes: Outcome[]) => Result } {
  const parsed = parseEvidence(evidence);
  if (parsed.exit_code !== null && parsed.exit_code !== 0) {
    const code = parsed.exit_code;
    return {
      planned: [],
      finish: () => ({
        ok: true,
        verdict: "missing",
        reason: "exit_code_nonzero",
        trust: parsed.trust,
        exit_code: code,
        p: 0,
        next_step: `The check exited with code ${code}, so nothing can be met and Jev was not asked. Fix the failure and run the check again.`,
      }),
    };
  }
  const base = question(pack, "done.met");
  const questions: Questions = Object.fromEntries(criteria.map((criterion, i) => [`c${i + 1}`, { ...base, instructions: withData(base.instructions, { criterion }) }]));
  const met = threshold(pack, thresholds, "done.met", "met", 0.7);
  const missing = threshold(pack, thresholds, "done.met", "missing", 0.5);
  const finish = ([outcome]: Outcome[]): Result => {
    const warnCap = (parsed.trust === "exit_code" && (hasWarningMessage(evidence) || hasProblemMessage(evidence))) || hasParsedWarnings(parsed);
    const per = criteria.map((criterion, i) => {
      const answer = outcome?.answers?.[`c${i + 1}`];
      const p = answer?.type === "noul" ? answer.noul : 0;
      const raw: Verdict = p >= met ? "met" : p < missing ? "missing" : "unsure";
      const skipCap = raw === "met" && hasSkips(parsed);
      const noTestsCap = raw === "met" && NO_TESTS.test(evidence);
      const incompleteCap = raw === "met" && hasIncomplete(parsed);
      const warningCap = raw === "met" && warnCap && CLEAN_CRITERION.test(criterion);
      const verdict: Verdict = raw === "met" && (parsed.trust === "unparsed" || parsed.conflict || skipCap || noTestsCap || incompleteCap || warningCap) ? "unsure" : raw;
      return { i: i + 1, verdict, p, skipCap, noTestsCap, incompleteCap, warningCap };
    });
    const settled = per.every((c) => c.verdict !== "missing") && parsed.trust !== "unparsed" && !parsed.conflict;
    const noTestsCapped = settled && per.some((c) => c.noTestsCap);
    const skipCapped = settled && !noTestsCapped && per.some((c) => c.skipCap);
    const incompleteCapped = settled && !noTestsCapped && !skipCapped && per.some((c) => c.incompleteCap);
    const warningCapped = settled && !noTestsCapped && !skipCapped && !incompleteCapped && per.some((c) => c.warningCap);
    const verdict: Verdict = per.some((c) => c.verdict === "missing") ? "missing" : per.some((c) => c.verdict === "unsure") ? "unsure" : "met";
    return {
      ok: true,
      verdict,
      p: Math.min(...per.map((c) => c.p)),
      trust: parsed.trust,
      ...(parsed.exit_code !== null ? { exit_code: parsed.exit_code } : {}),
      ...(parsed.runners.length > 0 ? { runners: parsed.runners.map((r) => ({ runner: r.runner, passed: r.passed, failed: r.failed, errors: r.errors, skipped: r.skipped })) } : {}),
      ...(noTestsCapped && verdict === "unsure" ? { reason: "no_tests_run" } : skipCapped && verdict === "unsure" ? { reason: "skipped_tests" } : incompleteCapped && verdict === "unsure" ? { reason: "incomplete_run" } : warningCapped && verdict === "unsure" ? { reason: "warning_in_log" } : {}),
      ...(per.length > 1 ? { criteria: per.map(({ i, verdict: v, p: pp }) => ({ i, verdict: v, p: pp })) } : {}),
      next_step: verdict === "met" ? undefined : noTestsCapped && verdict === "unsure" ? NO_TESTS_NEXT : skipCapped && verdict === "unsure" ? SKIPPED_NEXT : incompleteCapped && verdict === "unsure" ? INCOMPLETE_NEXT : warningCapped && verdict === "unsure" ? WARNING_NEXT : parsed.trust === "unparsed" && per.every((c) => c.verdict !== "missing") ? UNPARSED_NEXT : NEXT[verdict],
    };
  };
  const state = (parsed.trust === "unparsed" ? { evidence } : { evidence: factsOf(parsed) }) as EntryType;
  return { planned: [{ id: "done", state, questions }], finish };
}

export const done: Command = {
  name: "done",
  describe: {
    summary: "Check whether piped test or lint output shows that each criterion holds.",
    inputs: {
      "--criteria <text>": "What must hold, e.g. \"all tests pass\". Repeat for several; max 10.",
      "--evidence <file|->": "The check output. '-' or omitted reads stdin. ANSI colours are stripped; long output keeps its first 2,000 and last 12,000 characters. Output from a recognised test runner, linter or type checker, or with an exit code line, is parsed in code and only those facts are sent; anything else is sent as text and can never count as met.",
    },
    outputs: {
      verdict: "met, unsure or missing; the lowest across criteria",
      trust: "parsed (a runner summary was recognised), exit_code (only an exit code line) or unparsed (met is not possible)",
      runners: "Parsed counts per recognised runner",
      reason: "exit_code_nonzero when the evidence has a non-zero exit code (missing, Jev not asked); skipped_tests, no_tests_run, incomplete_run or warning_in_log when met was capped at unsure because tests were skipped, risky or incomplete, the log says no tests ran, the parsed run is cut off, empty, cancelled, flaky or changed files, or a lint or clean criterion has a warning behind it (parsed, or in a log with only an exit code)",
      p: "Lowest probability that a criterion holds",
      criteria: "Per criterion, by position, when more than one",
      next_step: "Only when not met",
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: JEV_COST,
  },
  options: { criteria: { type: "string", multiple: true }, evidence: { type: "string" } },
  async run(context) {
    const criteria = list(context, "criteria").map((c) => c.trim()).filter(Boolean);
    if (criteria.length === 0) throw new RefereeError("bad_input", "Give at least one --criteria.", { next_step: 'Example: --criteria "all tests pass"' });
    if (criteria.length > 10) throw new RefereeError("bad_input", "At most 10 criteria per call.");
    const evidence = doneEvidence(await readSource(context, str(context, "evidence"), "evidence"));
    if (!evidence.trim()) throw new RefereeError("bad_input", "The evidence is empty.");
    const { pack, project } = openPack(context);
    const { planned, finish } = doneRequest(pack, project?.thresholds, criteria, evidence);
    if (planned.length === 0 && !context.flags.dryRun) return { ...finish([]), requests: 0, cached: 0 };
    return jevCommand(context, "done", pack, planned, finish);
  },
};
