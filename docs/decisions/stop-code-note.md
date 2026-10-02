# Code-only Stop note: pre-registration

Registered 2026-10-02, before the code-only detector was replayed on any session. What was already known when this was written: the Jev gate's recorded results from the [base-rate](session-base-rate.md) and [hard-task](session-hard-tasks.md) studies (99 of 99 asked true dones blocked in the first; 51 of 53 true dones blocked, 14 of 15 wrong dones, AUC 0.398 in the second). Not known: any number of the detector below on those sessions.

**Why this exists.** Jev reads the same facts the code already has, so on both studies it added nothing over "edits, no counted passing check, a success claim". The cheaper alternative is that rule in code, with no model call.

**Honest prior, stated before the run.** The gate's own skip rule is "no edits, or a counted passing check after the last edit". The asked set of the studies is therefore exactly the set where the detector's two code conditions hold, and Jev blocked nearly all of it. The detector is expected to match Jev's false-block rate and recall almost exactly; the replay can only show how far apart they are, and that the keyword claim rule does not cost recall. It is not expected to be a correctness detector, and nothing here will be described as one.

## Detector

Fires on a stop when all three hold, evaluated with the code that ships (`analyzeTranscript`, `stopSkipReason`) and the claim rule of `scripts/session-study/lib.mjs` (`classifyClaim`, reused unchanged, no new rule):

1. the turn has edits,
2. no counted passing check ran after the last edit,
3. the final message is a `claim` by the keyword rule (success word, no negation word, no trailing question mark).

Two readings of a message with both success and negation words (`ambiguous`), both reported, the first is the primary one because it is the only one a hook can apply without a human: **A**, ambiguous is no claim (the detector does not fire); **B**, ambiguous is a claim. The study's hand labels (`claim_resolved`) are used only for the session classes (wrong done, true done), as in both earlier studies.

## Data and metrics

Sessions of the two studies, usable ones only (not leaked, run_failed, error, unresolved), with the hidden-verifier classes. Reported for the detector, for the recorded Jev gate (`would_block`) and for the combination "detector fires and `would_block`", each with exact Clopper-Pearson 95% intervals (`src/engine/stopgate/interval.ts`): precision for wrong done, recall over all wrong dones, false-block rate over true dones that the gate asked about (the registered H3 view) and over all true dones. Latency and cost of the detector are zero by construction (no request). A consistency check compares the replayed edit and check counts with the recorded stop records. Every number is reported whichever way it falls.

## Adoption rule

An opt-in `hooks.stopGate: "note"` mode is implemented only if all of these hold, on the two studies pooled, reading A:

- **R1, recall.** The detector's recall over all wrong dones is at least the Jev gate's recall on the same sessions minus 0.05 (point estimates).
- **R2, false blocks.** The detector's false-block rate over all true dones is at most the Jev gate's plus 0.05 (point estimates).
- **R3, claim rule.** Among sessions the hand labels call a claim and the verifier calls wrong, reading A misses at most 1 that reading B catches.

If R1 to R3 hold, the mode is built as opt-in, the default stays `off`, `shadow` and `soft` are unchanged, and the documentation says that it detects a claim without a counted check and cannot tell a correct claim from a wrong one: on the study data most correct claims are flagged too. If any fails, nothing is built and the numbers go to the ROADMAP as a negative result. Neither outcome changes the Jev gate, its thresholds or the pack.

Not part of the rule and not claimed: that the note helps users. That needs a study of what users do with a note, which this is not.

## Limits stated before the run

Synthetic tasks written by us; a model family that is also the labeller; the detector shares code with the gate so agreement is partly by construction; repeated sessions of one task are not independent and the intervals ignore that; the analyzer in the repository has changed slightly since the sessions ran (a denied command is now `denied`), so counts are checked against the recorded stops.

## Result

Added after the run.
