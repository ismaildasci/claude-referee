# Measurements: how many option orders does `decide` need

Registered in [decide-order-scale.md](decisions/decide-order-scale.md) (commit 52b2511, before the first request; two extensions registered before their requests, and the deviations listed there). Harness `scripts/decide-scale/`, recorded answers and results `jev-evals/decide-scale/`. Model `jev-1.13.0`, 2026-10-05. 16,044 requests through the repo's `Session` (71 local receipts, ids in `receipts-*.json`), 78 served from the cache, 8.45M input tokens, about $0.36. No redaction replacement and no stopped request. All decisions are invented and public.

## Data

| Set | Decisions | Options | Notes |
|---|---|---|---|
| S1 `close` | 39 | 4 | screened close calls, 24 orders each |
| S2 `holdout` | 20 | 4 | the decide holdout, 24 orders each |
| S3 `a`, S4 `b` | 72 + 72 | 3 to 6 | new, two authors, written order seeded-shuffled |
| S5 `c`, S6 `d` (wave 2) | 160 candidates, 49 kept | 4 to 6 | near-tie candidates, equal option lengths; kept when 4 screening orders gave a margin below 0.20 |

Wave 1 (S1 to S4) is the registered analysis: 203 decisions, 162 with n >= 4 (the rule set), of which 16 are near-ties (reference margin below 0.08). Wave 2 adds 49 decisions, 16 near-ties. Pooled: 252 decisions, 211 with n >= 4, 32 near-ties. Every order of every decision was asked twice (run 1 and a fresh replicate run 2): the mean over a decision's pool moved by 0.0026 on average between the two runs (0.003 against the older recorded runs of S1 and S2, 59 decisions), no leader flipped; one order's answer moved by 0.010 on average. That is the noise floor of everything below.

The wave 1 near-tie share is low: 18 of 203 (8.9%); 5.6% in S3 and 6.9% in S4 although a third of each was written as near-ties. Jev leans clearly on most invented decisions, even balanced ones; 111 of 160 S5 and S6 candidates (69%) had a screening margin above 0.20.

## Policies against the references

Leader agreement with the reference leader, all decisions with n >= 4 and near-ties only (reference margin below 0.08), probability error (mean absolute error over options), false-clear (policy `clear`, reference not `clear`), clustered bootstrap 95% intervals. Verdict rule: unanimous (any order with a different leader gives `tie`).

### Wave 1, registered primary: leave-out reference (162 decisions, 16 near-ties)

| Policy | Requests | Agreement | Near-tie agreement | MAE | False-clear |
|---|---|---|---|---|---|
| `written` | 1 | 0.938 [0.901, 0.975] | 0.563 [0.313, 0.813] | 0.0188 | 6 of 75 (0.080 [0.025, 0.147]) |
| `wr` (today) | 2 | 0.951 [0.914, 0.982] | 0.500 [0.250, 0.750] | 0.0112 | 1 of 72 (0.014 [0, 0.046]) |
| `rot3` | 3 | 0.969 [0.938, 0.994] | 0.688 [0.438, 0.875] | 0.0109 | 4 of 75 |
| `rot4` | 4 | 0.969 [0.938, 0.994] | 0.750 [0.563, 0.938] | 0.0095 | 2 of 73 |
| `latin` (n rotations) | 4.3 | 0.969 [0.938, 0.994] | 0.750 [0.563, 0.938] | 0.0092 | 2 of 73 |
| `latin_rev` (2n) | 8.6 | 0.988 [0.969, 1.0] | 0.875 [0.688, 1.0] | 0.0056 | 0 of 70 |
| `rand4` | 4 | 0.970 | 0.728 [0.681, 0.773] | 0.0100 | 1.3 of 71.6 |
| `rand8` | 8 | 0.978 | 0.781 [0.713, 0.848] | 0.0079 | 0.8 of 71.2 |
| `rand12` | 12 | 0.981 | 0.807 [0.728, 0.883] | 0.0074 | 0.6 of 71.2 |

### Replicate reference (a second, fresh run of the same pool; registered as Extension 2)

Wave 1 near-tie agreement is the same as above for `written` to `latin_rev` where run 2 agrees; the main differences are in the random policies, whose leave-out reference was thinner. Pooled (211 decisions, 32 near-ties):

