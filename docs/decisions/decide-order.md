# Option order on close calls: pre-registration

Status: Pre-registered; results in.

Date: 2026-10-01. Written before any full-run data for this measurement exists. The screening answers that selected the cases do exist; they are described under Deviations.

## Question

1. On decisions whose options are close, how far does the answer move with option order, and do the order policies (written order alone, written plus a re-ask, written plus reversed, four rotations, a single two-question request) differ in how close they get to the average over all orders?
2. K3: can the reversed question be asked inside the same request as the written one, instead of in a separate second request?

## Background

The [public set](../measurements.md#option-order-on-a-public-set) had 20 decisions with 4 options each, asked in all 24 orders. One option's probability moved by 0.026 on average between orders and by 0.13 at most. No decision's leader changed in any order. The written order alone, written plus reversed, four rotations and the single two-question request each matched the all-orders leader in 20 of 20 decisions, so leader agreement could not tell the policies apart.

The reason is that the set was not close. 19 of the 20 decisions had a leader at 0.9 or more over all orders; the lowest leader, 0.89, had the largest spread, 0.13. Where the leader was at 1, the spread was 0. Asking the same request again moved an option's probability by up to 0.04.

On that set the reversed question asked in the same request as the written one matched the separate reversed request within 0.01, and the written question matched its separate request within 0.03. With no close decisions, that does not show whether the match holds when the answer is uncertain. `decide` still asks in two orders. The earlier private kit measured larger movement (0.20 on average, 0.52 at most) on real decisions; this record does not assume which of the two results close calls will resemble.

## Design

**Registered files.** Listed under Registered run below. Everything here is offline except the full run itself.

**Set.** Invented public decisions, 4 options each, option names matching `/^[a-z]+$/` (lowercase letters only; candidate validation enforces it). Target 30 to 40 decisions (cap 40); 39 remain after the removal listed under Deviations. Built as (a) 18 paired variants of decisions in `jev-evals/decide/cases.jsonl`, and (b) 21 new balanced trade-offs. The paired variants are rewrites that remove, neutralise or replace one fact and also add context. They are not one-fact ablations, and `derived_from` records lineage only. Option texts within +-25% word count of each other (character lengths are not constrained). `jev-evals/decide-close/cands-r1.jsonl` and `cands-r2.jsonl` hold every screened candidate text, rejected and capped ones included (all invented public text), so the screening reports can be audited against them.

**Screening ("close" rule).** Ask `decide.best` (the generic pack's question) for each candidate in exactly two fixed non-policy orders, "badc" and "cadb" (options indexed a,b,c,d in written order; badc = [b,a,d,c], cadb = [c,a,d,b]). Keep the candidate if the leader's probability is below 0.70 in BOTH answers, compared unrounded. These two orders are not the written order, the reversed order or any of the four rotations, so no policy is scored on an order that was used to select the case. They are still among the 24 orders that define the reference; see Limits. Candidates are processed in file order: round 1, then round 2; within a round the generators va, vb, ba, bb and each generator's own line order. If more than 40 pass, keep the first 40 in that order. If fewer than 30 pass after 3 generation rounds, run what passed and report the count. Screening reports store only the basename of the candidates file in their `input` field, never an absolute local path.

**Reference.** The mean probability vector over the 24 orders. The full run draws all 24 orders fresh, so the screening draws are not reused in it. Leader = the argmax of the full 24-order mean. Tie: the top-2 margin of that mean vector is below 0.08; tied decisions are excluded from leader agreement and reported separately. The margin is fixed at 0.08 for the registered result. The `--margin` flag stays. The summary field `registered` is true only when ALL hold: the margin is 0.08, `--in` resolves to `jev-evals/decide-close/cases.jsonl` (the default), and `--limit` is not used. In `--analyze` it stays true only when the analyzed report was itself registered, the cases file used is that one, and the margin is 0.08. Report fields `input` and `analyzed_from` hold basenames only. A full run validates every case with the same candidate check as screening before it sends any request.

**Leave-out reference.** A policy's own draws are members of the 24-order mean, which flatters policies that ask more orders. So the primary distance for a policy uses the mean over the 24 orders excluding the orders that policy itself asked. The full-24 distance stays as a secondary column.

**Policies.**

| Policy | Requests | Answer | Orders left out of its reference |
|---|---|---|---|
| `written` | 1 | the written order | 1: the written order |
| `written_reask` | 2 | mean of the written answer and the re-ask answer (the same request asked again) | 1: the written order |
| `written_reversed` | 2 | mean of the written and the reversed answers | 2: written, reversed |
| `rotations4` | 4 | mean of the four rotations | 4: the rotations |
| `same_request_pair` | 1 | one request holding the written and the reversed question; mean of the two answers | 2: written, reversed (the same two as `written_reversed`, although its draws are separate requests) |

`written_reask` is the control for `written_reversed`: it also averages two answers, but in one order. Averaging two draws lowers noise by itself, so a gain over `written` alone cannot be credited to the second order. The re-ask is already part of the data; it costs no extra requests.

**Subsets.** Defined now from the screening data and the source ids only, never from full-run data. `scripts/close-subsets.mjs` (deterministic, offline) reads `cases.jsonl`, `screen-r1.json` and `screen-r2.json` and writes `subsets.json` with the ids of the full set and of two subsets:

- S1, strict closeness: cases whose leader probability is below 0.60 in BOTH screening orders.
- S2, one per source: cases grouped by `derived_from` (a case without `derived_from` is its own group); the first case of each group in file order is kept.

`order-sensitivity.mjs --subsets <file>` computes the summary for the full set and for S1 and S2, in the normal run and in `--analyze`, and prints them side by side. The full set is the headline either way.

## Metrics

All comparisons against thresholds (T and the 0.10 noise limit, the 0.08 and 2 x p95 decisive margins, the 0.02 gain and 60% win share, the tie margin, the 0.70 and 0.60 screens, the 0.24 spread count) use unrounded values. Rounding is for display only.

- **Primary.** Per decision and policy, the leave-out distance: the max over options of |policy probability - leave-out reference probability|. Report the mean, median and max across decisions, and for `written_reversed` against `written` and against `written_reask` the number of decisions where its leave-out distance is strictly smaller (paired; ties count against it).
- **Secondary, descriptive.** The same distance against the full 24-order mean. Leader agreement against the full-24 leader on non-tied decisions: the count over the number of non-tied decisions. The full-24 leader contains each policy's own draws (see Limits), so leader agreement is descriptive and enters no gate.
- **Noise floor.** Per decision, the max over options of |written - re-ask|. Report the mean and the 95th percentile on this set. Percentiles use the nearest-rank method on the unrounded per-decision values.

## Acceptance and consequence rules

**K3: does the reversed question inside the same request as the written one replace the separate second request?**

Let n be the number of decisions in the set and T = max(0.04, re-ask p95 of this set), on unrounded values.

- **Noise check.** If the re-ask p95 is above 0.10, the set is too noisy for this test and K3 is reported "inconclusive (noise)" (after the range check below). The breach and leader numbers are still reported.
- **(b) Breach count.** A decision breaches if EITHER |same-request reversed - separate reversed| OR |same-request written - separate written| (each the max over options) exceeds T. Let X be the number of breaching decisions among n. Condition (b) fails if X > c(n). c(n) is not a binomial quantile: T is estimated from the same decisions it is applied to, which makes X overdispersed against a Binomial(n, 0.10) (2.4 to 2.6 times, in an independent Monte Carlo of the rule run by a reviewer), and with the binomial cutoff c(39) = 7 that Monte Carlo found 0.107 of no-effect sets failing at noise sigma 0.02 and 0.154 of the conclusive ones at sigma 0.03. c(n) is instead the calibrated cutoff in `jev-evals/decide-close/k3-cutoffs.json`, embedded in `scripts/order-analysis.mjs` as `K3_CUTOFFS` and generated by `node scripts/k3-calibration.mjs --emit`; a test checks that the two are equal. For n outside 20 to 45 K3 is reported "inconclusive (n outside the calibrated range)": this check comes first, so it also applies to a noisy set, and the breach and leader numbers are still reported. How c(n) is calibrated is described under How to read it.
- **(a) Leader condition.** Evaluated on "decisive" decisions: the 24-order top-2 margin is at least 0.08 AND the top-2 margins of both the `same_request_pair` mean and the `written_reversed` mean are at least max(0.08, 2 x re-ask p95). Decisive and excluded decisions are counted and listed with the reason. (a) fails if any decisive decision has a different leader for the `same_request_pair` mean and the `written_reversed` mean. If fewer than 15 decisions are decisive, (a) is reported "not assessable" and K3 rests on (b) alone, and the report says so (`basis`).
- **Verdict.** K3 PASS only if (b) passes and (a) does not fail. Otherwise FAIL, unless the noise check made it inconclusive (noise).

How to read it:

- FAIL means "equivalence not shown", not "the same-request pair is worse".
- PASS means "no breach beyond what noise explains", not "identical".
- Calibration of c(n). `node scripts/k3-calibration.mjs` simulates the rule offline through the real `analyzeDecision` and `evaluateK3` (no reimplementation, no API). Per decision: a true probability vector drawn from Dirichlet(alpha) over 4 options, redrawn until its leader is below 0.6; the 24 order answers, the re-ask and the two same-request answers are that vector plus independent N(0, sigma) noise per option, clipped to [0, 1] and renormalised; no systematic shift. Grid: n = 20 to 45 (every integer) x sigma in {0.01, 0.02, 0.03} x alpha in {1.5, 3, 8}, 2000 trials per cell, seed 20261001. Each trial draws 45 decisions once and n uses the first n of them, so each n is exactly distributed but the cutoffs of different n share random numbers. For each n, c(n) is the smallest c with P(X > c | conclusive) <= 0.05 in every one of the 9 sigma and alpha cells (worst case over the grid), where conclusive means the re-ask p95 is not above 0.10, i.e. K3 is not "inconclusive (noise)". The tail is estimated in-sample, so the table carries Monte Carlo error of roughly 0.005 per cell. The JSON records the seed, trials, grid, model and the byte length and SHA-256 of `scripts/order-analysis.mjs` without its `K3_CUTOFFS` line (21443 bytes at calibration); `--emit` is the only way the table is written into the module.
- The table for n = 30, 35, 39 and 40 (other n in the JSON):

| n | 30 | 35 | 39 | 40 |
|---|---|---|---|---|
| c(n) | 10 | 10 | 11 | 13 |

  So K3 (b) fails at 11 of 30, 11 of 35, 12 of 39 and 14 of 40 breaching decisions. The step from c(39) = 11 to c(40) = 13 comes from the nearest-rank percentile in the registered rule, not from the calibration: the re-ask p95 is the second-largest per-decision delta for n = 20 to 39 and the third-largest from n = 40, so at n = 40 the p95, and with it T and the noise check, is lower: more trials are conclusive (the grid's smallest count of conclusive trials per cell rises from 1196 of 2000 at n = 39 to 1639 at n = 40) and more decisions breach.
- Achieved false-FAIL under the calibration model (worst case over the 9 cells, conditional on conclusive): P(X > c) is 0.0358 at n = 30, 0.0457 at n = 35, 0.0384 at n = 39 and 0.0349 at n = 40; the largest over all n = 20 to 45 is 0.0485 at n = 36, and the values for every n are in the JSON. The worst cell is sigma 0.03 (alpha 3 at n = 39); at n = 39 the tail at sigma 0.01 is 0. The leader condition (a) never failed in these simulations, so P(FAIL | conclusive) equals the breach tail. A re-run of the same calibration with seed 777 (scratch, not in the repository) gave the same cutoffs except at n = 25, 27, 37 and 38, where it is one lower. The committed cutoffs evaluated on fresh draws of seeds 777 and 31337 (also scratch) had a worst-cell tail of at most 0.0473 and 0.0498 over all n, and 0.0335 and 0.0352 at n = 39. These are estimates with Monte Carlo error, not guarantees below 0.05. The 0.05 is a design aim under the model, not a guarantee.
- Power at n = 39 (c = 11), same script with `--power`, written to `jev-evals/decide-close/k3-power.json`, 2000 trials per cell, systematic shift on one option of both same-request answers (+shift on option b, -shift/3 on the others), P(FAIL | conclusive), range over alpha:

| shift | sigma 0.01 | sigma 0.02 | sigma 0.03 |
|---|---|---|---|
| 0 (no effect) | 0 | 0.018 to 0.021 | 0.034 to 0.036 |
| 0.05 | 1.00 | 0.90 to 0.94 | 0.66 to 0.69 |
| 0.10 | 1.00 | 1.00 | 1.00 |

  At sigma 0.03 a third of the sets (about 31% to 40%, depending on alpha) are inconclusive (noise) and are not counted above; on the rest, a shift of 0.05 is caught in about two thirds of the sets. The FAIL rate here is the whole rule, not (b) alone, but (a) contributed no failures. The no-effect row is an independent random stream and agrees with the calibration.
- Limits of the calibration: it assumes independent Gaussian noise, equal noise in all arms (the re-ask, the order answers and the same-request answers) and independent decisions. Real answer noise need not be Gaussian or equal across arms, and cases cluster (see the next bullets), so real FAIL rates can differ from the numbers above, in either direction.
- Independence is optimistic: cases cluster. `node scripts/close-subsets.mjs` counts 13 of the 39 cases coming from 5 source decisions. The calibration does not model this.
- The decisive set is conditioned on policy margins. Those margins are not outcomes of the leader comparison, but they are correlated with it, so (a) is a descriptive guard on a decisive subset, not a power-calibrated test, and it is not part of the c(n) calibration.

Consequences:

- PASS: open a follow-up decision record to let `decide` send both orders in one request. This record makes no code change.
- FAIL: `decide` keeps two requests.
- Inconclusive (noise): `decide` keeps two requests; no claim either way.

**Policy comparison.** `written_reversed` beats a comparison policy only if BOTH hold: its mean leave-out distance is smaller than that policy's by at least 0.02, AND it has the strictly smaller leave-out distance in at least 60% of all decisions in the set (paired per decision; ties count against it; tied-leader decisions are included, because the distance is defined for them). Then:

- If it beats `written_reask`, the docs may say "the second order helped on close calls".
- If it beats `written` but not `written_reask`, the only allowed wording is "averaging two answers helped; not shown to be the order".
- Otherwise no verdict beyond the numbers.

Leader agreement against the full-24 leader stays in the report as a descriptive secondary metric. It is not part of the gate because the full-24 leader contains each policy's own draws.

Verdicts, K3 included, are read on the full set. Subsets S1 and S2 are sensitivity analyses reported next to it, each with its own re-ask p95 and its own c(n) from the same table (S1 has 27 decisions and S2 has 31, both inside 20 to 45; a subset outside that range would be reported as inconclusive for K3); they do not decide anything.

## Registered run

Exact command, from the repository root:

```
node scripts/order-sensitivity.mjs --in jev-evals/decide-close/cases.jsonl --subsets jev-evals/decide-close/subsets.json --out jev-evals/decide-close/order-<YYYY-MM-DD>.json
```

`<YYYY-MM-DD>` is the day of the run. The summary of that run must show `"registered": true`.

Registration is the git commit that first contains this record; `git log --follow docs/decisions/decide-order.md` shows it.

Registered files (their content at that commit defines the measurement):

- `docs/decisions/decide-order.md`
- `scripts/order-sensitivity.mjs`, `scripts/order-analysis.mjs`, `scripts/order-analysis.d.mts`, `scripts/close-subsets.mjs`
- `scripts/k3-calibration.mjs`, `scripts/k3-calibration.d.mts`
- `jev-evals/decide-close/k3-cutoffs.json`, `jev-evals/decide-close/k3-power.json`
- `test/order-analysis.test.ts`
- `plugins/evidence-referee/packs/generic/questions/decide.json` (the `decide.best` question that is asked; this record does not change it)
- `jev-evals/decide-close/cases.jsonl`
- `jev-evals/decide-close/cands-r1.jsonl`, `jev-evals/decide-close/cands-r2.jsonl`
- `jev-evals/decide-close/screen-r1.json`, `jev-evals/decide-close/screen-r2.json`
- `jev-evals/decide-close/subsets.json`

## Not claimed

- That the all-24 mean is ground truth.
- Anything about decisions that are not close.
- Anything about other models, other questions or other option counts.
- Any cost claim.
- That a K3 FAIL shows the same-request pair is worse.
- That a K3 PASS shows the same-request pair is identical to the separate requests.

## Limits

- The cases are invented and written by a model.
- One model version (`jev-1.13.0`); screening and measurement use the same model.
- One question (`decide.best`).
- 4 options only.
- The 24-order reference contains the policies' own orders; the leave-out distance handles this. Leader agreement uses the full-24 leader, which still contains them, and policies that ask more orders have more of their own draws in it, so it is descriptive only.
- Leave-out distances are inflated by 24/(24-k) for a policy that asks k orders: about 4% for `written` (k = 1), 9% for two orders and 20% for four. For `written`, `written_reversed` and `rotations4` this is an exact identity against the full-24 distance; for `written_reask` and `same_request_pair` it is approximate. This is conservative against policies that ask more orders.
- `same_request_pair` uses a 22-order reference (written and reversed left out) although its draws are separate requests, not those two orders; this is conservative for it.
- The two screening orders, badc and cadb, share slots (a is in slot 2 and d in slot 3 in both), so they are not independent evidence for a and d. They are also inside the reference.
- Options are often not fully distinct and some are straw men, so effective option counts are often 2 to 3.
- 13 of the 39 cases come from 5 source decisions (counted by `node scripts/close-subsets.mjs` from `derived_from`); S2 addresses this, and it makes the independence assumption behind c(n) optimistic.
- Selecting close calls can favour noisy cases (regression to the mean).
- One run per order.
- `--margin` is fixed at 0.08 for the registered result.
- K3 condition (a) is a descriptive guard on a decisive subset whose size is not known before the run.
- K3 (b) is calibrated only for n = 20 to 45, sigma 0.01 to 0.03 and the Dirichlet(alpha) leader-below-0.6 model with independent Gaussian noise; outside it the calibration says nothing.
- An independent check found the K3 (b) rule is not safe above sigma 0.03: at sigma 0.035 the false-FAIL rate among conclusive sets was 0.09 to 0.16 for n = 32 to 44 (only 12% to 34% of such sets pass the noise gate, and the threshold is re-estimated from the same data). The noise gate (re-ask p95 at most 0.10) admits sets with sigma near 0.035, so a K3 FAIL on a noisy set (re-ask p95 above 0.07) is read as weak evidence only. That check is a scratch run, not a repository artifact.

## Deviations

Anything that changes after this record is committed is listed here with its date and reason. Before the commit, what happened while the set was built is recorded here.

- **Two screening rounds.** Round 1: 56 candidates tested, 25 kept. Round 2: 53 tested, 15 kept; 11 more passed the rule but were capped at 40, and none of the capped ones was reviewed or run. Round 2 candidates were generated after round-1 screening results were known, to aim at closeness. The keep rule itself did not change.
- **Paired variants.** The 18 paired variants are rewrites that remove, neutralise or replace one fact and also add context. They are not one-fact ablations, and `derived_from` is lineage only. Metadata was corrected afterwards: in `vb2-thumbs-paidcdn` and `vb2-email-internal` the `removed_fact` was untruthful and now starts with "neutralised:"; in `va1-flags-nobudget`, `vb1-secrets-norot`, `va2-ratelimit-slowreview` and `vb2-migration-midtable` it starts with "replaced:". Decision, context and options are unchanged from the screened candidates.
- **Pre-run reviews.** Three independent reviews, before any full-run data, found: 7 cases with a leader at 0.60 to 0.69 in both screening orders; 5 cases with option character-length ratios of 1.31 to 1.45 (word counts satisfy the registered rule); overlapping or straw-man options, so effective option counts are often 2 to 3; and 13 of 40 cases coming from 5 source decisions. These are addressed by keeping the set, removing only `bb1-oncall-model`, and pre-registering subsets S1 and S2 as sensitivity analyses reported next to the full set. The full set stays the headline.
- **Removed case.** `bb1-oncall-model` uses an employee's personal circumstance as a decision input and has an arithmetic error. 39 cases remain.
- **Design changes.** The `written_reask` control, the leave-out distance, the revised K3 rule, unrounded comparisons, the name check, the subsets and the `registered` flag were added after those reviews and before any full-run data. None depends on an outcome.
- **Second revision, before any full-run data.** The policy gate lost its leader-match leg (the full-24 leader contains each policy's own draws) and gained a paired win-share of 60% next to the 0.02 gain. K3 was redesigned: a breach count against a binomial cutoff c(n) replaces the 90% share, T has no 0.10 cap and a re-ask p95 above 0.10 makes K3 inconclusive (noise), the decisive rule uses max(0.08, 2 x re-ask p95), and fewer than 15 decisive decisions make the leader condition not assessable instead of making K3 inconclusive. `--in` defaults to the registered cases file and `registered` needs it plus no `--limit`; report path fields are basenames; the full run validates every case; the 0.24 spread count uses the unrounded value; the candidate files were added; the Registered run section was written. None depends on an outcome. The earlier false-FAIL figures (0.13 to 0.54) belonged to the replaced rule and are removed.
- **Third revision, 2026-10-01, before any full-run data.** An independent Monte Carlo of the K3 rule found that the breach count X is overdispersed 2.4 to 2.6 times against Binomial(n, 0.10), because T is estimated from the same decisions, so the binomial cutoff c(39) = 7 failed 0.107 of no-effect sets at noise sigma 0.02 and 0.154 of the conclusive ones at sigma 0.03, against the intended 5%. The binomial c(n) and the claim that the false-FAIL rate is about 5% were removed; c(n) is now the calibrated table from `scripts/k3-calibration.mjs` (c(39) = 11), and n outside 20 to 45 is inconclusive for K3. The leader condition, T, the noise check and everything else of the rule are unchanged. None depends on an outcome.
- **How the choice was made.** The maintainer asked for the choice between keeping, dropping, regenerating or running the set as it was to be made with Jev. The first ask returned weak: keepsubsets 0.60, both orders agreeing (receipt rmup441dflt8e). After the reversibility and cost facts were added (the full run costs about three cents and fifteen minutes, it can be repeated on another set, and the subsets are defined before the run), it returned clear: keepsubsets 0.93, dropflagged 0.05, regenerate 0.01, runasis 0.01, both orders agreeing (receipt rmup449zl2jbv).

## Results

Run on 2026-10-01 with the registered command, after the registration commit `eea5c77`: 1,014 requests, 551,379 input tokens, about $0.023, no retries. Raw: [order-2026-10-01.json](../../jev-evals/decide-close/order-2026-10-01.json). The `registered` flag in the summary is true. Nothing in the design changed between the commit and the run.

- **Order matters on close calls.** One option's probability moved by 0.26 on average between orders and by up to 0.42. In 27 of the 39 decisions the spread was 0.24 or more, and in the same 27 the leader changed in at least one of the 24 orders. 8 decisions were tied (24-order margin below 0.08); 31 were not.
- **Leader agreement with the 24-order leader, 31 non-tied decisions:** written 26, written plus re-ask 26, written plus reversed 31, four rotations 30, same-request pair 30. This is descriptive: the reference contains each policy's own draws.
- **Mean leave-out distance (primary):** written 0.061, written plus re-ask 0.061, written plus reversed 0.033, four rotations 0.031, same-request pair 0.037.
- **Comparison gate:** written plus reversed beat written plus re-ask by 0.029 on average and was closer in 32 of 39 decisions (82%). Both margins of the gate were met, so the wording "the second order helped on close calls" is allowed. Averaging two answers alone (written plus re-ask) did not help.
- **Re-ask noise:** mean 0.042, 95th percentile 0.09 (the noise limit is 0.10).
- **K3: PASS** on the breach count and the leader condition. 4 of 39 decisions breached the threshold of 0.09, against 11 allowed. Of 18 decisive decisions, none had a different leader between the same-request pair and the separate written plus reversed. Read with the limits: the re-ask 95th percentile of 0.09 is close to the 0.10 limit, where the calibrated power to detect a 0.05 shift is about two thirds; a PASS means no breach beyond what noise explains, not identity.
- **Subsets:** S1 (27 cases) and S2 (31 cases) give the same conclusions: the second order helped, and K3 passes. Mean leave-out distance written 0.060 and 0.062, written plus reversed 0.031 and 0.032.
- **Consequence, as registered:** K3 passed, so a follow-up decision record may propose sending both orders in one request. This record changes no code; `decide` still asks in two requests.
