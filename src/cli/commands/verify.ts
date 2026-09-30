// verify: checks claims against a source text. The source is the state; each claim is a Noul in the same request,
// split into more requests only when the claims don't fit one.

import type { Questions } from "@typesafe-ai/sdk";
import { REQUEST_TOKEN_LIMIT, STATE_TOKEN_LIMIT, estimateTokens } from "../../engine/config.ts";
import { RefereeError } from "../../engine/errors.ts";
import { threshold } from "../../engine/pack.ts";
import type { Planned } from "../../engine/session.ts";
import type { Command } from "../types.ts";
import { JEV_COST, JEV_EFFECTS, JEV_ERRORS, jevCommand, list, openPack, question, readSource, str, stripAnsi, withData } from "../shared.ts";
import { parseItems } from "./judge.ts";

const MAX_CLAIMS = 100;

export const verify: Command = {
  name: "verify",
  describe: {
    summary: "Check claims against a source text.",
    inputs: {
      "--source <file|->": "The text the claims must be supported by. '-' reads stdin.",
      "--claim <text>": "A claim; repeat for several.",
      "--claims <file>": "Claims as a JSON array of strings or {id, text}, JSON lines, or plain lines. Max 100.",
    },
    outputs: {
      verdict: "supported when every claim is, unsupported when any is, unsure otherwise (including claims with no answer)",
      claims: "Number of claims checked",
      supported: "Number of supported claims",
      unsupported: "Ids of unsupported claims",
      unsure: "Ids of claims between the bands",
      unanswered: "Ids of claims with no answer because of an API error or the 90-second deadline",
      p: "Probability of support for each unsupported or unsure claim, by id",
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} verify asks all claims about one source in one request when they fit.`,
  },
  options: { source: { type: "string" }, claim: { type: "string", multiple: true }, claims: { type: "string" } },
  async run(context) {
    const claimsFile = str(context, "claims");
    const inline = list(context, "claim");
    if (claimsFile && inline.length) throw new RefereeError("bad_input", "Use --claim or --claims, not both.");
    if (claimsFile === "-" && (str(context, "source") ?? "-") === "-") throw new RefereeError("bad_input", "Only one of --source and --claims can read stdin.");
    const claims = (claimsFile ? parseItems(await readSource(context, claimsFile, "claims")) : inline.map((text, i) => ({ id: String(i + 1), text }))).filter((c) =>
      c.text.trim(),
    );
    if (claims.length === 0) throw new RefereeError("bad_input", "Give at least one --claim or a --claims file.");
    if (claims.length > MAX_CLAIMS) throw new RefereeError("too_large", `At most ${MAX_CLAIMS} claims per call.`);
    const source = stripAnsi(await readSource(context, str(context, "source"), "source"));
    const { pack, project } = openPack(context);
    const base = question(pack, "verify.supported");
    const state = { source };
    const stateTokens = estimateTokens(JSON.stringify(state));
    if (stateTokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", "The source is too large for one Jev request.", { next_step: "Pass the relevant section of the source." });

    const planned: Planned[] = [];
    let batch: Questions = {};
    let batchTokens = stateTokens;
    const flush = () => {
      if (Object.keys(batch).length) planned.push({ id: `part${planned.length + 1}`, state, questions: batch });
      batch = {};
      batchTokens = stateTokens;
    };
    for (const claim of claims) {
      const q = { ...base, instructions: withData(base.instructions, { claim: claim.text }) } as Questions[string];
      const tokens = estimateTokens(JSON.stringify(q));
      if (stateTokens + tokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", `Claim ${claim.id} is too long.`);
      if (batchTokens + tokens > REQUEST_TOKEN_LIMIT) flush();
      batch[`claim:${claim.id}`] = q;
      batchTokens += tokens;
    }
    flush();
    const supportedAt = threshold(pack, project?.thresholds, "verify.supported", "supported", 0.9);
    const unsupportedAt = threshold(pack, project?.thresholds, "verify.supported", "unsupported", 0.1);

    return jevCommand(context, "verify", pack, planned, (outcomes) => {
      const answers = Object.assign({}, ...outcomes.map((o) => o.answers ?? {})) as Record<string, { type: string; noul?: number }>;
      let supported = 0;
      const unsupported: string[] = [];
      const unsure: string[] = [];
      const unanswered: string[] = [];
      const listed: Record<string, number> = {};
      for (const claim of claims) {
        const answer = answers[`claim:${claim.id}`];
        if (!answer) {
          unanswered.push(claim.id);
          continue;
        }
        const p = answer.type === "noul" && typeof answer.noul === "number" ? answer.noul : 0.5;
        if (p >= supportedAt) {
          supported += 1;
          continue;
        }
        (p <= unsupportedAt ? unsupported : unsure).push(claim.id);
        listed[claim.id] = p;
      }
      const verdict = unsupported.length ? "unsupported" : unsure.length || unanswered.length ? "unsure" : "supported";
      return {
        ok: true,
        verdict,
        claims: claims.length,
        supported,
        ...(unsupported.length ? { unsupported } : {}),
        ...(unsure.length ? { unsure } : {}),
        ...(unanswered.length ? { unanswered } : {}),
        ...(Object.keys(listed).length ? { p: listed } : {}),
        next_step: verdict === "supported" ? undefined : "Fix or drop the listed claims, or cite the part of the source that supports them.",
      };
    }, { partial: true });
  },
};
