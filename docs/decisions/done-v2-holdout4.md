# done v2: a fourth hold-out set

Registered 2026-10-01 before any new case is sent to Jev; the git commit that first contains this file is the registration.

**Why.** The [second](done-v2-holdout2.md) and [third](done-v2-holdout3.md) hold-outs failed their registered checks; six parsers, a skipped-tests cap and PHPUnit risky/incomplete counting were added afterwards and the cases they changed moved to dev. 0.1.5 was released with `done` v2 stated as not measured. A fresh hold-out is the only way to measure it.

**Labelling convention, fixed now.** Skipped, risky, incomplete or pending tests mean "all tests pass" is not shown (expected `missing`). A warning or notice means "lint is clean" is not shown (expected `missing`); a warning does not change "the build succeeds" or "typecheck passes" (expected `met` when the exit code is 0 and no error is printed). A non-zero exit code is always `missing`. These match what the code does; the second labeller is told the same.

**Cases.** Up to 48 invented outputs, 8 for each of six assignments, written by agents that were told not to read the repository or any `jev-evals` directory, and labelled again by a second agent; a case is kept only when the two labels agree (rejects are listed). The assignments mix tools the parsers cover and tools they don't (Maven and Gradle, `pylint`, `rubocop`, `phpstan`, `ctest`, `bazel`, `sbt`, `swift test`, `deno test`, `bun test`), plus adversarial and edge classes. Ids start with `h4-`.

**Scoring.** One suite, `jev-evals/done-v2-h4`, `split: "holdout"`, recorded once, scored once. Nothing is tuned on these cases first.

**Pass.** No wrong `met`, `missing` recall of 0.9 or better, `met` found in at least 60% of expected `met` cases. If a case is later used to change a parser or rule, it moves to `dev` and the rest are reported as a regression check only.

**Limits.** The same model family writes and labels; invented outputs; one Jev model version.

## Result (2026-10-01)

Of 48 cases written, 47 survived the second labeller (21 `met`, 26 `missing`); rejected: `h4-a-02` (a flaky test that passed on rerun; the labeller applied the convention strictly). Recorded once, scored once (`jev-evals/done-v2-h4`).

**The registered check failed on all three counts.** 2 wrong `met`: `h4-d-03` (a `rubocop` run with a baseline notice under "lint is clean", p 0.91) and `h4-a-04` (an `sbt` run saying "No tests to run", p 0.72), both with an exit code of 0 and no recognised runner, so Jev saw only the exit code. `missing` found in 20 of 26 (0.77) and `met` found in 12 of 21 (0.57).

**What it shows.** 11 of the 15 misses are runs where no parser matched (Maven surefire, `ctest`, `meson`, `deno`, `ava`, `rake test`, Gradle, `sbt`): every hold-out finds a new set of tools, so parser coverage is a long tail. Across all four invented sets, the cases answered `met` at p 0.7 or more on an exit code alone were 17, of which 15 true and 2 wrong (both from this set).

**Decision.** Jev was asked which code-side cap to add for exit-code-only evidence: no cap scored 0.01, a cap on "no tests ran" phrases alone 0.59 and the same plus warning words 0.39 (a tie, orders disagreed). The part both leading options share was applied: **`met` is capped at `unsure` in code when the log says no tests ran** (`no tests to run`, `no tests found`, `0 tests executed`, `Tests run: 0`, `nothing to run`; `reason: "no_tests_run"`), which costs no true `met` in the data. The warning-words cap would remove the rubocop case but turn 7 of 15 found true `met` into `unsure`; it is not applied. `h4-a-04` moved to `done-v2` as `dev`; the suite's allowance is the one remaining wrong `met` (`h4-d-03`).

**Consequence.** `done` v2 is not called measured. Four hold-outs, none passed. The open question is whether an exit code alone should ever give `met` for a "tests pass" or "lint is clean" criterion.
