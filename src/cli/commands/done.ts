// done: does the check output show each criterion holds? One request; every criterion is a Noul on the same evidence.
// Recognised runner output is parsed in code and only those facts reach Jev; unrecognised output can never become met.
// A non-zero exit code in the evidence is missing without a request (a zero-request receipt; --dry-run prints that verdict); skipped, risky or incomplete tests, or a skip marker anywhere in the log, cap met at unsure.
// A lint or clean criterion (lint, clean, no warnings, or a linter's name such as oxlint) is capped at unsure when only an exit code backs it and the log shows a warning, notice, failure or skip message or a swallowed exit code, or when a test or build runner is parsed but no linter is and the log has a linter's warning or error line or a linter summary with a count above 0.
// A parsed run that is cut off, empty, cancelled, flaky or changed files, or a lint or clean criterion with parsed warnings, is capped the same way.
// Expected failures (known issues) cap met like skips; a test criterion backed only by build runners or oxlint (no test results) is capped as no tests run; a lint, build or typecheck criterion with no parsed runner of its kind gets a reason, never another verdict.

import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { RefereeError } from "../../engine/errors.ts";
import { parseEvidence, type ParsedEvidence } from "../../engine/runners/index.ts";
import { LINTERS, RUNNER_KINDS, uncoveredKinds } from "../../engine/runners/kinds.ts";
import { skipMarkers } from "../../engine/runners/skips.ts";
import type { Result } from "../../engine/output.ts";
import { threshold, type Pack, type Thresholds } from "../../engine/pack.ts";
import type { Outcome, Planned } from "../../engine/session.ts";
import type { Command } from "../types.ts";
import { JEV_COST, JEV_EFFECTS, JEV_ERRORS, clip, jevCommand, list, openPack, question, readSource, reorder, str, stripAnsi, withData } from "../shared.ts";
import { keepsEvidence, storeEvidence } from "../../engine/evidence.ts";
import { resolveDataDir } from "../../engine/datadir.ts";

type Verdict = "met" | "unsure" | "missing";

const NEXT: Readonly<Record<Exclude<Verdict, "met">, string>> = {
  missing: "The evidence doesn't show the criterion. Run the check that proves it and pipe its output in; the same evidence gives the same answer.",
  unsure: "The evidence is ambiguous. Pipe the full output of the check that proves the criterion, or narrow the criterion.",
};

export function doneEvidence(text: string): string {
  return clip(stripAnsi(text), 2_000, 12_000);
}

const SKIPPED_NEXT = "Some tests were skipped, risky, incomplete or ended in an expected failure (a known issue), so done won't say met. Look at them: if they are expected (a platform-only test), say so yourself; otherwise run the skipped ones.";
const NO_TESTS = /\b(?:no tests? (?:to run|found|were found|executed|ran|collected|matched)|0 tests? (?:run|ran|executed|collected|found|completed)|tests? run: 0(?!\d)|nothing to run)/i;
const INCOMPLETE_NEXT = "The run is cut off, empty, cancelled, flaky or changed files, so done won't say met. Run the full check again and pipe all of its output in.";
const NO_TESTS_NEXT = "The log itself says no tests ran, so done won't say met. Run the tests that were meant to run and pipe their output in.";
const BUILD_ONLY_NEXT = "The log shows only a build or a lint run (no test results), and the criterion is about tests, so done won't say met. Run the tests and pipe their output in.";
const TEST_CRITERION = /\b(?:tests?|testing|test suites?|specs?)\b/i;
const SKIP_WORDS = /^OK, but .*\b(?:incomplete|skipped|risky)\b/i;

function hasSkips(parsed: ParsedEvidence, evidence: string): boolean {
  return parsed.runners.some((r) => r.skipped > 0 || (r.expected_failures ?? 0) > 0 || (r.summary_line !== null && SKIP_WORDS.test(r.summary_line))) || skipMarkers(evidence).length > 0;
}

function onlyBuilds(parsed: ParsedEvidence): boolean {
  return parsed.runners.length > 0 && parsed.runners.every((r) => r.build_only === true);
}

