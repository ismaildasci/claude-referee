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

Added after the replay (`node scripts/session-study/replay-note.mjs <study> <study-hard>`, no Claude or Jev call, tested in `test/session-study-replay-note.test.ts`); the registration above is unchanged and was committed before the replay ran. 193 usable sessions: 119 of the base-rate study (118 true done, 1 wrong done) and 74 of the hard-task study (54 true done, 15 wrong done, 5 quiet pass). Consistency check: the replayed edit and check counts equal the recorded stop records in all 193 sessions, and "asked by the gate" equals "the two code conditions hold" in all 193.

Intervals are exact Clopper-Pearson 95%. Latency and cost of the detector: zero (no request); the Jev gate's recorded latency and spend are in the two studies.

| | Jev `would_block` | code, reading A (primary) | code, reading B | code A and Jev |
|---|---|---|---|---|
| fires, pooled | 167 | 115 | 167 | 115 |
| recall of wrong done, pooled | 15/16 = 0.938 (0.698 to 0.998) | 11/16 = 0.688 (0.413 to 0.890) | 15/16 = 0.938 | 11/16 |
| precision for wrong done, pooled | 15/167 = 0.090 (0.051 to 0.144) | 11/115 = 0.096 (0.049 to 0.165) | 15/167 = 0.090 | 11/115 |
| false blocks, all true dones, pooled | 150/172 = 0.872 (0.813 to 0.918) | 104/172 = 0.605 (0.527 to 0.678) | 152/172 = 0.884 (0.826 to 0.928) | 104/172 |
| false blocks, asked true dones, pooled | 150/152 = 0.987 (0.953 to 0.998) | 104/152 = 0.684 (0.604 to 0.757) | 152/152 = 1 (0.976 to 1) | 104/152 |

By study. Base-rate: Jev recall 1/1, precision 1/100, false blocks 99/99 asked (0.963 to 1), 99/118 of all; A recall 1/1, precision 1/83 (0 to 0.065), false blocks 82/99 asked (0.739 to 0.897), 82/118 of all (0.603 to 0.776). Hard-task: Jev recall 14/15 (0.681 to 0.998), precision 14/67 (0.119 to 0.326), false blocks 51/53 asked (0.870 to 0.995), 51/54 of all (0.846 to 0.988); A recall 10/15 = 0.667 (0.384 to 0.882), precision 10/32 = 0.313 (0.161 to 0.500), false blocks 22/53 asked (0.281 to 0.559), 22/54 of all (0.276 to 0.550). Reading B fires on the same 67 hard-task sessions as Jev: false blocks 53/53 asked.

The combination "code A fires and Jev would_block" equals code A in every session: Jev blocked every session the detector fires on, so it removes nothing. Jev blocked 52 pooled sessions that reading A does not fire on; 50 of them are messages that mix a success word with a negation word (for example "implemented, but I could not run X"), the other 2 are quiet passes with no success word.

**Rule.** R1 fails: recall 0.688 against 0.938 minus 0.05 = 0.888. R2 holds: false-block rate over all true dones 0.605 against 0.872 plus 0.05. R3 fails: reading B catches 4 wrong dones that A misses (h-n-config r1, h-n-pagination r2, h-p-invoice r1, h-p-pipeline r2), the limit was 1. All four are messages that claim the work is implemented and also disclose something unverified, which is the shape of a hedged wrong done.

**Decision.** Nothing is built: no `note` mode, no change to the hooks, the default or the pack, no Jev request spared. The registered prior was half wrong: the detector does match Jev on the sessions it fires on, but the strict keyword rule drops the hedged claims, and those are where the wrong dones are.

**Exploratory, read after the numbers and not a rule.** Reading B would pass R1 to R3 (recall 0.938, false blocks over all true dones 0.884 against 0.872 plus 0.05). It is the same set as the gate's asked set plus a message that has a success word, so it flags every correct claim without a counted check (152 of 152 asked) and its precision for wrong done is 0.09: a reminder that edits were made without a passing counted check, not evidence about correctness. Whether such a reminder is worth shipping as an opt-in mode is a product choice for a new registration, not something these numbers decide; it is recorded in the pending ROADMAP line.

**Limits.** As registered, plus: the hard-task study was built to have wrong dones, so its precision is not a rate on real work; 16 wrong dones in total, intervals wide; sessions of one task are not independent; the recorded Jev answers come from one model version.
