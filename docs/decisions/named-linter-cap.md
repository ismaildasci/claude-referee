# `done`: a criterion that names only clean parsed linters is not capped by another tool's warnings

Registered 2026-10-21, before the code. Narrows the cost [php-agent-diagnostic-cap.md](php-agent-diagnostic-cap.md) accepted. Found by replaying the stored logs through the live install's build (`23436a9`), the commits before and at `174a08c`, and main. The advisor tool proposed the per-criterion scope and the bars. The ship check is a Jev `decide`.

## Why (local data, aggregates only)

- 153 locally stored evidence logs went through each build's `doneRequest` with their own stored criteria, at a stubbed answer of 0.98. For 10 of them the live build gives `met` and main gives `unsure` (`warning_in_log`). All 10 have the same shape: the owner's `composer test` log with three PHP agent summaries, a formatter run, four oxlint agent-format warning lines, a silent type check and `exit code: 0`. `174a08c` caps 19 stored logs of this shape. [script-tool-list.md](script-tool-list.md) (`20c98a1`) lifts the plain step lists, which leaves these 10.
- 5 of the 10 use generic lint wording: `vp fmt/lint`, `lint/typecheck`, `vp lint only warnings`, a Turkish "lint warnings are not errors". These stay capped.
- The other 5 name only Pint and PHPStan, plus Rector, which is not a linter, with no generic wording. Examples: `pint passed, rector 0 errors, phpstan 0 errors` and `phpstan reported 0 errors and rector totals report 0 changed files`. The parsed summaries of both linters are clean, and the four warnings come from oxlint, which the criteria do not name.
- Two of those 5 were `met` on the live install (Jev 0.90 and 0.73), and the log supports them. The live update would turn both into `unsure`. A third is the criterion [php-agent-zero-counts.md](php-agent-zero-counts.md) measured at `met` 0.96 to 0.98. That probe used fixtures without warning lines, and the runner facts are the same on this log, but on this log the code caps it at `unsure`.
- Cause (`src/cli/commands/done.ts`): a criterion is capped when the warning cap holds and `CLEAN_CRITERION` matches. `CLEAN_CRITERION` matches every linter name ([lint-cap-tool-names.md](lint-cap-tool-names.md)). That rule dates from a time when the named tool usually had no parser, so a warning in the log was likely its own. When the named linter's own summary is parsed and clean, the warning belongs to another tool.

### Measured, not built

Before this registration, the remaining parts of the same log were probed: facts for the formatter line, the oxlint agent lines and the silent type check. The request was edited by hand, with invented fixtures and three fresh asks per variant. Criteria were the list form `composer test (pint, rector, vp fmt, vp lint, phpstan, vue-tsc) exits with code 0` and the same with `and reports no errors`.

| variant | 1.13 | 1.14 |
| --- | --- | --- |
| main, piped | 0.39 to 0.65 | 0.25 to 0.54 |
| main, under `done --run` | 0.53 to 0.72 | 0.38 to 0.84 |
| formatter fact only | 0.37 to 0.61 | 0.28 to 0.46 |
| formatter and oxlint facts | 0.33 to 0.50 | 0.44 to 0.60 |
| all three, piped | 0.83 to 0.87 | 0.85 to 0.91 |
| all three, under `done --run` | 0.84 to 0.91 | 0.86 to 0.94 |

The gain needs the type check fact, and that fact is read only under `done --run` ([run-silent-typecheck-tail.md](run-silent-typecheck-tail.md)). Of the 8 stored `--run` calls on this log, 7 used the default `all tests pass`, which is correctly `missing`. So these facts would reach almost no real call, and they were not built. Real output of oxfmt 0.55 and oxlint 1.70 (clean, failing, agent format) was captured on a scratch project for later use.

## The rule

A lint or clean criterion is not capped for warnings (`warning_in_log`) when all of these hold, after the step-list strip:

- the evidence is parsed;
- the criterion has no generic wording (`lint…`, `clean`, `warning-free`, `no warnings`);
- it names at least one linter from `LINTERS`;
- every linter it names is a parsed runner whose facts are clean: `failed`, `errors` and `warnings` are 0 and the run is not incomplete.

Nothing else changes:
- generic lint or clean criteria;
- a named linter with no parser, or one with warnings or errors;
- exit-code-only evidence, whose wording cap needs exit-code trust;
- the conflict, incomplete, skip and no-tests caps;
- the facts sent to Jev, so no request changes.

## Bars

