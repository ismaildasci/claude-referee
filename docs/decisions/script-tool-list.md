# `done`: a tool list after a script command is not a lint or test claim

Registered 2026-10-20, before the code. Found by replaying the locally stored `done` evidence through main before the owner's next live update, as the advisor tool asked (check what main already fixes before writing a parser). The ship check is a Jev `decide`.

## Why (local data, aggregates only)

- In the owner's PHP-stack sessions the usual criterion after `--run test` names the script and lists its steps in parentheses: `composer test (pint, rector, phpstan, vue-tsc) exits with code 0`. 11 of the 107 locally stored evidence logs carry a criterion of that form, all from one project, all over the same chain (three agent JSON summaries, a formatter run, four oxlint agent-format `path:line:col: warning` lines, a silent `vue-tsc`, `exit code: 0`).
- On main, the list trips the lint cap: it names `phpstan`, `pint` or `eslint`, or the step label `lint`, and `CLEAN_CRITERION` reads any of these as a lint or clean claim ([lint-cap-tool-names.md](lint-cap-tool-names.md), rule 1). Since [php-agent-diagnostic-cap.md](php-agent-diagnostic-cap.md) (not live yet) the oxlint lines then cap it at `unsure` with `warning_in_log`. In the same way `pint --test` in a list reads as a test claim and gives `no_tests_run`.
- Replay of those 11 logs on main with a stubbed answer of 0.98 and their stored criteria: 7 `unsure` with `warning_in_log`, 1 `unsure` with `no_tests_run`, 1 `unsure` with `warning_in_log` from a claim outside the parentheses (`; phpstan 0 hata`), 2 `met`. The 8 are capped by the list alone.
- Live probe on main, invented fixture of the same shape, temporary data directory, `jev-1.14.0`: piped, the list form is `unsure` 0.73 with `warning_in_log`; the live install (23436a9) gives `met` 0.77 for the same input. So the live update would turn the owner's most common passing criterion into a retry.
- The subject of "exits" in this form is the script, not a linter. [test-in-command-name.md](test-in-command-name.md) already removes a script runner's own `test` script name before the test-claim check for the same reason; its motivating real case was this list form, and the diagnostic cap brought the cap back for it.

## The rule

A parenthesised list directly after a script runner's command (`composer`, `npm`, `pnpm`, `yarn` or `make`, optional `run`, a script name; `bun run` and a script name) is the script's steps, not a claim, when it holds no claim wording: clean, warning, error, pass, fail, success, ok, `0`, no, zero, none, or `test`, `tests`, `testing` as a word on its own (`--test` is a flag). Such a list is removed before the lint or clean check and the test-claim check. Jev still sees the criterion as written. A list with claim wording, a linter named outside a list (`phpstan exits with code 0`) and every other cap are unchanged.

## Bars

- **S1 (tests):** on an invented log with agent summaries and oxlint agent-format warning lines, at a stubbed 0.98: `composer test (pint, rector, phpstan, vue-tsc) exits with code 0` and `composer test (pint --test, rector --dry-run, frontend lint, phpstan, tsc --noEmit) finished with exit code 0` are `met`; `composer test (lint clean) exits with code 0`, `composer test (no warnings) exits with code 0`, `phpstan exits with code 0`, `lint is clean` and `composer test (pint, phpstan) exits 0; phpstan 0 errors` stay `unsure` with `warning_in_log`; `composer test (all tests pass) exits with code 0` stays a test claim.
- **S2 (replay):** all 107 stored logs with their stored criteria at a stubbed 0.98: only logs whose criterion has such a list change (counts only, here).
- **S3:** `eval score --suite all --fail-on violated` output byte-identical before and after the build; `ci:local` green.
- **S4 (live probe, reported, not a bar):** the invented fixture, piped and with `done --run test`, on `jev-1.13.0` and `jev-1.14.0`. On main `--run test` with the list form was `unsure` 0.52 with `criterion_not_covered`, which is Jev's answer and not the cap, so this change may only help the piped path.

## Cost, stated up front

About 10 lines in `src/cli/commands/done.ts`. A criterion that hides a clean claim in a bare tool list (`composer test (eslint) exits with code 0` meant as "eslint is clean") is no longer capped; the exit status it states is still true, and a named linter outside a list keeps rule 1. Fitted to one project's criteria; the claim words are a fixed list, extended only from real criteria.

## Decision

Jev `decide` over three options (strip the list, no code and rely on the live update's next step, exempt every exit-status criterion): first ask `strip_tool_list` 0.66, `no_code` 0.33, `exempt_exit_status` 0.01 (weak, both orders agree, receipt `rmvgnnjypb174`); after one added fact on what each of the two leaders costs and how it is undone, 0.73, 0.25, 0.01 (weak, both orders agree, receipt `rmvgnnu29r3wn`). Below the 0.90 bar, so the reversible option was taken, as the project rule says and as the weak verdict's next step suggests (one commit, undone by a revert). The option costs were written by the assistant.

## Result (2026-10-20)

Written after the code.

- **S1:** `test/script-tool-list.test.ts` (3 tests). The test that lifts the list forms fails without the change; the tests that keep the caps pass either way. Claim words also cover the Turkish forms seen in the owner's criteria (hata, uyarı, temiz, geç, başarı, sıfır, yok). One existing assertion changed: [test-in-command-name.md](test-in-command-name.md)'s test required `composer test (pint, phpstan) exits with code 0` to stay capped over a parsed oxlint summary with warnings; it now uses `composer test and phpstan exit with code 0` (a linter named outside a list), and the list form moved to the new test as `met`. That is the one contract change.
- **S2:** replay over the 107 stored logs at a stubbed 0.98: 8 changed, all with a list-form criterion (7 `warning_in_log` and 1 `no_tests_run` to `met`); the other 99 unchanged, the 3 remaining list-form logs included.
- **S3:** `eval score --suite all --fail-on violated` output byte-identical before and after the build; `ci:local` green before the push.
- **S4 (live probe, invented fixture, temporary data directory, three fresh asks each for the first list form):** piped, `jev-1.14.0` `met` 3 of 3 (0.80 to 0.85), `jev-1.13.0` `met` 2 of 3 (0.66 to 0.72); the live install answers the same within noise (0.85 to 0.86; 0.63 to 0.71). With `done --run test` main answers `missing` 3 of 3 on both models (0.27 to 0.42 on 1.14, 0.33 to 0.40 on 1.13, `criterion_not_covered`), while the live install answers `met` (0.80 to 0.90; 0.72 to 0.80). The `--run` drop comes from the command-name fact of [done-ran-fact.md](done-ran-fact.md), not from a cap: Jev now knows `composer test` ran and sees no fact for the `vue-tsc` the list names, because a silent type check at the end of a parsed log reaches Jev as nothing. This change does not fix that; `composer test exits with code 0` stays `met` (0.99) under `--run`.

Limits: fitted to one project's criteria and one log shape; the `--run` drop above is open and is the next candidate (a fact for the silent type check that ends such a log).
