# done v2: a third hold-out set

Registered 2026-10-01 before any new case is sent to Jev; the git commit that first contains this file is the registration.

**Why.** [The second hold-out](done-v2-holdout2.md) failed its registered check with one wrong `met`; two parsers (Python `unittest`, `cargo clippy`) were added afterwards and its four motivating cases moved to dev. A fresh hold-out is needed before `done` v2 is called measured.

**Cases.** Up to 48 invented outputs, 8 for each of six assignments, written by agents that were told not to read the repository and labelled again by a second agent; a case is kept only when the two labels agree (rejects are listed). The assignments now include the two new parsers and lint warnings: unittest and nose-style output, `cargo clippy` and `cargo build` warnings, `golangci-lint`, `rubocop`, `phpstan`, `mypy`, a green summary with a warning count under "lint is clean", and the same adversarial and edge classes as before. Ids start with `h3-`.

**Scoring.** One suite, `jev-evals/done-v2-h3`, `split: "holdout"`, recorded once, scored once. Nothing is tuned on these cases first.

**Pass.** Unchanged from the second hold-out: no wrong `met`, `missing` recall of 0.9 or better, `met` found in at least 60% of expected `met` cases. If any case is later used to change a parser or rule, it moves to `dev` and the rest are reported as a regression check only.

**Limits.** Same model family writes and labels; invented outputs; one Jev model version.
