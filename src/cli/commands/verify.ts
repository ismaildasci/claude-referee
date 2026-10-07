// claims (old name verify): checks claims against a source text. Quotes and numbers are matched in code first; what is left gets two
// three-way Choice questions per claim (supports, contradicts, says nothing; both option orders) plus one injection check on the source.
// Both names write receipts as command "claims".

import type { Questions } from "@typesafe-ai/sdk";
import { checkClaim } from "../../engine/claims.ts";
import { REQUEST_TOKEN_LIMIT, STATE_TOKEN_LIMIT, estimateTokens } from "../../engine/config.ts";
import { RefereeError } from "../../engine/errors.ts";
import { threshold, type Pack, type Thresholds } from "../../engine/pack.ts";
import type { Outcome, Planned } from "../../engine/session.ts";
import type { Result } from "../../engine/output.ts";
import type { Command } from "../types.ts";
import { JEV_COST, JEV_EFFECTS, JEV_ERRORS, jevCommand, list, openPack, question, readSource, str, stripAnsi, withData } from "../shared.ts";
import { parseItems } from "./judge.ts";

type Relation = "supports" | "contradicts" | "says_nothing";
const RELATIONS: readonly Relation[] = ["supports", "contradicts", "says_nothing"];

export interface Claim {
  readonly id: string;
  readonly text: string;
}

function probabilities(answer: unknown): Record<string, number> | null {
  const a = answer as { type?: string; probabilities?: Record<string, number> } | undefined;
  return a?.type === "choice" && a.probabilities ? a.probabilities : null;
}

