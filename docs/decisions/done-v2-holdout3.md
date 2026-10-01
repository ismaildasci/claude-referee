# done v2: a third hold-out set

Registered 2026-10-01 before any new case is sent to Jev; the git commit that first contains this file is the registration.

**Why.** [The second hold-out](done-v2-holdout2.md) failed its registered check with one wrong `met`; two parsers (Python `unittest`, `cargo clippy`) were added afterwards and its four motivating cases moved to dev. A fresh hold-out is needed before `done` v2 is called measured.

**Cases.** Up to 48 invented outputs, 8 for each of six assignments, written by agents that were told not to read the repository and labelled again by a second agent; a case is kept only when the two labels agree (rejects are listed). The assignments now include the two new parsers and lint warnings: unittest and nose-style output, `cargo clippy` and `cargo build` warnings, `golangci-lint`, `rubocop`, `phpstan`, `mypy`, a green summary with a warning count under "lint is clean", and the same adversarial and edge classes as before. Ids start with `h3-`.

**Scoring.** One suite, `jev-evals/done-v2-h3`, `split: "holdout"`, recorded once, scored once. Nothing is tuned on these cases first.

**Pass.** Unchanged from the second hold-out: no wrong `met`, `missing` recall of 0.9 or better, `met` found in at least 60% of expected `met` cases. If any case is later used to change a parser or rule, it moves to `dev` and the rest are reported as a regression check only.

**Limits.** Same model family writes and labels; invented outputs; one Jev model version.

## Result (2026-10-01)

Of 48 cases written, 46 survived the second labeller (20 `met`, 26 `missing`); rejected: `h3-e-03` (pending examples under a green summary) and `h3-e-06` (a flaky test that passed on retry), both "ambiguous". Recorded once, scored once (`jev-evals/done-v2-h3`).

**The registered check failed on all three counts.** 2 wrong `met`: `h3-e-01` (PHPUnit with risky and incomplete tests, p 0.94) and `h3-e-04` (dotnet with a skipped class, p 0.86), both labelled `missing`. `missing` found in 23 of 26 (0.88, below 0.9). `met` found in 10 of 20 (0.50, below 0.6).

What the misses look like: 7 of the 10 missed true `met` cases were evidence with an exit code and no recognised runner (`golangci-lint`, `tsc -b`, `node --test`, a Vite build, ANSI-coloured output), where Jev only sees an exit code and its label and answered `missing` or `unsure` (p 0.20 to 0.64); the other three are a clippy-clean run (parsed, p 0.25), an `OK (expected failures=1)` unittest run (0.64) and a run with two tools where one printed a warning-level exit line (decided in code). The two wrong `met` are both about skipped or risky tests under "all tests pass": the same author set labelled a unittest run `OK (skipped=2)` as `met` and a dotnet run with a skipped class as `missing`, so the labels themselves are not consistent about what skipped tests mean.

**Consequence.** `done` v2 is not called measured, and neither hold-out passed. The suite's allowance is the 2 observed wrong `met`, as bookkeeping. No parser or rule was changed because of these cases, so they stay hold-out. Before another hold-out: decide what skipped, risky and incomplete tests mean for "all tests pass" (a policy for the question, written down), and what an exit code alone is worth (`trust: exit_code` currently gives Jev the exit code and its label only).
