# Pre-registration: line.risky and failure.env calibration

Written before any case request. Smoke test already done: 1 request (one hand-made line, data/ dir, not a case, not used in any result).

## Questions
1. At the pack's 0.9 band, how many wrong positives (and wrong negatives) do line.risky and failure.env (generic pack 0.1.0, jev-1.13.0) give on invented labelled cases, and what is the coverage?
2. Does a revised question text (v1) change that? Does failure.env as a Choice (categories) change it? Does line.risky as a Choice (decomposed by risk kind) change it (compound-question concern)?

## Cases (frozen)
`cases/risky.jsonl`, `cases/env.jsonl` (built by `cases/make-cases.mjs`, sha256 recorded below). 48 each; dev 24 / hold-out 24; 12 positive + 12 negative per split. Labels are mine and are never changed after a probability is seen. Near-misses are marked `near_miss` (35 of 48 risky, 24 of 48 env). Known label risk: r-d08 and r-h11 (a log line that logs a secret) are risky under the pack's own "security" criterion but routine under its "logging" criterion; they are reported separately as `criteria_conflict`.

## Variants
- `base`: pack text as shipped (copy in packs/base). Noul, asked through `judge`.
- `v1`: revised text for both questions (packs/v1). Noul via `judge`. Text fixed now; changed only in round 2 (below).
- `rc` / `ec`: Choice via `decide` in my pack copies (override of decide.best; options in cases/choice-options.json). `decide` asks two option orders (written, reversed). Production would need a judge-style command for Choice; this is a measurement route only.
- Round 2: allowed once per question, only noul text, derived from dev errors only, dev-recorded then hold-out-recorded like any other variant. Budget-capped (below).

## Decision rules
- Noul: p >= 0.9 yes, p <= 0.1 no, else review (judge.ts: `p >= band` yes, `p <= 1 - band` no). Band 0.9 from thresholds.json.
- Choice: positive-class probability P = sum of probabilities of the positive categories (env: network, tool, permission, resource; risky: 1 - routine), per order. yes needs P >= 0.9 in BOTH orders; no needs P <= 0.1 in BOTH orders; else review (the acceptance bar: both orders agree). Also reported: mean-of-orders at the same band, and order disagreement count.
- wrong positive = yes on a negative case; wrong negative = no on a positive case; coverage = (yes + no) / n; precision/recall of yes. Counted by script (`score.mjs`), never by eye. A stopped (not sent) case counts as review.
- Dev selection (per question): rank by (1) fewer dev wrong positives, (2) fewer dev errors (wp + wn), (3) higher dev coverage. A candidate replaces base only if dev errors <= base errors AND (errors strictly lower OR coverage higher by >= 3 cases). Else keep base text.
- Hold-out: every candidate (base, v1, Choice, round-2 if any) is recorded on hold-out exactly once, only after the dev tables are written to DEV-RESULTS. No text change after the hold-out is read. The hold-out table, not the dev table, carries the claim.
- Kill criterion mirrored from the suites: wrong positives at 0.9 = 0 on hold-out. With 12 negatives per split, 0 wrong positives only bounds the true rate below about 22% (95%, rule of three: 3/12 = 25%); I report that bound, not "calibrated".
- Pooled base (dev+hold-out, 24 negatives) is reported as extra because base text was never tuned on dev.
- Compound concern: per-risk-category recall of base for line.risky (security, dataloss, concurrency, money, errors) and the near-miss vs plain split; Choice vs Noul compared by wrong positives, coverage.

## Budget
Cap 540 API requests total (hard stop; limit given 600). Planned: dev 192 (risky base 24, v1 24, rc 48; env base 24, v1 24, ec 48), hold-out up to 192, noise re-ask 32 (16 dev cases each of risky base and env base with --fresh), round 2 up to 48 dev + 48 hold-out. Ledger: `ledger.jsonl`, request counts taken from the CLI's own `requests` field (cached = 0).

## Noise
Re-ask of the same request with --fresh on 16 dev cases per question (base): reported as max/mean |dp|.

## Amendment A1 (after the dev tables, before any hold-out or stress request)
Dev results (192 requests) showed 0 wrong positives and 0 wrong negatives for all six variants, so the 48-case sets mostly measure coverage, not error. To get a chance to see wrong positives I added a separate **stress split**: 14 harder invented cases per question (7 positive, 7 negative: a risky line whose danger sits in the context or in a one-token change; a routine line that mentions SECURITY/DELETE; an env failure that looks like an assertion; a code failure that quotes ECONNREFUSED/ENOSPC/missing module). Written before any request on them. They are NOT hold-out and NOT used for selection; they are reported as a separate table, each variant recorded once (base, v1, Choice). `cases/*.jsonl` now holds 62 lines each; the first 48 lines are unchanged (hashes in PREREG.md.hash cover the old files; new hashes appended there). Budget re-plan: spent 193 so far (192 dev + 1 smoke); hold-out 192; stress 112; noise 24 (12 dev cases per question, base, --fresh); total <= 521; cap stays 540. Round 2 text revisions are dropped unless dev or stress errors appear that justify them within the cap.
