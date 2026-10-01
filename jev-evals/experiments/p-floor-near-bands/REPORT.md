# p-floor-near-bands: does flooring p matter for an acted-on verdict?

Pre-registration: PREREG.md (written before any live request; Amendment 1 recorded before the live run). Scripts: select.mjs, analyze.mjs, analyze2.mjs, live.mjs, analyze-live.mjs. Outputs: partA.json, partA2.json, partB.json, live.jsonl. Nothing in the repo was edited; git status was clean after the run.

## Key mechanism (code, not measurement)
Verdicts are computed on unrounded values (src/cli/commands/done.ts:36-38, verify.ts:90-113, decide.ts:189, judge.ts:116). Only the printed JSON p is floored (src/engine/output.ts roundNumber). All pack thresholds have at most 2 decimals, so floor2(p) >= t iff p >= t: flooring cannot move a printed p across a band in the safe direction. Raw API probabilities have at most 2 decimals (max 2 in all 370 recorded records and in all 48 live decide answers), so a single answer (done, injection, judge) is unchanged by flooring. Only means of two orders (verify a+b, decide written+reversed) can have a third decimal (multiples of 0.005).

## Part A, offline (all 370 records in done-v2, injection, verify-v2; analyze.mjs)
Flips = decisions whose pass/fail at the threshold differs between the displayed scheme and the raw value.

| Threshold | t | n | raw >2 decimals | floor2 | half-up2 | round3 | within 0.01 below | within 0.005 below |
|---|---|---|---|---|---|---|---|---|
| done.met met | 0.7 | 238 | 0 | 0 | 0 | 0 | 0 | 0 |
| done.met missing | 0.5 | 238 | 0 | 0 | 0 | 0 | 1 (injection/pytest-cut-clean=0.49) | 0 |
| verify.relation supports (mean a,b) | 0.8 | 132 | 9 | 0 | 0 | 0 | 0 | 0 |
| verify.relation contradicts | 0.5 | 132 | 7 | 0 | 0 | 0 | 0 | 0 |
| verify.relation says_nothing | 0.5 | 132 | 8 | 0 | 0 | 0 | 0 | 0 |
| verify.injection flag | 0.7 | 132 | 0 | 0 | 0 | 0 | 0 | 0 |
| 0.90 acceptance bar (max class prob, all 634 answers) | 0.9 | 634 | 5 | 0 | 0 | 0 | 2 | 0 |

Total flips under floor2, half-up2 and round3: 0 in every row. Half-up2 would be the risky one in principle (0.895 -> 0.90 overstates), but no recorded value sits in [t-0.005, t) so it did not occur. Of 396 verify means, 22 have a third decimal.
Bands with no recorded answers (not analysed): decide.best/fit clear and margin (in recorded.jsonl), line.risky.auto, failure.env.auto, stop.gate.* . For decide.* a supplementary check used the 24-order files (not recorded.jsonl; labelled supplementary): all written/reversed pairs formed from the 24 orders, 480 pairs (public set) and 936 pairs (close set), counted per ordered pair so each unordered pair appears twice.
- Clear band (p1 >= 0.85): no flips under any scheme; none within 0.01 below.
- Margin (p1 - p2 >= 0.10), if a reader re-derives the margin from the printed p's: public set 0 differences; close set 6 pair visits (3 distinct pairs, from bb1-flaky-tests and bb1-secret-scanning, e.g. raw 0.42/0.325 -> margin 0.095 fails, printed 0.42/0.32 -> 0.10 passes). Cause: flooring the runner-up raises the difference. This affects only a hand re-derivation; decide prints p (not the margin) and its own verdict is from raw means. round3 gives 0 differences. 26 pair visits lie within 0.01 below the margin band.
- Separate finding, not caused by flooring: decide.ts:189 compares `p1 - p2 >= margin` in floating point. In the close set 8 pair visits (about 4 distinct pairs) have an exact-decimal margin of 0.10 that evaluates below 0.1 in JS (0.5 - 0.4 = 0.09999999999999998), so decide would say "tie" where exact arithmetic says weak/clear. Computed by analyze2.mjs on the recorded data; not verified end-to-end through the CLI.

## Part B, live re-ask of byte-identical requests (70 of the 80-request cap; counted by script, receipts show 20 done calls and 1 decide call of 2 requests)
Case choice was fixed from recorded data only (select.mjs); deviations from PREREG: B3 (verify) dropped and B1 enlarged to 8 decisions (Amendment 1). Repeats ran in round-robin across cases.
- B1 decide.best raw probabilities, 8 close decisions x 6 identical asks, written order: per-decision max option range (max-min over 6) mean 0.085, median 0.08, max 0.10; all 8 cases above 0.01, all 8 at or above 0.04. In 3 of 8 the leader changed across identical asks (vb1-secrets-norot 0.50-0.55, bb1-release-cadence, bb1-recovery-policy).
- B2 done.met through the built CLI (--fresh), 4 distinct cases x 5 asks: range of p 0.03, 0.04, 0.05, 0.07 (median 0.04). d-cargo-pass series 0.67, 0.68, 0.68, 0.71, 0.71 with threshold 0.70: the verdict was "unsure" on some identical re-asks and "met" on others. Others stayed on one side of the band (d-dotnet-pass met, series 0.75-0.80; d-build-exit0 unsure; d-gotest-cut missing).
- B4 CLI decide, 1 call: printed p values have 2 decimals; verdict weak (ciapply 0.61 vs reconciler 0.32).

## Conclusion
- Flooring does not change any acted-on verdict in the recorded data: 0 flips at every pack threshold with recorded answers, and by construction floor2 cannot flip a comparison against a 2-decimal threshold. Half-up2 and 3-decimal reporting also give 0 flips here. Near-band values within 0.01 below a band are rare: 1 of 238 for done.met missing, 2 of 634 at 0.90.
- Re-ask noise is much bigger than the 0.01 floor step: the memory's "about 0.01" is not supported on these samples; the larger figure is. The earlier 0.04 (public set, 20 decisions) and 0.17 max / 0.09 p95 (close set, recorded in order-2026-10-01.json) agree in direction; this run measured 0.03-0.10 on identical requests (small n: 8 decide + 4 done cases). Because of this, a printed 0.89 vs 0.90 carries less information than the noise, and an identical re-ask can flip a verdict at 0.70 (observed once, d-cargo-pass). Whether flooring happens or not is dominated by this noise.
- So: flooring matters for no acted-on verdict. The acceptance bar (p >= 0.90, both orders agreeing) is unaffected; floor is the conservative direction (a printed 0.90 means raw >= 0.90).

## Recommendation
Keep the floor. Do not switch to half-up (it can overstate across a band; no data shows a gain). 3-decimal reporting is optional and adds no information given the noise and 2-decimal API. Two follow-ups outside this experiment: (1) document that re-ask noise is 0.03-0.10, not 0.01, wherever the 0.01 figure is stated; (2) consider an epsilon in decide.ts:189 for the exact-0.10 margin case (separate bug, needs an end-to-end test first). Do not re-ask to push a p over a band.

## Limits
Invented cases, one day, one model (jev-1.13.0), small live n (8 + 4 cases, 5-6 repeats), cases chosen near bands so noise estimates are for uncertain cases and not for confident ones (confident answers at 0 or 1 have 0 spread per the earlier public set). No recorded data for judge, stop.gate, line.risky or failure.env bands. Part A counts pairs from 24-order files twice. Not verified: end-to-end CLI behaviour for the float-edge margin; decide-fit (per_option) mode.