| Policy | Requests | Agreement | Near-tie agreement | MAE | Regret | False-clear | Verdict agreement (unanimous / mean only) |
|---|---|---|---|---|---|---|---|
| `written` | 1 | 0.910 [0.867, 0.948] | 0.625 [0.469, 0.781] | 0.0215 | 0.0070 | 5 of 75 (0.067 [0.014, 0.128]) | 0.815 / 0.815 |
| `wr` | 2 | 0.938 [0.905, 0.967] | 0.656 [0.500, 0.813] | 0.0121 | 0.0028 | 1 of 72 (0.014 [0, 0.046]) | 0.910 / 0.924 |
| `rot3` | 3 | 0.957 [0.929, 0.981] | 0.719 [0.563, 0.875] | 0.0111 | | 3 of 75 | 0.886 / 0.905 |
| `rot4` | 4 | 0.948 [0.915, 0.976] | 0.688 [0.531, 0.844] | 0.0098 | | 1 of 73 | 0.891 |
| `latin` | 4.4 | 0.957 [0.929, 0.981] | 0.750 [0.594, 0.906] | 0.0095 | 0.0014 | 1 of 73 | 0.886 / 0.934 |
| `latin_rev` | 8.8 | 0.991 [0.976, 1.0] | 0.938 [0.844, 1.0] | 0.0052 | 0.0001 | 0 of 70 | 0.806 / 0.957 |
| `rand1` | 1 | 0.908 | 0.611 [0.573, 0.649] | 0.0210 | | 2.8 of 73.5 | |
| `rand2` | 2 | 0.937 | 0.675 [0.639, 0.711] | 0.0145 | | 1.6 of 72.3 | |
| `rand4` | 4 | 0.959 | 0.753 [0.715, 0.792] | 0.0101 | | 0.7 of 71.6 | 0.883 / 0.912 |
| `rand8` | 8 | 0.974 | 0.834 [0.795, 0.874] | 0.0067 | 0.0007 | 0.3 of 71.2 | 0.860 / 0.947 |
| `rand12` | 12 | 0.985 | 0.904 [0.868, 0.937] | 0.0051 | | 0.1 of 71.2 | 0.832 |

Random policies are averaged over 200 draws, so their intervals only reflect the resampling of decisions, not the draw; the fixed designs are one realization each. Paired gain on near-tie agreement over `wr` (pooled, 32 near-ties): `latin_rev` +0.281 [0.094, 0.469], `rand8` +0.178 [0.017, 0.346], `latin` +0.094 [-0.156, 0.344], `rot3` +0.063 [-0.156, 0.281], `rot4` +0.031 [-0.188, 0.281]. On wave 1 alone (16 near-ties): `latin_rev` +0.375 [0.063, 0.688]. On wave 2 alone (16 near-ties, all `weak` or `tie`, so no false-clear is measurable) `latin_rev` agrees in 16 of 16 and `wr` in 0.81 [0.63, 1.0]; there the paired gain is +0.19 [0, 0.38].

Agreement by reference margin (pooled, rule set, replicate reference):

| Margin | Decisions | `written` | `wr` | `rot3` | `latin` | `latin_rev` | `rand4` | `rand8` |
|---|---|---|---|---|---|---|---|---|
| [0, 0.04) | 19 | 0.53 | 0.68 | 0.74 | 0.68 | 0.89 | 0.65 | 0.67 |
| [0.04, 0.08) | 13 | 0.77 | 0.62 | 0.69 | 0.85 | 1.00 | 0.85 | 0.92 |
| [0.08, 0.2) | 43 | 0.88 | 0.95 | 1.00 | 0.98 | 1.00 | 0.98 | 1.00 |
| [0.2, 1] | 136 | 0.99 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

The 41 decisions with 3 options (2 near-ties) are reported apart: `wr` agrees in 41 of 41, `written` in 0.976; with a 6-order pool no larger policy is evaluable.

## Decision rule

Best near-tie agreement over all policies, then the cheapest policy within 0.05 of it with false-clear at most 0.05 and the fewest requests (leave-out, full-set and replicate references, unanimous and mean-only verdicts, wave 1, wave 2 and pooled: 18 evaluations). The qualifying set was `latin_rev` alone in 10 of them and `latin_rev` plus `rand12` in 8 (full-set and replicate references, in wave 1 and pooled); the cheapest was `latin_rev` in all 18. Nothing cheaper qualified in any: not `wr`, not 3 or 4 rotations, not `rand8`. The false-clear condition was met by `latin_rev` everywhere (0 of 70 clear verdicts in wave 1, no clear verdicts in wave 2).

## Is `written + reversed` enough