function hasIncomplete(parsed: ParsedEvidence): boolean {
  return parsed.runners.some((r) => r.incomplete === true);
}

function hasParsedWarnings(parsed: ParsedEvidence): boolean {
  return parsed.runners.some((r) => (r.warnings ?? 0) > 0);
}

const UNPARSED_NEXT = 'No recognised runner summary or exit code in the evidence, so it cannot count as met. Pipe the runner\'s full output, or add an exit code line: { your-command; echo "exit code: $?"; } 2>&1 | claude-referee done --criteria "..."';

const CLEAN_CRITERION = new RegExp(String.raw`\b(?:lint\w*|clean|warning[- ]?free|no warnings?|${LINTERS.join("|")})\b`, "i");
const WARN_WORDS = /\b(?:warnings?|notices?|deprecat\w*)\b/i;
const WARN_NEGATED = /\b(?:0|no|zero|without) (?:warnings?|notices?)\b/gi;
const WARN_FLAG = /--?[\w-]*warn[\w-]*(?:[ =]\S+)?/gi;
const PROBLEM_WORDS = /\b(?:fail\w*|skipp\w*|partial\w*|errors?|violations?|findings?)\b/i;
const PROBLEM_NEGATED = /\b(?:0|no|zero|without) (?:errors?|findings?|violations?|failures?)\b/gi;
const SWALLOWED = /\|\|\s*true\b|--no-fail\b|--exit-zero\b/i;
const WARNING_NEXT = "The log shows a warning, notice, failure or skip wording, or a swallowed exit code, and only an exit code backs the lint criterion, so done won't say met. Pipe the linter's full summary, or say yourself that the warning is acceptable.";
const DIAGNOSTIC_NEXT = "The log has a linter's warning or error line, or a linter summary with a count above 0, and no linter's summary was recognised, so done won't say met. Run the linter as its own done call and pipe its full output, or say yourself that the warning is acceptable.";

const KIND_LABEL: Readonly<Record<string, [string, string]>> = { lint: ["lint", "the lint check"], build: ["build", "the build"], typecheck: ["type check", "the type check"] };

function notCoveredNext(runners: readonly string[], notCovered: readonly { i: number; uncovered: readonly string[] }[], many: boolean): string {
  const kinds = [...new Set(notCovered.flatMap((c) => c.uncovered))].map((k) => KIND_LABEL[k] ?? [k, `the ${k} check`]);
  const which = !many ? "the criterion" : `${notCovered.length > 1 ? "criteria" : "criterion"} ${notCovered.map((c) => c.i).join(", ")}`;
  const one = kinds.length === 1;
  return `Only ${runners.join(", ")} output was recognised, and only that reaches Jev, so Jev saw no ${kinds.map(([name]) => name).join(" or ")} output for ${which}. Run ${kinds.map(([, check]) => check).join(" and ")} on ${one ? "its" : "their"} own and pipe ${one ? "its" : "each one's"} output in: { your-command; echo "exit code: $?"; } 2>&1 | claude-referee done --criteria "..."`;
}

export function hasWarningMessage(evidence: string): boolean {
  return WARN_WORDS.test(evidence.replace(WARN_FLAG, " ").replace(WARN_NEGATED, " "));
}

export function hasProblemMessage(evidence: string): boolean {
  const log = evidence.replace(/(?:^|\n)[ \t]*\$[^\n]*/g, " ").replace(PROBLEM_NEGATED, " ");
  return PROBLEM_WORDS.test(log) || SWALLOWED.test(evidence);
}

