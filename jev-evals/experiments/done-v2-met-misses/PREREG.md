# Pre-registration: done-v2 met misses (written 2026-10-01, before any live request)

Disclosure: the diagnosis below used the already published recorded probabilities of both splits (including hold-out) offline. The candidate text was chosen from the offline discrimination (parsed no-exit-code cases vs exit-code cases; cargo summary_line vs passed mismatch), which includes hold-out numbers. So the hold-out run is NOT blind; it is a one-shot regression/confirmation check, not an unbiased estimate.

Candidate (one only): replace in done.met `note` the clause "a missing exit code" and add two sentences: passed is the total over all result blocks while summary_line is one line; a recognised runner entry with passed>0 and failed/errors/skipped = 0 and no contradiction shows the tests pass, a missing exit code line does not change that. Pack: donenote (extends generic, only questions/done.json overridden), bands untouched (met 0.7, missing 0.5), model jev-1.13.0, same state facts (src unchanged, built dist).

Dev rule (dev split, 30 requests, scored with the same unrounded verdict logic as eval score):
 D1 met found on dev > 7 of 11 (baseline 7).
 D2 wrong met on dev = 0.
 D3 no dev expected-non-met case with trust != unparsed reaches p >= 0.7.
If any of D1-D3 fails: result is "candidate rejected"; no second text is tried, hold-out is NOT run.
Hold-out rule (run once, 48 requests, only if D1-D3 hold): H1 wrong met = 0; H2 met found >= 15 of 18 (baseline 15); H3 no expected-missing case with trust != unparsed at p >= 0.7. Report h-cargo-pass, h-pytest-rerun, h-phpunit-warn individually.
Adopt-worthy only if D1-D3 and H1-H3 all hold. Because dev expected gain is probably one case (d-cargo-pass), this is reported as weak evidence regardless.
Request budget: 30 + 48 = 78 (limit 600). Recording goes to the scratch evals dir only, receipts to scratch data dir.
Parser fix for h-phpunit-warn (phantom jest runner) and the exit-label proposal are NOT tested live (not a question-text change); offline only.
