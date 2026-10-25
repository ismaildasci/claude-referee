# Pest output is labelled `pest`, not `jest`

Registered 2026-10-25, before the code. Found while re-reading the local `done` receipts and stored evidence since 2026-10-19 (aggregates only). It reverses rule 4 of [parser-defects-2026-10-06.md](parser-defects-2026-10-06.md), which [pest-failure-lines.md](pest-failure-lines.md) repeated: keep the `jest` label so the recorded hold-out case `h6-f-07` stays fresh. That rule was set before any real Pest call. Real use now shows what the label costs. The ship check is a Jev `decide`.

## Why (local data, aggregates only)

- The `jest` parser owns Pest's `Tests:    8 passed (77 assertions)` line and reports it as runner `jest`.
- 20 locally stored evidence logs are Pest output (a parsed `jest` runner whose summary ends in `(N assertions)`), from 2 project folders, 2026-10-19 to 2026-10-25 (one arrived during this work).
  - 7 have a criterion that names Pest (`Pest reports 18 passed tests and 0 failed, and the exit code is 0`). All 7 were `missing`, p 0.12 to 0.36, on full passing logs with exit code 0.
  - The 13 that do not name Pest got `met` 9 times (0.70 to 0.99). The other 4 name a test file or class, which no fact carries.
- Probe on the stored facts, unchanged except the runner label, three asks per model:
  - the 3 criteria that name only Pest: label `jest` 0.22 to 0.43 on 1.13 and 0.14 to 0.43 on 1.14; label `pest` 0.89 to 0.99 and 0.90 to 0.99.
  - Pest plus a class name, compact output: 0.14 to 0.28, then 0.85 to 0.92.
  - Pest plus a class name, named tests or "the three listed test files" (3 criteria): 0.09 to 0.22, then 0.48 to 0.68 (still not `met`, right: the names are not in the facts).
  - A criterion that does not name Pest (`All tests in the run pass`): 0.98 to 0.99 with either label.
- Jev reads "Pest" in the criterion against `jest` in the facts as a different tool.

## The rule

The `jest` parser labels its runner `pest` when its `Tests:` summary line carries an assertion count (`(N assertions)`, `(1 assertion)`), which Pest and its Collision printer print and Jest does not, or when it counted Pest failure marks (namespaced `FAIL`/`FAILED` headers, `⨯` lines under such a header). Counts, names, caps and every other runner are unchanged. `pest` is a test runner in the runner kinds. Collision also prints PHPUnit runs under `php artisan test` this way, so those read as `pest` too.

## Bars

- **P1 (tests):** a passing Pest log, a risky/todo log, and the cut-off and full failing Pest logs of pest-failure-lines.md read as `pest` with the same counts and names as before. A Jest log (`Tests:       5 passed, 5 total`) stays `jest`. The kinds test lists `pest`.
- **P2 (replay, counts only):** every stored evidence log and every eval case with evidence through `parseEvidence`. Only the label changes, and only on Pest logs. No count, name, trust or cap changes.
- **P3 (evals):** the recorded cases whose facts change are named and re-recorded (expected: `h6-f-07` only). `eval score --suite all --fail-on violated` passes with 0 wrong `met`, and no other case's score changes.
- **P4 (live probe, invented fixtures, reported):** a passing Pest log under criteria that name Pest, `all tests pass` and `php artisan test passes`, three fresh asks per model, before and after. Wrong `met` check: a failing Pest log stays `missing`.
- **P5:** `ci:local` green.

## Cost, stated up front

About 3 lines in `src/engine/runners/js.ts` and 1 in `kinds.ts`. Tests that assert `jest` on Pest fixtures change their expected label. The hold-out case `h6-f-07` gets a new recording: 1 request, and its old answer (0.97 `met`) is replaced, so that case is no longer a first-time hold-out answer. The two earlier records keep their text with a pointer to this one. Fitted to one machine's Pest 5 output; older Pest versions were not run.

## Decision

Jev `decide` over three options (label `pest`; keep `jest`; keep `jest` and add a next-step hint when a criterion names Pest), with each option's cost and how it is undone in the context: `pest_label` 0.96, `keep_jest` 0.03, `criterion_hint` 0.00 (clear, both orders agree, receipt `rmvo1xyhlumip`). The option costs were written by the assistant. The context gave the real range as 0.09 to 0.36; 0.09 was a probe answer, and the stored verdicts range 0.12 to 0.36.

## Result (2026-10-25)

Written after the code.

- **P1:** `test/pest-runner-label.test.ts` (2 tests; the first fails without the change): passing, risky and cut-off failing Pest logs read as `pest` with their counts and names; Jest summaries stay `jest`. The kinds test lists `pest` as an emitted name.
- **P2:** 728 texts (379 eval cases with evidence, 349 stored logs) through `parseEvidence`: 21 changed, every one only the label (20 stored Pest logs, eval case `h6-f-07`). Through `done` with a stubbed answer of 0.98, on the 347 logs stored before this work: the 19 Pest logs among them changed only the label, 0 verdicts or reasons changed.
- **P3:** `eval score` refused `h6-f-07` as changed, as expected; re-recorded on `jev-1.13.0` (1 request, receipt `rmvo1wletx4mj`): 0.97 `met`, the same as its 2026-10-09 answer. `eval score --suite all --fail-on violated` output identical to the one before the change. No other case changed.
- **P4 (live probe, invented fixtures, piped, temporary data directory, three fresh asks each):**

| criterion, fixture | jev-1.13.0 before | jev-1.13.0 after | jev-1.14.0 before | jev-1.14.0 after |
| --- | --- | --- | --- | --- |
| `Pest reports all tests passed and the exit code is 0`, passing | missing 0.23-0.25 | met 0.98 | missing 0.10-0.13 | met 0.99 |
| `all tests pass`, passing | met 0.97 | met 0.97 | met 0.99 | met 0.99 |
| `php artisan test passes with no failures`, passing | missing 0.20-0.22 | met 0.75-0.81 | missing 0.24-0.31 | met 0.70-0.75 |
| `Pest reports all tests passed and the exit code is 0`, 1 failing | missing 0.02 | missing 0.02 | missing 0.01 | missing 0.01 |

No wrong `met`: the failing log stays `missing` on both builds. `php artisan test` is `met` near the 0.70 bar on 1.14, so a run that names that command can still come back `unsure`.

Recorded suite (added 2026-10-25, after the push): `jev-evals/done-pest`, 6 invented dev cases recorded on `jev-1.13.0`. Passing log under `Pest reports all tests passed and the exit code is 0` 0.98, `The Pest suite passes with no failed tests` 0.97, `all tests pass` 0.97, `php artisan test passes with no failures` 0.77 (all `met`); a failing log with a hand-written exit code 0 0.02 and a log cut before its summary 0.01 (`missing`). Score: pass, 0 wrong `met`.
