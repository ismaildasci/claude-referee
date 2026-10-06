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

## Results, 2026-10-06

All three gates were run in the registered order: gate 1 before any code, then the code, then gates 2 and 3. The change ships.

- **Gate 1 passed** under all three references (`node scripts/decide-scale/adaptive.mjs`, [results-adaptive.json](../../jev-evals/decide-scale/results-adaptive.json)). The script first reproduced the published `wr` and `latin_rev` numbers (near-tie agreement 0.656 and 0.9375, verdict agreement 0.91, 0.81 and 0.96, 1 false `clear` of 72 for `wr`). `adaptive` on the 211 decisions with 4 or more options: near-tie agreement 0.9375 against 0.656 (criterion 1: +0.28, needed +0.15); agreement over all 0.990 against 0.938 (criterion 2); 1 false `clear` of 72 clear verdicts, 0.014 (criterion 3; the study's definition, the share of `clear` verdicts that the reference does not call `clear`; 1 of 211 decisions as a share of all); verdict agreement 0.953 (leave-out) and 0.957 (full set, replicate) against 0.900 and 0.910 (criterion 4). It fired on 20.9% of those decisions, 3.49 requests per decision on average. Three options (41 decisions): it fired on 1; agreement stayed 1.0 under the full-set and replicate references (with all 6 orders asked, the leave-out reference has none left for that decision). The one false `clear` is the same two-order decision for `wr` and `adaptive` (`a/a44-barn-dance`).
- **Gate 2 passed** (`node scripts/decide-scale/live-check.mjs`, [gate2-live.json](../../jev-evals/decide-scale/gate2-live.json)): over the 8 decisions, the mean absolute difference between the live `decide --fresh` mean and the recorded mean over the same orders was 0.0078 with the CLI's two-decimal rounding applied to both and 0.0084 without it (bar 0.02). 7 of 8 tied live and asked 8 orders; one (`va1-flags-nobudget`) had a margin of 0.1 or more in the fresh two orders and stopped there. 7 of 8 kept the recorded leader; the exception (`ba1-cache-stampede`) is a `tie` in both.
- **Gate 3, reported:** `eval record --suite decide-best` topped up the 14 tied cases with only their 6 missing orders (84 requests; the recorded two-order answers stayed). Agreement with the author labels 16 of 39 before and after; verdicts 0 `clear`, 25 `weak`, 14 `tie` before and 0, 28, 11 after.

