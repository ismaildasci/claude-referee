# decide: a balanced set of orders when two orders tie (registration)

Written and committed before the replay below was run and before any code for it. Chosen in [next-work-2026-10-06.md](next-work-2026-10-06.md); the evidence it rests on is the order study ([decide-order-scale.md](decide-order-scale.md), [measurements](../measurements-decide-order-scale.md)).

## The change

`decide` asks the best-option question in the written and the reversed order (`wr`). New: when that two-order result is a `tie` (the two orders pick different leaders, or the top two mean probabilities are less than the pack's `margin` apart, 0.1 by default) and there are 3 to 6 options in one request, `decide` also asks the other 2n - 2 orders of the study's balanced design `latin_rev`: the n rotations of the written order and the reverse of each (the written and reversed orders are two of them). Lean and verdict then come from the mean over all 2n orders with the mean-only rule: `tie` when the top two are less than `margin` apart, `clear` when the leader also reaches `clear` (0.85), otherwise `weak`; a disagreement between orders no longer forces `tie` on this path. Two options, the per-option mode and the eval ablations keep two orders. The output says how many orders were asked.

Why this trigger: it adds no parameter, it fires exactly where `decide` answers `tie` today, and the study's near-tie definition (a margin under 0.08 in a 24-order reference) cannot be computed in a live call. The study measured `latin_rev` on all decisions, not behind this trigger, so the combination is what gate 1 checks.

Cost: 2n - 2 more requests (4 to 10) on a triggered decision only.

## Gate 1: replay on the study's recorded answers (offline, free)

Data: the answers already recorded for the study (`jev-evals/decide-scale/recorded-main.jsonl`, `recorded-wave2.jsonl`, `recorded-rep.jsonl`; sets close, holdout, a, b, c and d), the same decision filter, references (leave-out, full set, replicate) and near-tie definition (reference margin under 0.08) as `scripts/decide-scale/analyze.mjs`. The policy `adaptive` is simulated per decision from the recorded written and reversed answers; where it triggers, its orders are `latin_rev`, otherwise `wr`.

Pass, on the pooled decisions with 4 or more options (the study's rule set), under each of the three references:

1. near-tie leader agreement of `adaptive` at least that of `wr` plus 0.15;
2. leader agreement over all decisions at least that of `wr` minus 0.01;
3. false clear (adaptive says `clear`, the reference does not) at most 0.05;
4. verdict agreement at least that of `wr` (unanimous rule) minus 0.02.

Reported, not part of the pass: the same for 3 options, bootstrap intervals, the trigger rate and the mean number of requests per decision. This replays the data the design was chosen from, so it checks that the rule works as implemented and loses nothing elsewhere; it is not an unseen test.

## Gate 2: the shipped command reproduces the harness (live, at most 100 requests)

The first 8 decisions with 4 or more options, in the study's case order, on which `adaptive` triggers in the replay: run the built `decide --fresh` on each, options in the study's written order. Pass: averaged over the 8, the mean absolute difference between the live mean probabilities and the recorded mean over the same orders is at most 0.02 (one order moved 0.010 on average between two runs of the study). Reported: how many of the 8 triggered live and how many kept the replay's leader.

## Gate 3: the labelled decide suite (reported, no bar)

`jev-evals/decide-best`: record only the extra orders for the cases that trigger (the recorded two-order answers stay), then report leader agreement with the author's labels and the verdicts before and after. The labels are one author's judgement, so this is a check that nothing broke, not a pass or fail.

## If a gate fails

Gate 1 is run before the code is written; if it fails, nothing is built and the result is added here. If gate 2 fails, the change is reverted and the result is added here. Either way the measurement is reported.