- It is enough for most decisions: with a reference margin of 0.08 or more it agrees with the reference leader in 0.99 of 179 decisions (0.95 for margins 0.08 to 0.2, 1.00 from 0.2), and verdict agreement over all decisions is 0.91 to 0.92. One of 72 `clear` verdicts was not `clear` in the reference (0.014 [0, 0.046]), against 5 of 75 (0.067) for the single written order, which fails the 0.05 limit.
- It is not enough on near-ties: leader agreement 0.66 [0.50, 0.81] pooled (0.50 on wave 1) against 0.94 for the 2n balanced design. What is lost is small in probability terms: regret (reference probability given up by following the policy's leader) 0.0028 for `wr` against 0.0001, and the probability error 0.012 against 0.005. On a near-tie the reference leader leads by under 0.08, so the pick is close to arbitrary whichever policy chooses it.
- Three or four rotations buy nothing detectable over `wr` (paired intervals include 0), and are not cheaper than the balanced design in any sense that mattered. The gain comes with balance and size together: the Latin square with its reversal puts every option in every slot twice. A random 8 (same size) is behind it (0.83 against 0.94 near-tie agreement), though the reference comparison is kinder to the fixed designs on this point only for n = 4 (see caveats).
- Averaging more random orders keeps improving the probability error (0.021 at one order to 0.005 at twelve of 24) and the near-tie agreement (0.61 to 0.90) without a plateau by 12 of 24; part of the late gain is overlap with the reference (policy orders are among the pool).

## Verdict rule with more orders

`decide` turns a leader disagreement between orders into `tie` (unanimous). With 8 to 12 orders almost every decision with a small margin has at least one order that disagrees, so unanimous verdict agreement with the reference drops to 0.81 for `latin_rev` (0.91 for `wr`); the mean-only variant (verdict from the mean probabilities alone) gives 0.96 for `latin_rev` with no false-clear. A move to more orders would need the verdict rule changed with it.

## Bias and confounds

- **Slot effect.** Pooled, with the option effect removed (all 252): the first-listed option loses 0.0044 [-0.0064, -0.0022] and the last-listed gains 0.0047 [0.0027, 0.0067], first minus last -0.0090 [-0.0126, -0.0052]. It is largest for 5 options (-0.011 / +0.019, first minus last -0.030 [-0.040, -0.020]) and on the wave 2 near-ties (-0.010 / +0.017). A real but small recency tilt toward the last-listed option.
- **Written order as the single policy.** First-listed minus the pool without the written order: -0.0047 [-0.0097, 0.0003] over 252 decisions; by set -0.020 in S1 (significant), -0.003, +0.001, -0.002, -0.024 and +0.015 (S6, interval 0.0004 to 0.031). No consistent first-listed gain; the sign changes between sets. In S1 to S4 the reference leader is the author's first-listed option in 31%, 100% (S2), 39% and 36% of decisions against about 25% by chance, so some authors listed the favourite early; in S2 the reference leader is first-listed in 20 of 20.
- **Option name.** Re-asking S1, S3 and S4 (183 decisions) with neutral names `o1..on`: the mean option probability moved 0.029 [0.024, 0.034] on average and the leader changed in 22 of 183. On S1 alone (39): 0.056 against 0.004 for the same decisions re-asked with the same names (difference +0.051 [0.040, 0.064]); leader changed in 14 of 39 against 1 of 39. The shift is larger than the error of the `wr` mean (0.012) and about ten times the re-ask floor (0.003 to 0.004); this study cannot say which direction a name pushes.
- **Option length.** Within a decision the probability rank follows the text-length rank: Spearman 0.34 [0.26, 0.42] over S1 to S4 (0.16 in S1, 0.34 in S3, 0.42 in S4), the leader is the longest option in 54% of decisions against 26% by chance. In wave 2, whose authors equalised option lengths, the correlation is 0.03 [-0.12, 0.17] and the longest option leads in 18% (21% expected). Name length: 0.05 [-0.03, 0.14]. Association only: authors may write better options longer.

## Caveats

- 32 near-ties pooled (16 registered). Near-tie intervals are wide, and the registered result alone (16) is `latin_rev` 0.875 [0.69, 1.0] against `wr` 0.50 [0.25, 0.75].
- The reference is a mean over a finite pool of orders: all 24 for n = 4 (20 in wave 2), a random 24 of 120 or 720 for n >= 5. For n >= 5 the fixed designs lie outside that pool and random draws inside it, which favours random policies; for n = 4 the leave-out complement of a balanced design is balanced and the complement of a random draw is not, which favours the fixed designs. That is why the replicate reference was added after the first results were read; the choice of recommendation is the same under all three references.
- Wave 2 was added and the replicate reference was registered after reading earlier results, and the screening threshold was widened from 0.10 to 0.20 after the screening answers were in (deviation 1 in the registration). All are listed in the registration document.
- Invented, public decisions; one model version; four of the six sets written by agents. The share of near-ties is whatever Jev gave, not what the authors intended. Nothing here measures whether a different leader would have been the better decision for a real user.
- Rotations and the shuffled written order are the study's designs; `decide` itself does not take explicit orders, so the harness builds the same `decide.best` question and sends it through `Session`.
