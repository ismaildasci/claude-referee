# decide: how many option orders (registration)

Registered before the first request. The result section is added after the run; this part is not edited afterwards except to record a deviation under "Deviations".

## Question

`decide` asks `decide.best` in two orders (written, reversed) and reports the mean. On 39 close decisions the order moved one option's probability by 0.26 on average (up to 0.42; [decide-order.md](decide-order.md)). At what number and design of orders do the leader and the probability stabilise, and is "written + reversed" enough, or are 3 or 4 rotations, more random permutations, or a balanced design worth the cost? The maintainer decides policy; this study only produces a recommendation. `decide`'s behaviour and defaults are not changed.

## Decision set

Source keys in the harness: S1 `close`, S2 `holdout`, S3 `a`, S4 `b`.

All invented and public; no private material of any kind. Each decision has 3 to 6 options. Results are clustered by decision.

| Source | Decisions | Options | Written order | Notes |
|---|---|---|---|---|
| S1 `jev-evals/decide-close/cases.jsonl` | 39 | 4 | authored order | screened close calls (leader below 0.70 in two fixed orders) |
| S2 `jev-evals/decide/cases.jsonl` | 20 | 4 | authored order | the clear-ish public holdout |
| S3 `jev-evals/decide-scale/cases-a.jsonl` | 72 | 3 to 6 | seeded shuffle | written by the primary author (this session) |
| S4 `jev-evals/decide-scale/cases-b.jsonl` | 72 | 3 to 6 | seeded shuffle | written by a second agent that saw no other case and no result, from a written brief (domains, option counts, intent mix) |

The decide-best set (`jev-evals/decide-best/cases.jsonl`, 39 cases) is dropped: its contexts and options are identical to S1's (checked by comparing context and option texts; it only adds an expected label), so including it would count the same decisions twice. That leaves 203 decisions, 144 of them new (S3 + S4, at least the 120 asked for); the existing public decisions are 59. The authors tagged each new case `near_tie`, `mid` or `clear` as intent only; the tag is not used in any metric, only to check that near-ties are present. Near-ties are produced by writing balanced contexts, not by screening with Jev (screening on Jev output would select on order sensitivity). The share of near-ties is reported afterwards from the reference (below).

Seeded shuffle (S3, S4): the written order is the authored order permuted by Fisher-Yates driven by mulberry32 seeded with the first 32 bits of `sha256("decide-scale-written:" + id)`, so the first-listed option is not the author's favourite. S1 and S2 keep the authored order, which also lets the study check whether authors list the leader first.

Option names are the authored names, which satisfy `decide`'s name rule. Option text length and name length are recorded.

## Requests and the order pool

Everything goes through the repo's request path: `scripts/decide-scale/run.mjs` builds the same `decide.best` Choice question as `decide` (pack `generic`, question `decide.best`, `criteria` = options in the order shown) and sends it with the repo's `Session` (redaction, cache, retry budget, one local receipt per batch). Model `jev-1.13.0`. The key stays in the keychain and is never printed or stored. Recorded answers go to `jev-evals/decide-scale/recorded-*.jsonl` (decision id, order, probabilities, whether cached; no key, no private content).

For each decision, define the fixed designs from its written order `w` (length n): `rot_i(w)` is `w` rotated left by i, for i = 0..n-1 (`rot_0` is the written order); `rev` is `w` reversed; `revrot_i` is `rot_i(w)` reversed. F = {rot_0..rot_{n-1}, revrot_0..revrot_{n-1}} (the written order and its reversal are in F).

- n <= 4: the pool is all n! orders (6 or 24). F is inside it.
- n >= 5: the pool is R, 24 distinct random orders not in F (seeded rejection sampling, seed from `sha256("decide-scale-R:" + id)`), plus F asked separately (at most 12 extra requests).

The reference is built from the pool (R for n >= 5). It is the answer the question "what would the mean be if we asked many orders" targets.

