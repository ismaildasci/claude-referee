// The Stop done-gate's pure rules, shared by the hook and the recorded-session evals: the code-side skip rule, the request it sends and the decision on Jev's answers.
// No I/O and no project or store access, so the eval command can use it without pulling in the hook.

import type { Questions } from "@typesafe-ai/sdk";
import { threshold, thresholdBelow, type Pack } from "../pack.ts";
import type { StopDecision, StopFacts, StopSkip } from "./types.ts";

function question(pack: Pack, id: string): Questions[string] {
  const q = pack.questions[id];
  if (!q) throw new Error(`pack has no question ${id}`);
  return q as unknown as Questions[string];
}

export function decideStop(answers: Readonly<Record<string, unknown>> | null, pack: Pack, thresholds: Parameters<typeof threshold>[1]): StopDecision | null {
  if (!answers) return null;
  const noul = (id: string): number | null => {
    const a = answers[id] as { type?: string; noul?: number } | undefined;
    return a?.type === "noul" && typeof a.noul === "number" ? a.noul : null;
  };
  const claimsDone = noul("claims_done");
  const claimsVerified = noul("claims_verified");
  const applies = noul("verification_applies");
  const outcome = answers["outcome"] as { type?: string; probabilities?: Record<string, number> } | undefined;
  if (claimsDone === null || claimsVerified === null || applies === null || outcome?.type !== "choice" || !outcome.probabilities) return null;
  const doneAt = threshold(pack, thresholds, "stop.gate", "claims_done", 0.7);
  const verifiedAt = thresholdBelow(pack, thresholds, "stop.gate", "claims_verified", 0.5);
  const appliesAt = threshold(pack, thresholds, "stop.gate", "verification_applies", 0.5);
  const blockedAt = thresholdBelow(pack, thresholds, "stop.gate", "blocked", 0.4);
  const would_block = claimsDone >= doneAt && claimsVerified < verifiedAt && applies >= appliesAt && (outcome.probabilities["blocked"] ?? 0) < blockedAt;
  return { claims_done: claimsDone, claims_verified: claimsVerified, verification_applies: applies, outcome: outcome.probabilities, would_block };
}

// The code-side skips and the request the gate sends, shared with the recorded-session evals (`eval` suites with command "stop").
export function stopSkipReason(facts: StopFacts): StopSkip | null {
  if (facts.edits.length === 0) return "no_edits";
  return facts.passedCheckAfterLastEdit ? "check_passed_after_edit" : null;
}

export function stopQuestions(pack: Pack): Questions {
  return {
    claims_done: question(pack, "stop.claims_done"),
    claims_verified: question(pack, "stop.claims_verified"),
    verification_applies: question(pack, "stop.verification_applies"),
    outcome: question(pack, "stop.outcome"),
  };
}

export function stopState(facts: StopFacts, finalMessage: string) {
  return { task: facts.task, final_message: finalMessage, checks: facts.checks.map((c) => ({ cmd: c.cmd, status: c.status })), edits: [...facts.edits] };
}