const DIAG_AT = String.raw`^[ \t]*(?=[^\s:]*[./])[^\s:]+:\d+:\d+:[ \t]+`;
const SEVERITY_DIAGNOSTIC = new RegExp(`${DIAG_AT}(?:warning|error)\\b`);
const CODE_DIAGNOSTIC = new RegExp(`${DIAG_AT}[A-Z]{1,3}\\d{3}\\b`);
const FILE_HEADER = /^\S.*\.\w+$/;
const STYLISH_ROW = /^[ \t]+\d+:\d+[ \t]+(?:warning|error)[ \t]+\S/;
const PROBLEMS_SUMMARY = /^[ \t]*(?:[✖⚠][ \t]+)?(\d+) problems?(?: \([^)]*\))?[ \t]*$/;
const FOUND_SUMMARY = /^[ \t]*Found (\d+) (?:warnings?|errors?)(?: and (\d+) (?:warnings?|errors?))?\b/;
const COUNT_SUMMARY = /^[ \t]*(\d+) (?:warnings?|errors?)(?: and (\d+) (?:warnings?|errors?))?(?: found)?\.?[ \t]*$/;

export function hasLinterDiagnostic(evidence: string): boolean {
  let underFile = false;
  for (const line of evidence.split(/\r?\n/)) {
    if (SEVERITY_DIAGNOSTIC.test(line) || CODE_DIAGNOSTIC.test(line) || (underFile && STYLISH_ROW.test(line))) return true;
    const summary = PROBLEMS_SUMMARY.exec(line) ?? FOUND_SUMMARY.exec(line) ?? COUNT_SUMMARY.exec(line);
    if (summary?.slice(1).some((n) => Number(n) > 0)) return true;
    underFile = FILE_HEADER.test(line);
  }
  return false;
}