- **N1 (tests, invented fixture of the composer shape, stubbed 0.98).**
  - Reach `met`: `phpstan reports no errors`, `pint passed, rector 0 errors, phpstan 0 errors` and `pint, phpstan and rector report no problems`.
  - Stay `unsure` with `warning_in_log`: `lint is clean`, `there are no lint warnings` and `vp fmt/lint without errors`.
  - Stay capped, with oxlint parsed at 4 warnings: `oxlint reports 0 errors`.
  - Stays capped: stylelint's `⚠ 1 problem (0 errors, 1 warning)` next to a clean oxlint run, with `stylelint and oxlint pass`.
  - A Pint `fixed` run with `pint passed` stays `unsure` (`incomplete_run`).
  - PHPStan with 2 errors is not `met`.
  - `["lint is clean", "phpstan reports no errors"]` gives criterion 1 `unsure` and criterion 2 `met`, overall `unsure` with `warning_in_log`.
- **N2 (replay, counts only).** The 153 stored logs go through main and through the change.
  - Sent states change 0 times.
  - At stubbed 0.98, 0.6 and 0.1, results move only for logs whose criteria name only clean parsed linters. Expected: the 5 above at 0.98, none at 0.6 or 0.1.
- **N3.** The `eval score --suite all --fail-on violated` output is diffed before and after, and any change is reported. `ci:local` is green.
- **N4 (no live probe).** The request is unchanged, so Jev's answer does not move. The receipts' p values and the zero-count probe numbers stand.

## Cost, stated up front

- About 6 lines in `src/cli/commands/done.ts`.
- The C1 bar of [php-agent-diagnostic-cap.md](php-agent-diagnostic-cap.md) changes: `phpstan reports no errors` and `pint, phpstan and rector report no problems` over the combined log go from `unsure` back to `met`. That reverses part of its stated cost. Its wrong `met` (`lint is clean`, `there are no lint warnings`) stays closed.
- Added after the first test run, before the second `decide`: the existing tests of three more records assert the old cap for the same class of criterion over a log with another tool's warnings, and they change from `unsure` to `met`.
  - [script-tool-list.md](script-tool-list.md) S1: `phpstan exits with code 0`, `composer test (phpstan 0 errors) exits with code 0`, `composer test (pint, phpstan) exits 0; phpstan 0 errors`, `composer test and phpstan exit with code 0`, and its list-not-after-a-command fixture, which names pint and phpstan.
  - [test-in-command-name.md](test-in-command-name.md): `composer test and phpstan exit with code 0`.
  - [php-agent-json.md](php-agent-json.md): `phpstan reports no errors` next to an oxlint summary with 4 warnings. That record says such tool-named criteria "are the case this change is for".

  Each of those tests keeps its cap check with a linter that is not parsed or not clean (oxlint, eslint), and the PHPStan forms move to `met` assertions.
- Risk: a named linter whose parsed summary is clean while the same tool printed warnings elsewhere in the log, in another format (two runs). That would read as `met` where today it is `unsure`. The rule only checks the parsed facts.
- Fitted to one project's logs.

## Decision

Jev `decide` over three options, with this registration and a cost note as context:
- the named-linter exemption;
- reverting the `SUMMARY_ONLY` exclusion of `174a08c`, which reopens its wrong `met`;
- no code.

First ask: `named_linter_exemption` 1.00, the others 0.00. Clear, both orders agree, receipt `rmvib0s1phq9g`.

The first test run then showed the other records' assertions listed under the cost. The note was extended with them and with the measured N2 and N3. Asked again: 1.00, the others 0.00, clear, both orders agree, receipt `rmvib7ul3f07z`. The option costs were written by the assistant.

## Result (2026-10-21)

Written after the code.

- **N1:** `test/named-linter-cap.test.ts` has 4 tests. The two that lift a verdict fail without the change. The two that pin the caps pass either way. The assertions of the three records listed under the cost were changed as described there. The full suite passes, 1221 of 1221.
- **N2:** the 153 stored logs went through `doneRequest` at `4c39c4c` and with the change. 0 sent states changed. At a stubbed 0.98, 5 results moved, all `unsure` (`warning_in_log`) to `met`, and they are exactly the 5 named under Why. 0 results moved at 0.6 and at 0.1.
- **N3:** the `eval score --suite all --fail-on violated` output is byte-identical before and after the build. So is each done suite's own score: verdict counts, precision and recall. `ci:local` result: see the commit's CI.
- **N4:** no live probe, as registered. The request is unchanged.

Limits:
- The rule trusts a named linter's parsed summary over every other line in the log.
- The 5 criteria with generic lint wording over the same log stay `unsure`, although they claim no errors and the log has only warnings.
- Fitted to one project's logs.
