# PHP agent summaries must not switch off the diagnostic cap

Registered 2026-10-19, before the code. Found while re-reading the PHP-stack `done` calls made after [php-agent-json.md](php-agent-json.md) went live. Chosen with the advisor tool first (a probe the assistant had not planned, a wrong `met`); the ship check is a Jev `decide`.

## Why (local data, aggregates only)

- Since the live install, 5 `done` calls on one real PHP project ran `composer test`. None was `met` (3 `missing`, 2 `unsure`), so the first look was at the guidance. The evidence of those five calls was not stored, so a stored log of an earlier `composer test` run of the same project (14 lines, before the PHP runners existed) was probed with invented criteria, temporary data directory, both models (`jev-1.13.0`, `jev-1.14.0`).
- That log holds the three agent JSON summaries (Pint, Rector, PHPStan), a formatter run, four `path:line:col: warning rule(...)` lines from a linter no parser reads (oxlint's agent format, printed by a wrapper), a silent type check and `exit code: 0`. Only the three JSON summaries reach Jev.
- `there are no lint warnings`: `met` 0.82 (1.13) and 0.84 (1.14). `lint is clean`: `met` 0.87 and 0.78. The code returned no reason. The log has four warnings, so both are wrong `met` (the error class with bar 0).
- Cause (`src/cli/commands/done.ts`): `diagnosticCap` needs `!lintCovered`, and `lintCovered` is true when any parsed runner covers the lint kind. `pint` and `phpstan` do (`RUNNER_KINDS`), but they only read a one-line JSON summary; they know nothing about diagnostic lines printed elsewhere in the log. Before the PHP runners existed this log was exit-code-only evidence and the word `warning` capped it (`warning_in_log`).
- php-agent-json.md says "The warning caps are not changed: a log whose other linter reports warnings still caps a lint or clean criterion at `unsure`". For this log that sentence was wrong from the first commit of the PHP runners.

## What

`lintCovered`, used only by `diagnosticCap`, ignores the three runners that read a one-line JSON summary (`pint`, `phpstan`, `rector`, the only parsers of those names). Every other parsed linter keeps vouching for the diagnostic lines of its own log (eslint, oxlint, ruff and the rest).

Effect: a parsed log of these summaries plus a linter diagnostic line (`path:line:col: warning|error ...`, a code diagnostic, a stylish row, a summary with a positive count) caps a lint or clean criterion at `unsure` (`warning_in_log`, the diagnostic next step). An exit-status criterion (`composer test exits with code 0`) is not a lint or clean criterion and is not touched.

## Bars

- **C1:** invented fixture of that log shape; `lint is clean`, `there are no lint warnings` and `phpstan reports no errors` at a stubbed answer of 0.98 give `unsure` with `warning_in_log`; `composer test exits with code 0` stays `met`.
- **C2:** the same summaries without any diagnostic line, and a log with only an exit code, give the same verdicts as before the change.
- **C3:** a parsed linter that prints its own diagnostics (an eslint or oxlint run with a summary) is unchanged; the existing cap tests stay green.
- **C4:** `ci:local` green and the recorded evals score unchanged.
- **C5:** replay over the locally stored evidence (counts only, in this document): how many stored logs hold an agent summary and a diagnostic line, and that none without a diagnostic line changes.
- **C6:** live probe on the stored real log, temporary data directory, both models: both lint-claim criteria above give `unsure` with `warning_in_log`.

## Cost, stated up front

A tool-named criterion such as `phpstan reports no errors` over a combined log that also holds another linter's warnings was `met` and is now `unsure`. That is the documented behaviour of [lint-cap-tool-names.md](lint-cap-tool-names.md) (a named linter is a clean claim); the next step already names the way out: run that linter on its own and pipe its output, or accept the warning in words.

Not measured: the effect on real calls (none yet after the fix). The replay in C5 is fitted to logs from one project.

## Result (2026-10-19)

Written after the code. C1 and C2 are tests (`test/php-agent-diagnostic-cap.test.ts`; the C1 test fails without the change, the rest pass either way); C5 and C6 ran once.

- **C5, replay over the 74 locally stored evidence logs** (counts only, stubbed answer 0.98, each log with its own stored criteria): 21 logs hold an agent summary, 15 of those also hold a diagnostic line, 9 change, all `met` to `unsure` with `warning_in_log`. The 53 logs without an agent summary and the 6 agent-summary logs without a diagnostic line are unchanged. Fitted to the logs of one project: a regression check, not a clean test.
- **C6, live probe on the stored real log** (temporary data directory, bundle rebuilt): `lint is clean` `unsure` 0.88 (1.13) and 0.76 (1.14); `there are no lint warnings` `unsure` 0.84 and 0.81; both `warning_in_log`. Before the change the same two criteria were `met` (0.87 and 0.78; 0.82 and 0.84).
- **Note (2026-10-20):** "An exit-status criterion is not touched" held only for criteria without a list of the script's steps. A replay of the same 74 logs on the code before and at this change finds that 5 of the 9 changed logs were exit-status criteria of the form `composer test (pint, rector, phpstan, vue-tsc) exits with code 0`, capped because the list names a linter; the other 4 are lint or clean claims. [script-tool-list.md](script-tool-list.md) lifts the cap for such a list.
- **Side finding, not fixed here:** `composer test exits with code 0` over the same log is Jev's call and moves between runs and models (`met` 0.79 on 1.13, `missing` 0.48 on 1.14; an earlier wording gave `met` 0.70 and `unsure` 0.52), because the facts sent to Jev do not name the command. `done --run` also answers `missing` to its default `all tests pass` on a `composer test` that runs no tests, with the generic "same output gives the same answer" next step.
- **Note (2026-10-21):** the cost above was narrowed by [named-linter-cap.md](named-linter-cap.md). A criterion that names only linters whose own parsed summaries are clean, with no lint, clean or no-warnings wording, is not capped by another tool's warnings. So `phpstan reports no errors` and `pint, phpstan and rector report no problems` over the C1 log are `met` again. `lint is clean` and `there are no lint warnings` stay `unsure`, so the wrong `met` this record closed stays closed.
