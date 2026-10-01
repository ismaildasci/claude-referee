# done v2: a fourth hold-out set

Registered 2026-10-01 before any new case is sent to Jev; the git commit that first contains this file is the registration.

**Why.** The [second](done-v2-holdout2.md) and [third](done-v2-holdout3.md) hold-outs failed their registered checks; six parsers, a skipped-tests cap and PHPUnit risky/incomplete counting were added afterwards and the cases they changed moved to dev. 0.1.5 was released with `done` v2 stated as not measured. A fresh hold-out is the only way to measure it.

**Labelling convention, fixed now.** Skipped, risky, incomplete or pending tests mean "all tests pass" is not shown (expected `missing`). A warning or notice means "lint is clean" is not shown (expected `missing`); a warning does not change "the build succeeds" or "typecheck passes" (expected `met` when the exit code is 0 and no error is printed). A non-zero exit code is always `missing`. These match what the code does; the second labeller is told the same.

**Cases.** Up to 48 invented outputs, 8 for each of six assignments, written by agents that were told not to read the repository or any `jev-evals` directory, and labelled again by a second agent; a case is kept only when the two labels agree (rejects are listed). The assignments mix tools the parsers cover and tools they don't (Maven and Gradle, `pylint`, `rubocop`, `phpstan`, `ctest`, `bazel`, `sbt`, `swift test`, `deno test`, `bun test`), plus adversarial and edge classes. Ids start with `h4-`.

**Scoring.** One suite, `jev-evals/done-v2-h4`, `split: "holdout"`, recorded once, scored once. Nothing is tuned on these cases first.

**Pass.** No wrong `met`, `missing` recall of 0.9 or better, `met` found in at least 60% of expected `met` cases. If a case is later used to change a parser or rule, it moves to `dev` and the rest are reported as a regression check only.

**Limits.** The same model family writes and labels; invented outputs; one Jev model version.
