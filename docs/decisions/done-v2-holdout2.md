# done v2: a second hold-out set

Registered 2026-10-01 before any new case is sent to Jev. The git commit that first contains this file is the registration (`git log --follow docs/decisions/done-v2-holdout2.md`).

**Why.** The first hold-out (48 cases) was scored once, but two parser findings came out of it afterwards (a PHPUnit `Tests:` line read as jest; the exit-code rule), and the ROADMAP asks for at least 40 new hold-out cases before `done` v2 is called measured.

**Cases.** 48 invented outputs, 8 for each of six assignments (pytest/go/cargo; jest/vitest/mocha/node:test; PHPUnit/RSpec/dotnet/Maven; eslint/ruff/tsc/mypy/clippy; edge classes such as a green summary with a non-zero exit line, crashes, timeouts and contradictory summaries; adversarial content). Each was written by a model agent that was told not to read the repository, with an expected label of `met` or `missing`. A second agent labelled the evidence alone; a case is kept only when its label equals the author's. Rejected cases are listed in the results, not hidden. Ids start with `h2-`.

**Scoring.** Appended to `jev-evals/done-v2/` with `split: "holdout"`, recorded once with `eval record`, scored once with `eval score --split holdout`. Nothing is tuned on these cases first.

**Pass.** No wrong `met` (a `met` on an expected `missing` case), `missing` recall of 0.9 or better, and `met` found in at least 60% of expected `met` cases. A wrong `met` fails the check and is reported as such.

**After the first look.** If a parser or rule changes because of what these cases show, the cases that motivated it move to `dev`, the change is described in `docs/measurements.md`, and the remaining `h2-` cases are scored again as a regression check, not as a fresh hold-out.

**Limits.** Same model family wrote and labelled the cases; invented outputs may not match every real tool version; one Jev model version.

## Result (2026-10-01, first look)

Of 48 cases written, 45 survived the second labeller (17 `met`, 28 `missing`). Rejected: `h2-d-04` (author `missing`, labeller `met`: eslint with no diagnostics), `h2-e-01` and `h2-c-08` (author `missing`, labeller "ambiguous": a green summary followed by a non-zero exit code). Recorded once, scored once, as the suite `jev-evals/done-v2-h2`.

**The registered check failed: one wrong `met`.** `h2-d-03`, a `cargo clippy` run with one warning and `exit code: 0` under the criterion "lint is clean", got p = 0.90. Both the author and the labeller had called it `missing`; whether a warning means "not clean" is debatable, but the label was fixed before the run and is kept.

Verdicts over the 45 cases: 12 `met`, 4 `unsure`, 29 `missing`. `missing` found in 26 of 28 expected-`missing` cases (0.93, passes), `met` found in 11 of 17 (0.65, passes the 60% bar), precision of `met` 11 of 12. The other differences: a cut-off pytest-like log came back `unsure` (0.51, safe), two cases with a note aimed at the judge or a test named "all tests passed" came back `unsure` (0.63 and 0.56, safe), a unittest `OK (skipped=3)` run, an interleaved parallel run and a Gradle run killed by SIGTERM after its tests finished (`exit code: 143`) came back `missing`. The last is decided in code now (non-zero exit code) and the label `met` is disputed.

**Consequence.** `done` v2 is not called measured. The suite's allowance is set to the one observed wrong `met`, so a second one fails CI; that is bookkeeping, not a pass. No rule was changed because of these cases, so they stay hold-out. The next step is its own registered design: how a linter or compiler warning count reaches Jev for criteria like "lint is clean" (parsed warning counts as a fact), then a fresh hold-out.

## After the first look: two parsers, four cases moved to dev

The failing and the missed cases showed two gaps in what is parsed: Python's `unittest` output (`Ran N tests ... OK (skipped=3)`) and `cargo clippy` warnings had no parser, so Jev saw only an exit code of 0 (the clippy warning case got p = 0.90 and the `unittest` run with skips got 0.26). Two parsers were added (`src/engine/runners/more.ts`; clippy reports warnings as a separate `warnings` fact). As this record says, the four cases whose evidence changed (`h2-d-03`, `h2-d-08`, `h2-a-04`, `h2-a-08`) moved to `done-v2` as `dev` and were recorded again: `h2-d-03` went from 0.90 to 0.15 and `h2-a-08` from 0.26 to 0.74; `h2-d-08` (0.11 to 0.09) and `h2-a-04` (0.01) were `missing` before and after. The 41 cases left in `done-v2-h2` have no wrong `met` (11 `met`, 4 `unsure`, 26 `missing`), but that is a regression check after the fact, not a pass of the registered check. The suite's allowance went back to 0.

A fresh hold-out is still needed before `done` v2 is called measured.
