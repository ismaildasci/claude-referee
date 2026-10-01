# done v2: a second hold-out set

Registered 2026-10-01 before any new case is sent to Jev. The git commit that first contains this file is the registration (`git log --follow docs/decisions/done-v2-holdout2.md`).

**Why.** The first hold-out (48 cases) was scored once, but two parser findings came out of it afterwards (a PHPUnit `Tests:` line read as jest; the exit-code rule), and the ROADMAP asks for at least 40 new hold-out cases before `done` v2 is called measured.

**Cases.** 48 invented outputs, 8 for each of six assignments (pytest/go/cargo; jest/vitest/mocha/node:test; PHPUnit/RSpec/dotnet/Maven; eslint/ruff/tsc/mypy/clippy; edge classes such as a green summary with a non-zero exit line, crashes, timeouts and contradictory summaries; adversarial content). Each was written by a model agent that was told not to read the repository, with an expected label of `met` or `missing`. A second agent labelled the evidence alone; a case is kept only when its label equals the author's. Rejected cases are listed in the results, not hidden. Ids start with `h2-`.

**Scoring.** Appended to `jev-evals/done-v2/` with `split: "holdout"`, recorded once with `eval record`, scored once with `eval score --split holdout`. Nothing is tuned on these cases first.

**Pass.** No wrong `met` (a `met` on an expected `missing` case), `missing` recall of 0.9 or better, and `met` found in at least 60% of expected `met` cases. A wrong `met` fails the check and is reported as such.

**After the first look.** If a parser or rule changes because of what these cases show, the cases that motivated it move to `dev`, the change is described in `docs/measurements.md`, and the remaining `h2-` cases are scored again as a regression check, not as a fresh hold-out.

**Limits.** Same model family wrote and labelled the cases; invented outputs may not match every real tool version; one Jev model version.
