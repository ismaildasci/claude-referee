# done v2: a fifth hold-out set

Registered 2026-10-01 before any new case is sent to Jev; the git commit that first contains this file is the registration.

**Why.** The [fourth hold-out](done-v2-holdout4.md) failed its registered check; a no-tests-ran cap and a narrow lint-warning cap were added afterwards and the case behind the cap moved to dev. `done` v2 is still stated as not measured. A fresh hold-out is the only way to measure it. The same method is repeated unchanged.

**Labelling convention, unchanged from the fourth.** Skipped, risky, incomplete or pending tests mean "all tests pass" is not shown (expected `missing`). A warning or notice means "lint is clean" is not shown (expected `missing`); a warning does not change "the build succeeds" or "typecheck passes" (expected `met` when the exit code is 0 and no error is printed). A non-zero exit code is always `missing`.

**Cases.** About 45 invented outputs in six groups, ids start with `h5-`. The groups use tools and formats that appear in none of the earlier sets (checked against the case variants of `done-v2`, `done-v2-h2`, `-h3`, `-h4`): `cargo nextest`, Elixir `mix`, Perl `prove`, Lua `busted`, Dart and Flutter, OCaml `dune`, R `testthat`, Julia, Haskell `stack` and `cabal`, `xcodebuild`, `behave`, `cucumber-js`, `kaocha`, `shellcheck`, `hadolint`, `yamllint`, `markdownlint`, `biome`, `detekt`, `pyright`, `svelte-check`, `next build`, `nix build`, `esbuild`, `msbuild`, `rollup`, `gcc -Werror`, `tox`, `pre-commit`, GitHub Actions matrix logs, docker compose, JUnit XML. Plus adversarial and edge classes (a note aimed at the judge, a forged summary or exit line, a test named after a verdict, a swallowed exit code, CRLF and non-English output, a crash after the summary).

**Labelling, with a limit.** This run had no second agent to relabel with, so one author wrote and labelled every case against the convention above; each case was then re-read once against the convention before anything was sent, and any case whose label was arguable is dropped and listed (rejects are listed in the result). The fourth set kept only cases two labellers agreed on; this one is weaker on that point and the result says so.

**Scoring.** One suite, `jev-evals/done-v2-h5`, `split: "holdout"`, recorded once with `eval record`, scored once with `eval score`. Nothing is tuned on these cases first. The key is read from the keychain; `doctor` checks that it resolves and it is never printed.

**Pass.** Unchanged: no wrong `met`, `missing` recall of 0.9 or better, `met` found in at least 60% of expected `met` cases. If a case is later used to change a parser or rule, it moves to `dev` and the rest are reported as a regression check only. If the check fails, the suite's allowance is set to the observed wrong `met` count (as in the earlier sets) and the result is reported as a failure.

**Limits.** The same model family writes and labels; one labeller; invented outputs; one Jev model version.
