# `done`: no zero test counts in Pint, PHPStan and Rector facts

Registered 2026-10-21, before the code. Follows [php-agent-json.md](php-agent-json.md); the advisor tool proposed the three-runner scope and the failure probes. The ship check is a Jev `decide`.

## Why (local data, aggregates only)

- 38 of the 117 locally stored evidence logs hold a Pint, PHPStan or Rector agent summary; all 38 passed with exit code 0. Their receipts: 9 `met`, 7 `unsure`, 22 `missing`. Of the 22, 6 are `all tests pass` over a log with no test run, which is the right answer.
- These runners carry no test results, but their facts still hold `passed: 0, failed: 0, skipped: 0`, the shape of a test runner that ran nothing. A stored log whose three summaries all passed (pint no style issues, phpstan no errors, rector nothing to change), sent as facts with `pint passed, rector 0 errors, phpstan 0 errors`, was `unsure` 0.59 on `jev-1.14.0`.
- Probe before the code: that request was edited by hand and sent again, three fresh asks per variant, no log text, no path and no real criterion in it (the facts are counts and fixed sentences). Criteria `pint passed`, `pint, rector and phpstan pass`, `pint passed, rector 0 errors, phpstan 0 errors`:
  - as sent today: 0.49 to 0.68 on `jev-1.14.0`, 0.67 to 0.74 on `jev-1.13.0` (the last criterion; the others were asked on 1.14 only);
  - with every zero `passed`, `failed` and `skipped` left out of these three runners' facts: 0.98 to 0.99 on 1.14, 0.97 on 1.13;
  - with the counts kept and the Pint sentence worded `pint result passed: no style issues`: 0.59 to 0.88.
- The same edit on other runners gains little: a silent eslint `lint is clean` 0.92 to 0.94 becomes 0.98, a vite build `the build succeeds` 0.95 to 0.96 becomes 0.98, a silent `vue-tsc` under `--run` (`the typecheck passes`) 0.94 to 0.95 becomes 0.97 to 0.99. 35 recorded eval cases in 10 suites carry such a runner and would need recording again; no recorded case carries Pint, PHPStan or Rector.
- Rector's array is not a change list: in Rector 2.4.2 `JsonOutputFactory` fills `changed_files` from every file diff, empty ones too, and `totals.changed_files` counts the files that change; the PHP agent wrapper sets `result` from the totals. A log with `totals.changed_files: 0` and a long array is a dry run with nothing to change, as the parser reads it.

## The rule

When `done` sends facts to Jev, a `pint`, `phpstan` or `rector` runner leaves out `passed`, `failed` and `skipped` when they are 0. A count above 0 stays (Rector's would-change files are its `failed`). Parsing, the facts kept in code, the caps, the receipts, the `runners` output and every other runner are unchanged. Fewer keys leave the machine.

## Bars

- **Z1 (tests):** on invented logs, the sent facts of these three runners have no zero `passed`, `failed` or `skipped`; Rector's non-zero `failed` stays; an eslint, vite, oxlint or node:test runner next to them keeps all its keys; at a stubbed answer the caps give the same verdicts as before (`warning_in_log`, `no_tests_run`, `incomplete_run`, a conflict).
- **Z2 (replay, counts only):** the 117 stored logs through `doneRequest` before and after: only the 38 logs with these runners change, and only by those keys.
- **Z3:** `eval score --suite all --fail-on violated` output byte-identical; `ci:local` green.
- **Z4 (live probe, invented fixtures, three fresh asks per model, `jev-1.13.0` and `jev-1.14.0`):** the three passing criteria above reach `met`. None of these reaches `met` (p 0.70): Pint `failed` or `fixed` with `pint passed`; PHPStan with 2 errors and `phpstan 0 errors`; Rector with 3 files to change and `rector passed` or `pint, rector and phpstan pass`; PHPStan failed next to passing Pint and Rector with `pint, rector and phpstan pass`. `all tests pass` over a log of only passing summaries stays `missing` (below 0.5). Measured before the code with the edited request: the worst failure answer was 0.51 (Pint `fixed`, 1.13; that run is capped at `unsure` in code anyway), `all tests pass` 0.25 to 0.39.

## Cost, stated up front

About 3 lines in `src/cli/commands/done.ts` and one test. Jev reads a `fixed` Pint run more kindly (1.13: 0.11 to 0.44 to 0.51), so its verdict can move from `missing` to `unsure`; the existing incomplete cap keeps it below `met`. Fitted to one project's logs; eslint, vite and the other build-only runners keep their zero counts until their recorded cases are worth recording again.

## Decision

Jev `decide` over four options (zero counts left out for these three runners; the same for every build-only runner; a reworded Pint sentence with the counts kept; no code), with this registration and a cost note as context: `drop_zero_php` 1.00, the others 0.00 (clear, both orders agree, receipt `rmvhqw5q95nj9`). The option costs were written by the assistant.

## Result (2026-10-21)

Written after the code.

- **Z1:** `test/php-agent-zero-counts.test.ts` (3 tests; the first two fail without the change, the third pins the caps and passes on both).
- **Z2:** 117 stored logs through `doneRequest` at `930faf9` and with the change: 38 requests changed, all 38 only by these keys; 0 results changed at stubbed answers of 0.98, 0.6 and 0.1 (verdict, reason, next step, per-criterion entries).
- **Z3:** `eval score --suite all --fail-on violated` output byte-identical before and after the build.
- **Z4 (live probe, invented fixtures, `done --fresh` through the bundle, temporary data directory, three asks each):**

| fixture and criterion | `930faf9`, 1.13 | `930faf9`, 1.14 | change, 1.13 | change, 1.14 |
| --- | --- | --- | --- | --- |
| three passing summaries, `pint passed` | `unsure` 0.57 to 0.59 | `unsure` 0.52 to 0.59 | `met` 0.96 | `met` 0.98 |
| same, `pint, rector and phpstan pass` | `met` 0.74 to 0.82 | `unsure` 0.56 to 0.58 | `met` 0.96 | `met` 0.98 |
| same, `pint passed, rector 0 errors, phpstan 0 errors` | 0.66 to 0.71 (2 `met`, 1 `unsure`) | `unsure` 0.55 to 0.65 | `met` 0.96 to 0.97 | `met` 0.98 |
| same, `all tests pass` | `missing` 0.21 to 0.23 | `missing` 0.09 to 0.10 | `missing` 0.40 to 0.47 | `missing` 0.24 to 0.31 |
| Pint `fixed`, `pint passed` | `missing` 0.11 to 0.13 | `missing` 0.06 to 0.09 | `missing` 0.43 to 0.49 | `missing` 0.19 to 0.26 |

  On the change only: Pint `failed` 0.01 to 0.02, PHPStan with 2 errors 0.01 to 0.02, Rector with 3 files to change 0.03 to 0.11 (`rector passed`) and 0.04 to 0.24 (`pint, rector and phpstan pass`), PHPStan failed next to passing Pint and Rector 0.02 to 0.06, all `missing`. No failure fixture reached `met`.

Limits: invented fixtures of one project's shape, a probe and not a test on unseen logs. `all tests pass` and a `fixed` Pint run sit closer to the 0.5 line on 1.13 (at most 0.47 and 0.49); crossing it would make them `unsure` with their existing reason, never `met`. Real calls on that project will show it after the live update.