export function verifyRequest(pack: Pack, thresholds: Thresholds | undefined, claims: readonly Claim[], source: string): { planned: Planned[]; finish: (outcomes: Outcome[]) => Result } {
  const relation = question(pack, "verify.relation");
  const injection = question(pack, "verify.injection");
  const baseCriteria = (relation as { criteria?: Record<string, string> }).criteria ?? {};
  const ordered = (reverse: boolean) => Object.fromEntries(reverse ? Object.entries(baseCriteria).reverse() : Object.entries(baseCriteria));
  const state = { source };
  const stateTokens = estimateTokens(JSON.stringify(state));
  if (stateTokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", "The source is too large for one Jev request.", { next_step: "Pass the relevant section of the source." });
  if (new Set(claims.map((c) => c.id)).size !== claims.length) throw new RefereeError("bad_input", "Claim ids must be unique.", { next_step: "Give every claim its own id, or leave the ids out." });
  const checks = new Map(claims.map((c) => [c.id, checkClaim(c.text, source)]));
  const asked = claims.filter((c) => {
    const k = checks.get(c.id);
    return k !== undefined && k.quotes_missing.length === 0 && k.numbers_missing.length === 0;
  });

  const planned: Planned[] = [];
  let batch: Questions = {};
  let batchTokens = stateTokens;
  const flush = () => {
    if (Object.keys(batch).length) planned.push({ id: `part${planned.length + 1}`, state, questions: batch });
    batch = {};
    batchTokens = stateTokens;
  };
  const add = (key: string, q: Questions[string]) => {
    const tokens = estimateTokens(JSON.stringify(q));
    if (stateTokens + tokens > STATE_TOKEN_LIMIT) throw new RefereeError("too_large", `Claim ${key} is too long.`);
    if (batchTokens + tokens > REQUEST_TOKEN_LIMIT) flush();
    batch[key] = q;
    batchTokens += tokens;
  };
  if (asked.length > 0) add("injection", injection as Questions[string]);
  for (const claim of asked) {
    for (const [suffix, reverse] of [["a", false], ["b", true]] as const) {
      add(`claim:${claim.id}:${suffix}`, { ...relation, criteria: ordered(reverse), instructions: withData(relation.instructions, { claim: claim.text }) } as Questions[string]);
    }
  }
  flush();
  const supportsAt = threshold(pack, thresholds, "verify.relation", "supports", 0.8);
  const contradictsAt = threshold(pack, thresholds, "verify.relation", "contradicts", 0.5);
  const silentAt = threshold(pack, thresholds, "verify.relation", "says_nothing", 0.5);
  const flagAt = threshold(pack, thresholds, "verify.injection", "flag", 0.7);

  const finish = (outcomes: Outcome[]): Result => {
    const answers = Object.assign({}, ...outcomes.map((o) => o.answers ?? {})) as Record<string, unknown>;
    const inj = answers["injection"] as { type?: string; noul?: number } | undefined;
    const injected = inj?.type === "noul" && typeof inj.noul === "number" && inj.noul >= flagAt;
    let supported = 0;
    const unsupported: string[] = [];
    const contradicted: string[] = [];
    const saysNothing: string[] = [];
    const unsure: string[] = [];
    const unanswered: string[] = [];
    const reasons = new Map<string, string>();
    const listed = new Map<string, number>();
    for (const claim of claims) {
      const k = checks.get(claim.id);
      if (k && k.quotes_missing.length > 0) {
        const onlyCode = k.quotes_missing.every((q) => claim.text.includes(`\`${q}\``) && !claim.text.includes(`"${q}"`));
        (onlyCode ? unsure : unsupported).push(claim.id);
        reasons.set(claim.id, onlyCode ? "identifier_not_in_source" : "quote_not_in_source");
        continue;
      }
      if (k && k.numbers_missing.length > 0) {
        unsure.push(claim.id);
        reasons.set(claim.id, "number_not_in_source");
        continue;
      }
      const a = probabilities(answers[`claim:${claim.id}:a`]);
      const b = probabilities(answers[`claim:${claim.id}:b`]);
      if (!a || !b) {
        unanswered.push(claim.id);
        continue;
      }
      const mean = Object.fromEntries(RELATIONS.map((r) => [r, ((a[r] ?? 0) + (b[r] ?? 0)) / 2])) as Record<Relation, number>;
      const lead = (p: Record<string, number>) => RELATIONS.reduce((best, r) => ((p[r] ?? 0) > (p[best] ?? 0) ? r : best), "supports" as Relation);
      const agree = lead(a) === lead(b);
      if (agree && mean.supports >= supportsAt) {
        if (injected) {
          unsure.push(claim.id);
          reasons.set(claim.id, "source_has_instruction_for_judge");
          listed.set(claim.id, mean.supports);
        } else supported += 1;
        continue;
      }
      listed.set(claim.id, mean.supports);
      if (agree && mean.contradicts >= contradictsAt) {
        contradicted.push(claim.id);
        unsupported.push(claim.id);
        reasons.set(claim.id, "contradicted");
      } else if (agree && mean.says_nothing >= silentAt) {
        saysNothing.push(claim.id);
        reasons.set(claim.id, "says_nothing");
      } else {
        unsure.push(claim.id);
        reasons.set(claim.id, agree ? "between_bands" : "orders_disagree");
      }
    }
    const notSupported = unsupported.length > 0;
    const verdict = notSupported ? "unsupported" : unsure.length || saysNothing.length || unanswered.length ? "unsure" : "supported";
    const nextByReason: Record<string, string> = {
      contradicted: "The source says otherwise. Fix the claim or drop it.",
      quote_not_in_source: "The quoted text is not in the source. Quote the source exactly, or add the source that has the text.",
      source_has_instruction_for_judge: "The source has a line aimed at the judge. Pass only the section of the source the claims are about.",
      between_bands: "Jev's answer fell between the bands. Split the claim into single facts, or add the passage that states it.",
      says_nothing: "The source is silent on the claim. Add the passage that supports it; don't reword the claim.",
      orders_disagree: "The two option orders disagree. State the claim more narrowly.",
      identifier_not_in_source: "A backticked name is not in the source. Write it exactly as the source does, or add the source that has it.",
      number_not_in_source: "A number is not in the source. Write it exactly as the source does, add the source that has it, or check a computed number with a script.",
      unanswered: "Some claims got no answer (API error or deadline). Run claims again for them.",
    };
    const tally = new Map<string, number>();
    for (const reason of [...reasons.values(), ...unanswered.map(() => "unanswered")]) tally.set(reason, (tally.get(reason) ?? 0) + 1);
    const top = Object.keys(nextByReason).reduce((best, r) => ((tally.get(r) ?? 0) > (tally.get(best) ?? 0) ? r : best));
    const listedCount = reasons.size + unanswered.length;
    const nextStep = verdict === "supported" ? undefined : `${tally.size > 1 ? `${tally.get(top)} of ${listedCount} listed claims: ` : ""}${nextByReason[top]}`;
    return {
      ok: true,
      verdict,
      claims: claims.length,
      supported,
      ...(unsupported.length ? { unsupported } : {}),
      ...(contradicted.length ? { contradicted } : {}),
      ...(saysNothing.length ? { says_nothing: saysNothing } : {}),
      ...(unsure.length ? { unsure } : {}),
      ...(unanswered.length ? { unanswered } : {}),
      ...(injected ? { source_injection: true } : {}),
      ...(reasons.size ? { reasons: Object.fromEntries(reasons) } : {}),
      ...(listed.size ? { p: Object.fromEntries(listed) } : {}),
      next_step: nextStep,
    };
  };
  return { planned, finish };
}

const MAX_CLAIMS = 100;

export const claims: Command = {
  name: "claims",
  describe: {
    summary: "Check claims against a source text.",
    inputs: {
      "--source <file|->": "The text the claims must be supported by. '-' reads stdin.",
      "--claim <text>": "A claim; repeat for several.",
      "--claims <file>": "Claims as a JSON array of strings or {id, text}, JSON lines, or plain lines. Ids must be unique; a claim without one gets its position. Max 100.",
    },
    outputs: {
      verdict: "supported when every claim is, unsupported when any is contradicted or puts text in double quotes that isn't in the source, unsure otherwise (silent, a backticked name or a number not in the source, no answer)",
      claims: "Number of claims checked",
      supported: "Number of supported claims",
      unsupported: "Ids of contradicted claims and claims that quote text not in the source",
      contradicted: "Ids of claims the source contradicts",
      says_nothing: "Ids of claims the source is silent on: add the passage, don't reword",
      reasons: "Why each non-supported claim is listed, by id",
      source_injection: "True when the source has a line aimed at the judge; supported claims then become unsure",
      unsure: "Ids of claims between the bands",
      unanswered: "Ids of claims with no answer because of an API error or the 90-second deadline",
      p: "Probability of support for each unsupported or unsure claim, by id",
    },
    errors: [...JEV_ERRORS],
    effects: JEV_EFFECTS,
    cost: `${JEV_COST} claims asks all claims about one source in one request when they fit, two three-way questions per claim and one injection check; claims with a quote or number missing from the source are decided in code.`,
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
    const { planned, finish } = verifyRequest(pack, project?.thresholds, claims, source);
    return jevCommand(context, "claims", pack, planned, finish, { partial: true });
  },
};

// `verify` is the old name of `claims`; it stays an alias until 1.0 so it isn't confused with Claude Code's /verify.
export const verify: Command = { ...claims, name: "verify", describe: { ...claims.describe, summary: "Alias of claims: check claims against a source text." } };