function factsOf(parsed: ParsedEvidence): Record<string, unknown> {
  return { trust: parsed.trust, exit_code: parsed.exit_code, exit_lines: parsed.exit_lines, runners: parsed.runners.map(({ build_only: _buildOnly, ...r }) => r), conflict: parsed.conflict, lines: parsed.lines };
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
    const runnerNames = [...new Set(parsed.runners.map((r) => r.runner))];
    const lintCovered = runnerNames.some((r) => RUNNER_KINDS[r]?.includes("lint") === true);
    const wordingCap = (parsed.trust === "exit_code" && (hasWarningMessage(evidence) || hasProblemMessage(evidence))) || hasParsedWarnings(parsed);
    const diagnosticCap = !wordingCap && parsed.trust === "parsed" && !lintCovered && hasLinterDiagnostic(evidence);
    const warnCap = wordingCap || diagnosticCap;
    const per = criteria.map((criterion, i) => {
      const answer = outcome?.answers?.[`c${i + 1}`];
      const p = answer?.type === "noul" ? answer.noul : 0;
      const raw: Verdict = p >= met ? "met" : p < missing ? "missing" : "unsure";
      const skipCap = raw === "met" && hasSkips(parsed, evidence);
      const logSaysNoTests = NO_TESTS.test(evidence);
      const buildCap = raw === "met" && !logSaysNoTests && onlyBuilds(parsed) && TEST_CRITERION.test(criterion);
      const noTestsCap = raw === "met" && (logSaysNoTests || buildCap);
      const incompleteCap = raw === "met" && hasIncomplete(parsed);
      const warningCap = raw === "met" && warnCap && CLEAN_CRITERION.test(criterion);
      const verdict: Verdict = raw === "met" && (parsed.trust === "unparsed" || parsed.conflict || skipCap || noTestsCap || incompleteCap || warningCap) ? "unsure" : raw;
      const uncovered = verdict !== "met" && parsed.trust === "parsed" ? uncoveredKinds(criterion, runnerNames) : [];
      return { i: i + 1, verdict, p, skipCap, noTestsCap, buildCap, incompleteCap, warningCap, uncovered };
    });
    const settled = per.every((c) => c.verdict !== "missing") && parsed.trust !== "unparsed" && !parsed.conflict;
    const noTestsCapped = settled && per.some((c) => c.noTestsCap);
    const skipCapped = settled && !noTestsCapped && per.some((c) => c.skipCap);
    const incompleteCapped = settled && !noTestsCapped && !skipCapped && per.some((c) => c.incompleteCap);
    const warningCapped = settled && !noTestsCapped && !skipCapped && !incompleteCapped && per.some((c) => c.warningCap);
    const verdict: Verdict = per.some((c) => c.verdict === "missing") ? "missing" : per.some((c) => c.verdict === "unsure") ? "unsure" : "met";
    const capReason = noTestsCapped && verdict === "unsure" ? "no_tests_run" : skipCapped && verdict === "unsure" ? "skipped_tests" : incompleteCapped && verdict === "unsure" ? "incomplete_run" : warningCapped && verdict === "unsure" ? "warning_in_log" : undefined;
    const notCovered = per.filter((c) => c.uncovered.length > 0);
    const reason = capReason ?? (notCovered.length > 0 ? "criterion_not_covered" : undefined);
    return {
      ok: true,
      verdict,
      p: Math.min(...per.map((c) => c.p)),
      trust: parsed.trust,
      ...(parsed.exit_code !== null ? { exit_code: parsed.exit_code } : {}),
      ...(parsed.runners.length > 0 ? { runners: parsed.runners.map((r) => ({ runner: r.runner, passed: r.passed, failed: r.failed, errors: r.errors, skipped: r.skipped })) } : {}),
      ...(reason !== undefined ? { reason } : {}),
      ...(per.length > 1 ? { criteria: per.map(({ i, verdict: v, p: pp, uncovered }) => ({ i, verdict: v, p: pp, ...(uncovered.length > 0 ? { reason: "criterion_not_covered" } : {}) })) } : {}),
      next_step: verdict === "met" ? undefined : noTestsCapped && verdict === "unsure" ? (per.some((c) => c.noTestsCap && !c.buildCap) ? NO_TESTS_NEXT : BUILD_ONLY_NEXT) : skipCapped && verdict === "unsure" ? SKIPPED_NEXT : incompleteCapped && verdict === "unsure" ? INCOMPLETE_NEXT : warningCapped && verdict === "unsure" ? (diagnosticCap ? DIAGNOSTIC_NEXT : WARNING_NEXT) : notCovered.length > 0 ? notCoveredNext(runnerNames, notCovered, per.length > 1) : parsed.trust === "unparsed" && per.every((c) => c.verdict !== "missing") ? UNPARSED_NEXT : NEXT[verdict],
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
      exit_code: "The exit code read from the evidence, when it has one",
      runners: "Parsed counts per recognised runner",
      reason: "exit_code_nonzero when the evidence has a non-zero exit code (missing, Jev not asked, requests 0; the receipt is still written, and --dry-run gives the same verdict); skipped_tests, no_tests_run, incomplete_run or warning_in_log when met was capped at unsure because tests were skipped, risky, incomplete or ended in an expected failure (a known issue), the log says no tests ran or shows only a build (or an oxlint run) for a test criterion, the parsed run is cut off, empty, cancelled, flaky or changed files, or a lint or clean criterion (one that says lint, clean or no warnings, or names a linter such as oxlint, eslint, ruff or phpstan) has a warning behind it (a parsed linter's warnings; warning or problem wording, or a swallowed exit code, in a log with only an exit code; or, when a test or build runner is parsed and no linter is, a linter's warning or error line, such as file:line:col: warning, or a linter summary with a count above 0); criterion_not_covered when the verdict is not met, no cap applies, and a lint, build or typecheck criterion has no parsed runner of that kind (only a test runner's summary was recognised, for example), so that check's output never reached Jev; it never changes the verdict",
      p: "Lowest probability that a criterion holds",
      criteria: "Per criterion, by position, when more than one; reason criterion_not_covered on a criterion that is not met and has no parsed runner of its kind",
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
    if (planned.length === 0 && context.flags.dryRun) return reorder({ ...finish([]), dry_run: true, requests: 0 });
    const result = await jevCommand(context, "done", pack, planned, finish);
    const receipt = result["receipt"];
    if (planned.length > 0 && keepsEvidence(context.io.env) && typeof receipt === "string") {
      storeEvidence(resolveDataDir(context.io.env, context.io.home, context.io.cwd, context.flags.dataDir), receipt, { criteria, evidence, home: context.io.home, extra: pack.redact, now: context.io.now() });
    }
    return result;
  },
};