Reference leader = option with the highest mean probability over the pool; reference p = that mean vector. Reference margin = top mean minus second mean. Near-tie: reference margin < 0.08 (the repo's `TIE_MARGIN`). Reference verdict = `decide`'s rule on the reference mean without the disagreement check: `clear` if p1 >= 0.85 and p1 - p2 >= 0.10, `weak` if p1 - p2 >= 0.10, else `tie` (thresholds from `packs/generic/thresholds.json`).

Replicates: S1 and S2 were also asked in all 24 orders before (2026-09-30 and 2026-10-01, a direct fetch, recorded in `order-2026-09-30.json` and `order-2026-10-01.json`). The new run of S1 and S2 through `Session` is the primary data; the older answers are used only as a replicate (drift and noise of the 24-order mean). Planned size: 4,506 requests for the main run (S1 936, S2 480, S3 1,498, S4 1,592), 3,654 for the rename arm below, estimated 1.53M and 1.23M input tokens (a dry run of every request through `Session`: 0 redaction replacements, 0 stops), about $0.12 in all at $0.042 per million.

## Policies compared

A policy is a set of orders asked for one decision, with answers averaged.

| Policy | Orders | Requests |
|---|---|---|
| `written` | `rot_0` | 1 |
| `wr` | written and reversed (today) | 2 |
| `rot3`, `rot4`, `rot5`, `rot6` | `rot_0..rot_{k-1}` (needs n >= k) | 3 to 6 |
| `latin` | `rot_0..rot_{n-1}`: every option once in every slot | n |
| `latin_rev` | F: the Latin square and its reversal, every option twice in every slot | 2n |
| `rand_k` for k = 1, 2, 3, 4, 6, 8, 12 | k distinct random pool orders (200 seeded draws per decision, averaged within decision) | k |

`rand4` and `rand8` are the registered random policies; the other k give the learning curve of "how many orders". Draws are from the pool (R for n >= 5; never from F, so fixed designs and random draws use different orders when n >= 5).

Policy verdict follows `decide`: `tie` if the orders do not all pick the same leader ("unanimous", the natural extension of the two-order rule; for k = 1 there is nothing to disagree), else `clear` if the mean leader p >= 0.85 and margin >= 0.10, `weak` if margin >= 0.10, else `tie`. A "mean-only" variant without the disagreement check is also reported. Verdicts use unrounded values with a 1e-9 float guard, like the repo.

## Comparison target (two variants)

- **Leave-out reference (primary).** For a policy with order set Q, the reference is the mean over the pool minus Q, so the policy is never scored against answers it contributed. A policy is applicable to a decision only if the pool minus Q still has at least 2 orders. This makes `rand8` and `latin_rev` inapplicable for n = 3 (6 orders); the n = 3 decisions are reported separately and the decision rule uses decisions with n >= 4 only.
- **Full-set reference (as asked).** The reference is the mean over the whole pool (R for n >= 5), including Q for n <= 4. It favours large policies (the more of the pool they cover, the closer they sit to the reference by construction), so it is reported next to the primary and not used alone for the recommendation.

Near-tie membership is always decided from the full-set reference margin (so the near-tie set is the same for every policy).

## Metrics

Per decision and policy (averaged over the 200 draws for random policies), then across decisions:

1. Leader agreement with the reference leader, overall and on near-ties; also by reference-margin bin [0, 0.04), [0.04, 0.08), [0.08, 0.20), [0.20, 1].
2. Regret: reference p of the reference leader minus reference p of the policy's leader.
3. Mean absolute error of the probability vector against the reference (mean over options), and absolute error of the policy's top probability against the reference top probability.
4. Verdict agreement (clear, weak, tie) with the reference verdict, with the confusion matrix.
5. False-clear rate: among decisions where the policy says `clear`, the share where the reference verdict is not `clear` (ratio of sums over decisions); missed-clear: reference `clear`, policy not.
6. Cost: requests per decision, summed over the set, and dollars from the recorded input tokens.

Intervals: 2,000 bootstrap resamples of decisions (clustered by decision; draws within a decision are averaged first), seed 20261005, 95% percentile intervals; differences between policies use the same resamples (paired). Proportions over few decisions (near-tie subset) get the same bootstrap; the near-tie subset size is stated beside every near-tie number.

Noise floor: S1 and S2 old versus new 24-order means, mean absolute difference per option (what two full runs differ by, from the model and the endpoint over time).

## Decision rule

Applied to decisions with n >= 4, leave-out reference, "unanimous" verdicts:

- Let best = the largest near-tie leader agreement over all policies in the table (including `latin_rev`, `rand8`).
- A policy qualifies if its near-tie leader agreement >= best - 0.05 and its false-clear rate <= 0.05.
- The recommended policy is the qualifying policy with the fewest requests per decision (ties: lower probability error). If no policy qualifies, the study recommends no change and says why. If no policy has any `clear` verdict, the false-clear condition is reported as "no clear verdicts" and treated as met.
- Supplementary check (not part of the rule): `wr` is called "enough" only if no qualifying cheaper-or-equal alternative exists; a more expensive policy is called "worth it" only if it beats `wr` on near-tie leader agreement by at least 0.05 with a paired bootstrap interval that excludes 0. The recommendation also states if the upper end of the false-clear interval of the chosen policy exceeds 0.05, and whether the full-set variant gives a different answer (then the recommendation is stated as weaker).

A null result (all policies within noise of each other, or `wr` already at the ceiling) is reported as such.

## Bias and confound checks

1. **Slot effect.** Within each decision, fit probability = option effect + slot effect by alternating means over the pool (exact for n <= 4, where every option sits in every slot equally often; approximate for R, where empty option-slot cells are skipped). Report mean slot-1 effect, mean last-slot effect and mean first minus last, across decisions with a bootstrap interval, overall and by n.
2. **Written order as a policy.** Mean over decisions of p_written(first-listed) - p_reference(first-listed), by source; share of decisions whose reference leader is first-listed in the authored order versus the 1/n expectation (S1, S2 and, before shuffling, S3 and S4).
3. **Option name.** Rename arm: S1, S3 and S4 (n <= 4 in the full pool, n >= 5 in R) re-asked with neutral names `o1..on` (the name follows the option, `o_i` = i-th option in authored order, as `decide` does for string options). Per option, difference of the pool-mean probability between original and neutral names; report mean absolute shift, leader changes, and compare with the S1 noise floor; the arm is evidence of a name effect only if its shift exceeds that floor.
4. **Option length.** Within each decision, Spearman correlation between option text length (characters) and the reference probability (also name length); share of decisions whose reference leader is the longest option versus the sum of 1/n; bootstrap interval. Also reported per source: the two new sets differ in style (option texts average about 43 characters in S3 and 75 in S4). This is an association: authors may write better options longer, and the study has no length-only manipulation.

## Hashes

| File | sha256 |
|---|---|
| `jev-evals/decide-scale/cases-a.jsonl` | `6b9f6e64fb56ffeff61ef302c2bb4fb7997b0b73e3ea61893c38b4d5e3fa12cd` |
| `jev-evals/decide-scale/cases-b.jsonl` | `c019e87fa89737014a78bc46a0438d03ece4ab02feb094dc6910b9838d9fa7fd` |

## Deviations

None yet.
