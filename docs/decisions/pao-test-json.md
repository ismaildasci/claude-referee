# Pest, PHPUnit and Paratest agent-format JSON are test runner facts

Registered 2026-10-25, before the code. Follows [php-agent-json.md](php-agent-json.md), which reads the same agent format for Pint, PHPStan and Rector, and [pest-runner-label.md](pest-runner-label.md). The ship check is a Jev `decide`.

## Why

- laravel/pao (v1.1.5, read from its source in a local `vendor/` folder) replaces the test output with one JSON line when it detects a coding agent (Claude Code included) or `PAO_FORCE` is set. Its `TestResultParsable` trait builds `{"tool":"pest"|"phpunit"|"paratest","result":"passed"|"failed","tests":N,"passed":N,"assertions":N,"duration_ms":N}`. It then appends `raw` (left-over lines, `["No tests found."]` when nothing ran), `failed` with `failures[]` (`test`, `file`, `line`, `message`, `trace`), `errors` with `error_details[]`, `skipped`, `incomplete`, `deprecations`, `warnings`, `notices`, `php_errors` with details, `risky`, `ignored_by_baseline` and `profile`, each only when above 0. `passed` is `tests - failed - errors - skipped`.
- `done` reads none of it. A passing pao Pest line with `exit code: 0` is exit-code-only evidence.
- Local stored logs (aggregates only): 2 pao Pest lines, both `passed` with 44 tests, both `missing` (0.03, 0.09) on criteria that say the suite passed. In both cases the next call piped the text output of the same run and got `met`, so each cost one more call. 3 local projects have pao in their lock file.

## The rule

The agent-format parser also reads objects whose tool is `pest`, `phpunit` or `paratest`, at the same positions as today (line start, a `N:` grep prefix, or glued after another summary). They are test runners, not lint summaries: not build-only and not in `SUMMARY_ONLY`, so their counts, zeros included, are sent.
- Facts: runner = the tool name. `failed` and `errors` from pao. `skipped` = `skipped` + `incomplete` + `risky`, as the PHPUnit text parser counts them, so the skip cap applies; `passed` is pao's `passed` minus `incomplete` and `risky` (pao counts those as passed), so passed and skipped never overlap. Failing names = the `test` field of `failures` and `error_details`, through the same list helper the other parsers use. A fixed summary sentence. `message`, `file`, `line`, `trace`, `raw` and the other detail arrays are never sent.
- `result: "failed"` with no failure or error count gives `errors: 1`.
- Deprecations, warnings and notices change no count, as in the PHPUnit text parser.
- An object that does not parse as JSON (cut by the evidence clip) keeps the failure its `result` shows and is marked incomplete, so it never reads as a full pass.
- More than one object of a tool: failures and names from all of them, counts from the last.
- `tests: 0` gives a run with nothing passed. The log's `No tests found.` raw line and the zero count keep it from `met`.

## Bars

- **Q1 (tests):** invented objects in pao's key order: passed, failed with failures and messages (no message, path or trace in the facts), errored, skipped/incomplete/risky (capped), no tests found (not `met`), glued after a Pint and a Rector summary, after a `N:` prefix, a clipped failing object (failing, incomplete), `result: failed` with no counts (`errors: 1`), text before the object on the line (not read). The kinds test lists `paratest`.
- **Q2 (replay, counts only):** every stored log and eval case through `parseEvidence`. Only logs with a pao test object change (expected: the 2 above).
- **Q3 (evals):** `eval score --suite all` unchanged for the existing cases. New recorded cases in `done-pest` (a passing pao line `met`, a failing one and a no-tests one not `met`), 0 wrong `met`.
- **Q4 (live probe, reported):** the invented passing and failing pao lines under a criterion that names Pest and under `all tests pass`, three fresh asks per model, before and after.
- **Q5:** `ci:local` green.

## Cost, stated up front

About 40 lines in `src/engine/runners/php-agent.ts`, one runner kind (`paratest`), and tests. Failing test names from pao go to Jev, as failing names from every other test parser already do ([privacy.md](../privacy.md) lists failing test names). Fitted to pao 1.1.5's source; only `pest` has real samples here (2 stored logs, one project); `phpunit` and `paratest` share the same code in pao and were not run.

## Decision

Jev `decide` over three options (all three tools; `pest` only; no code), with each option's cost and how it is undone in the context: `pao_tests` 0.92, `pest_only` 0.06, `no_code` 0.02 (clear, both orders agree, receipt `rmvo32znd5nh7`). The option costs were written by the assistant.

## Result (2026-10-25)

Written after the code.

- **Q1:** `test/runners-pao-tests.test.ts` (4 tests, all failing before the change): passed, failed (names, no message or path in the facts), errored (`phpunit`), skipped/incomplete/risky (`paratest`, `skipped_tests`), deprecations (no count change), no tests found (not `met`), `result: failed` with no counts (`errors: 1`), glued after Pint and Rector, a `12:` prefix, text before the object (not read), a clipped failing object (failing, incomplete), two objects (failures from both, counts from the last). `paratest` is a runner kind. The `SUMMARY_ONLY` test now says the non-test runners of `php-agent.ts`, and lists the three test runners apart.
- **Q2:** 744 texts (390 eval cases with evidence, 354 stored logs) through `parseEvidence`, before the new eval cases: 2 changed, the two pao Pest logs, `exit_code` to `parsed` (`pest`, 44 passed). Run again after adding them: 748 texts, 5 changed, the same 2 logs and the 3 new cases.
- **Q3:** `eval score --suite all --fail-on violated` identical for every existing case. `done-pest` gains `dp-07` (passing pao line, 0.98 `met`), `dp-08` (failing pao line with a hand-written exit code 0, 0.02) and `dp-09` (no tests found, 0.12; capped `no_tests_run`); 9 cases, pass, 0 wrong `met` (receipt `rmvo32k8nkoew`).
- **Q4 (live probe, invented pao lines, piped, temporary data directory, three fresh asks each):**

| criterion, fixture | jev-1.13.0 before | jev-1.13.0 after | jev-1.14.0 before | jev-1.14.0 after |
| --- | --- | --- | --- | --- |
| `The Pest suite passes with no failed tests and exit code 0`, passing | missing 0.27-0.30 | met 0.98 | missing 0.10-0.13 | met 0.99 |
| `all tests pass`, passing | missing 0.26-0.28 | met 0.97 | missing 0.09-0.15 | met 0.99 |
| `The Pest suite passes with no failed tests and exit code 0`, 2 failing | missing 0.29-0.32 | missing 0.01-0.02 | missing 0.10-0.11 | missing 0.01 |

No wrong `met`. `phpunit` and `paratest` are read from pao's source only; no real sample of either was run.
