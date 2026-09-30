// done: does the check output show each criterion holds? One request; every criterion is a Noul on the same evidence.
// Verdicts are met, unsure or missing; a "not done" answer is still exit 0.

import type { Questions } from "@typesafe-ai/sdk";
import { RefereeError } from "../../engine/errors.ts";
import { threshold } from "../../engine/pack.ts";
import type { Command } from "../types.ts";
import { JEV_COST, JEV_EFFECTS, JEV_ERRORS, clip, jevCommand, list, openPack, question, readSource, str, stripAnsi, withData } from "../shared.ts";

type Verdict = "met" | "unsure" | "missing";

const NEXT: Readonly<Record<Exclude<Verdict, "met">, string>> = {
  missing: "The evidence doesn't show the criterion. Run the check that proves it and pipe its output in; the same evidence gives the same answer.",
  unsure: "The evidence is ambiguous. Pipe the full output of the check that proves the criterion, or narrow the criterion.",
};

export const done: Command = {
  name: "done",
  describe: {
    summary: "Check whether piped test or lint output shows that each criterion holds.",
    inputs: {
      "--criteria <text>": "What must hold, e.g. \"all tests pass\". Repeat for several; max 10.",
      "--evidence <file|->": "The check output. '-' or omitted reads stdin. ANSI colours are stripped; long output keeps its first 2,000 and last 12,000 characters.",
    },
    outputs: {
      verdict: "met, unsure or missing; the lowest across criteria",
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
    const evidence = clip(stripAnsi(await readSource(context, str(context, "evidence"), "evidence")), 2_000, 12_000);
    if (!evidence.trim()) throw new RefereeError("bad_input", "The evidence is empty.");
    const { pack, project } = openPack(context);
    const base = question(pack, "done.met");
    const questions: Questions = Object.fromEntries(criteria.map((criterion, i) => [`c${i + 1}`, { ...base, instructions: withData(base.instructions, { criterion }) }]));
    const met = threshold(pack, project?.thresholds, "done.met", "met", 0.7);
    const missing = threshold(pack, project?.thresholds, "done.met", "missing", 0.5);

    return jevCommand(context, "done", pack, [{ id: "done", state: { evidence }, questions }], ([outcome]) => {
      const per = criteria.map((_, i) => {
        const answer = outcome?.answers?.[`c${i + 1}`];
        const p = answer?.type === "noul" ? answer.noul : 0;
        const verdict: Verdict = p >= met ? "met" : p < missing ? "missing" : "unsure";
        return { i: i + 1, verdict, p };
      });
      const verdict: Verdict = per.some((c) => c.verdict === "missing") ? "missing" : per.some((c) => c.verdict === "unsure") ? "unsure" : "met";
      return {
        ok: true,
        verdict,
        p: Math.min(...per.map((c) => c.p)),
        ...(per.length > 1 ? { criteria: per } : {}),
        next_step: verdict === "met" ? undefined : NEXT[verdict],
      };
    });
  },
};
