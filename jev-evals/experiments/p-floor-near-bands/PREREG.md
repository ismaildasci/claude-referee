# Pre-registration: p-floor-near-bands (written before any live request and before any analysis output was viewed)

Context: commit 4248784 floors p to two decimals in CLI JSON output. Verdicts are computed in code (src/cli/commands/*.ts) on unrounded values; only the printed p is floored.

## Part A (offline, no API)
Data: jev-evals/{done-v2,injection,verify-v2}/recorded.jsonl (all 370 records). Supplementary (labelled as such): jev-evals/decide-close and jev-evals/decide order files for the decide.* bands and the re-ask noise already on disk.
Quantities per threshold in packs/generic/thresholds.json:
- done.met met 0.7 / missing 0.5: each done-v2 and injection c1 noul (single answer).
- verify.injection flag 0.7: verify-v2 injection noul.
- verify.relation supports 0.8 / contradicts 0.5 / says_nothing 0.5: the mean of the a and b orders for that relation (as verify.ts computes it).
- Bands with no recorded data (line.risky, failure.env auto 0.9, stop.gate, decide.* in recorded.jsonl): reported "no recorded answers", not extrapolated. Extra reference line: 0.90 acceptance bar applied to the max-class probability of every answer.
Schemes compared against raw (unrounded, as stored) value r, for display value d:
 floor2 = floor(r*100)/100 (current), half-up2 = floor(r*100+0.5)/100, round3 = round to 3 decimals (half-up).
A "verdict change" = [d >= t] != [r >= t] for the >= bands, and [d < t] != [r < t] for the "missing" band (done.met missing: p < missing). Counted per threshold per scheme, with the counts of values whose raw has more than 2 decimals (only those can differ).
Near-band: count of recorded values v with t-0.01 <= v < t (within 0.01 below the band), per threshold, and separately within 0.005.
All numbers from analyze.mjs; no counts by eye.

## Part B (live, <= 80 requests, hard cap)
Re-ask the byte-identical request k times and look at the spread of p.
- B1 decide.best (direct API call mirroring scripts/order-sensitivity.mjs, raw probabilities): 6 close-call decisions from jev-evals/decide-close/cases.jsonl, written order, 6 repeats each = 36 requests. Chosen by script as those with the highest recorded leader p nearest a 0.85 clear or smallest top-2 margin near 0.10 band (selection rule fixed in select.mjs before running; no live data used).
- B2 done.met through the built CLI (--fresh, own --data-dir): 4 done-v2 dev cases with recorded p nearest 0.70 or 0.50, 5 repeats each = 20 requests. Evidence from cases-dev.jsonl.
- B3 verify through the built CLI (--fresh): 2 verify-v2 dev claims with mean supports nearest 0.80, 4 repeats each; CLI verify sends a batch (counted by receipts; planned <= 16 requests, stop if receipts show more).
- B4 CLI floor sanity: 2 decide CLI calls (--fresh) to compare printed p to floor of mean computed from raw answers is not possible, so only checks printed values have <=2 decimals. <= 4 requests.
Total planned <= 76; abort at 80 counted requests (script counter + receipts).
Statistics: per case range = max-min of p over repeats (per option for decide, max over options). Report mean, median, max, and share of cases with range > 0.01 (the floor) and >= 0.04.
Decision rules:
 1. "Re-ask noise exceeds the floor" iff at least one case range > 0.01 (floor step); "materially" iff median range > 0.01 or max >= 0.04.
 2. "Flooring matters for an acted-on verdict" iff Part A finds >=1 recorded acted-on decision whose verdict differs between floor2 and raw, OR raw-vs-floor2 displayed value places a decision on the other side of a band that the acceptance bar (p>=0.90, both orders agree) would act on. Otherwise no.
 3. Half-up/round3 findings are reported as what-if only; no recommendation to change unless it removes a floor2 verdict error (Part A shows none) .
Acceptance-bar note: I do not act on any Jev answer here; Jev is the object of measurement.
Limits stated up front: invented evidence, small n, single day, one model (jev-1.13.0), no hold-out is needed because nothing is tuned.

## Amendment 1 (written after running select.mjs, which uses recorded data only, before any live request)
select.mjs showed: (i) no recorded verify claim has mean supports near 0.8 (nearest 0.97), so B3 is uninformative and dropped; (ii) done-v2 dev has two records for d-cargo-pass, so B2 takes the first 4 DISTINCT cases by the same closeness rule. Freed requests go to B1: 8 decisions x 6 repeats = 48 (rule unchanged, top 8). B4 stays as 1 CLI decide call (--fresh) on the closest case. Planned total: 48 + 20 + 2 = 70 <= 80.
