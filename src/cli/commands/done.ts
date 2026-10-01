// done: does the check output show each criterion holds? One request; every criterion is a Noul on the same evidence.
// Recognised runner output is parsed in code and only those facts reach Jev; unrecognised output can never become met.
// A non-zero exit code in the evidence is missing without a request.

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

const UNPARSED_NEXT = 'No recognised runner summary or exit code in the evidence, so it cannot count as met. Pipe the runner\'s full output, or add an exit code line: { your-command; echo "exit code: $?"; } 2>&1 | claude-referee done --criteria "..."';

function factsOf(parsed: ParsedEvidence): Record<string, unknown> {
  return { trust: parsed.trust, exit_code: parsed.exit_code, exit_lines: parsed.exit_lines, runners: parsed.runners, conflict: parsed.conflict, lines: parsed.lines };
}

export function doneRequest(pack: Pack, thresholds: Thresholds | undefined, criteria: readonly string[], evidence: string): { planned: Planned[]; finish: (outcomes: Outcome[]) => Result } {
  const parsed = parseEvidence(evidence);
  const base = question(pack, "done.met");
  const questions: Questions = Object.fromEntries(criteria.map((criterion, i) => [`c${i + 1}`, { ...base, instructions: withData(base.instructions, { criterion }) }]));
  const met = threshold(pack, thresholds, "done.met", "met", 0.7);
  const missing = threshold(pack, thresholds, "done.met", "missing", 0.5);
  const finish = ([outcome]: Outcome[]): Result => {
    const per = criteria.map((_, i) => {
      const answer = outcome?.answers?.[`c${i + 1}`];
      const p = answer?.type === "noul" ? answer.noul : 0;
      const raw: Verdict = p >= met ? "met" : p < missing ? "missing" : "unsure";
      const verdict: Verdict = raw === "met" && (parsed.trust === "unparsed" || parsed.conflict) ? "unsure" : raw;
      return { i: i + 1, verdict, p };
    });
    const verdict: Verdict = per.some((c) => c.verdict === "missing") ? "missing" : per.some((c) => c.verdict === "unsure") ? "unsure" : "met";
    return {
      ok: true,
      verdict,
      p: Math.min(...per.map((c) => c.p)),
      trust: parsed.trust,
      ...(parsed.exit_code !== null ? { exit_code: parsed.exit_code } : {}),
      ...(parsed.runners.length > 0 ? { runners: parsed.runners.map((r) => ({ runner: r.runner, passed: r.passed, failed: r.failed, errors: r.errors, skipped: r.skipped })) } : {}),
      ...(per.length > 1 ? { criteria: per } : {}),
      next_step: verdict === "met" ? undefined : parsed.trust === "unparsed" && per.every((c) => c.verdict !== "missing") ? UNPARSED_NEXT : NEXT[verdict],
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
      reason: "exit_code_nonzero when the evidence has a non-zero exit code: missing, and Jev was not asked",
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
    const exit = parseEvidence(evidence);
    if (exit.exit_code !== null && exit.exit_code !== 0 && !context.flags.dryRun) {
      return {
        ok: true,
        verdict: "missing",
        reason: "exit_code_nonzero",
        trust: exit.trust,
        exit_code: exit.exit_code,
        p: 0,
        requests: 0,
        cached: 0,
        next_step: `The check exited with code ${exit.exit_code}, so nothing can be met and Jev was not asked. Fix the failure and run the check again.`,
      };
    }
    const { pack, project } = openPack(context);
    const { planned, finish } = doneRequest(pack, project?.thresholds, criteria, evidence);
    return jevCommand(context, "done", pack, planned, finish);
  },
};
