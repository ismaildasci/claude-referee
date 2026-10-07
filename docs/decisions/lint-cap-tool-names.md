# The lint warning cap for criteria that name the linter, and an oxlint parser

Registered 2026-10-07, before any code change or replay.

## Why

A local analysis of real use on the maintainer's machine (other projects, aggregate counts only) found that the lint warning cap never fired for criteria such as "oxlint exits with code 0" or "eslint passes": `CLEAN_CRITERION` in `src/cli/commands/done.ts` matches `lint` only as a whole word, so `oxlint` and `eslint` do not match. 58 of 71 lint criteria named the tool without a standalone "lint" word. oxlint has no parser, so its output is exit-code-only evidence; 29 of 40 single-tool oxlint `done` calls got `met` on the exit code alone, while the same transcripts hold 402 oxlint summaries with warnings against 75 clean ones. Some of those criteria were worded as an exit status, so how many of the 29 are wrong `met` is not known. Combined logs (tests, build and lint in one evidence) were answered from the test runner's facts alone: 13 such calls came back `missing` with no hint that the other checks never reached Jev.

Chosen with `decide` over four other improvements from the same analysis: round 1 `stop_background` 0.57, `lint_cap` 0.40 (weak, receipt `rmuy1qgdzitov`); round 2, with the oxlint and gating facts added, `lint_cap` 0.96, both orders agreeing (receipt `rmuy1r5qvccvi`).

## Rules

1. A criterion that names a linter counts as a lint criterion for the existing warning cap: `oxlint`, `eslint`, `biome`, `ruff`, `phpstan`, `pint`, `stylelint`, `golangci-lint`, `clippy`, `rubocop`, `phpcs`, `flake8`, `pylint`, `shellcheck`, `markdownlint`, plus every existing match. Nothing else in the cap changes: it still fires only on `met`, only with warning or problem wording in the log (or parsed warnings), and gives `reason: "warning_in_log"`. A criterion worded as an exit status that names a linter is capped too; the next step already tells the user to pipe the full summary or say the warning is acceptable.
2. An `oxlint` parser, written from real oxlint output captured on this machine (summary `Found N warnings and M errors.` and the `Finished in ...` line, per-diagnostic lines). Errors count as errors, warnings as warnings; a log with neither summary is not claimed.
3. When the parsed runners do not cover a criterion's kind (a lint, build or typecheck criterion with only a test runner parsed), the result says so with a reason and a next step to run that check on its own. Verdicts do not change from this rule.

## What will be reported, and the bar

- Replay on every recorded `done` suite (`eval score --suite all`): verdict changes per suite, and whether any recorded case's facts sent to Jev change (rule 2 can only change facts for logs that oxlint's parser claims). Bar: no case moves to `met`; every allowance stays as it is.
- Replay on the local real-use `done` calls whose evidence text is visible in the transcripts: counts of `met` moved to `unsure` by rule 1, split by whether the log had warning wording. Aggregate numbers only; no project names, paths or text.
- Rules 1 and 3 can only lower a verdict or add a reason. Rule 2 sends parsed facts instead of an exit line, so for oxlint logs Jev's answer can change in either direction; any new `met` on a log with warnings or errors fails the bar.

This is a fix toward the documented rule, fitted to cases seen in real use, not a clean test.
