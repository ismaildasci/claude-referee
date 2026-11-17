# `done`: passing test files as a fact for a clean vitest run

Written 2026-11-17, the day of the change. The measurements and the first Jev `decide` ran before the code; three limits were measured while writing it and a second `decide` ran with them. Found while reading the local `done` receipts and stored evidence since 2026-10-25 (aggregates only).

## Why (local data, aggregates only)

- For a recognised runner, `done` sends counts, the exit code, failing test names and the matched summary line. Nothing sent says which tests ran, so a criterion that names a test file cannot be shown.
- 756 `done` calls have stored evidence (2026-11-03 to 2026-11-17). 77 of them are `missing` (0.05 to 0.48) over a clean vitest run: all tests passed, exit code 0. All 77 come from one long session. Their criteria name test files or a test group, in the form "a.test.js, b.test.js and c.test.js pass". vitest's default reporter lists each passing file as `✓ <file> (N tests)`.

## The rule

The vitest parser sets two more facts on a clean run (0 failed, 0 errors, 0 skipped or expected failures, both the `Tests` and the `Test Files` line present):

- `files_passed`: the count on the last `Test Files` line.
- `passing_files`: up to 20 names from `✓ <file> (N tests)` lines, in output order. A name must be 120 characters or less and made of letters, digits and `_ @ . + - / \ [ ] ( )`; any other name (a space, a project prefix such as `|web|`, a per-test line of the verbose reporter, a file with skipped tests) is left out.

`done` sends the two facts only when all of these hold; otherwise the request is what it was before:

1. the evidence has an exit code of 0 (always the case under `done --run` for a passing check);
2. every criterion is about tests: it contains the letters `test` or `spec`;
3. no criterion names a lint, build or typecheck check that no parsed runner covers.

Other runners are unchanged.

## Bars

- **F1 to F4 (tests):** a clean run carries the count and the names in order; a failing, errored, load-failed, skipping or cut-off run carries neither; odd names are left out and the list stops at 20 while the count stays.
- **F5 (tests):** the facts reach Jev only under the three conditions above; the printed result does not change.
- **F6 (replay, counts only):** every stored log and eval case through the code before and after: the only change is the two added facts on vitest runners.
- **F7:** eval cases whose request changes are recorded again; `eval score --suite all --fail-on violated` output byte-identical. `ci:local` green.
- **F8 (real calls, reported):** every distinct stored request that changes, one fresh ask before and after, on both models: no `met` call may leave `met`.
- **F9 (wrong `met` probes, reported):** a criterion that names a file missing from the list stays `missing`; a crafted file name does not move a criterion that is not about tests.

## Cost, stated up front

About 15 lines in `src/engine/runners/js.ts` and 5 in `src/cli/commands/done.ts`, one test file, 4 eval recordings. A new kind of data leaves the machine: relative paths of passing test files, redacted like every other fact ([privacy.md](../privacy.md)). A file name is text the project chooses and it reaches the judge: a criterion about tests that a file name matches reads as shown (measured below). Fitted to one session's logs; jest, Pest and other runners are not read (the stored logs hold no real jest run).

## Decision

- First Jev `decide`, four options (names and count for vitest; count only; names for vitest, jest and Pest; no code): `vitest_names_and_count` 0.97 (clear, both orders agree, receipt `rmwkoax6qq9l9`).
- Second `decide`, after the limits below were measured and the guards added, three options: `guarded_names_and_count` 0.95, `count_only` 0.02, `no_code` 0.02 (clear, both orders agree, receipt `rmwkp0gql9coh`).

The option costs were written by the assistant.

## What the measurements changed

The first version sent the facts on every clean run. Three measurements narrowed it.

- **No exit code line.** On recorded eval cases with no exit code, five asks each, the added facts lowered `all tests pass` by 0.03 to 0.12 (0.80 to 0.73 on jev-1.13.0, 0.89 to 0.77 on jev-1.14.0, means of five), close to the 0.70 bar. With an exit code of 0 the criterion did not move. Hence condition 1.
- **Skipped tests.** A recorded case with one skipped test moved from 0.54 to 0.51, and `met` is capped there anyway. Hence the clean run excludes skips.
- **A crafted file name.** An invented log with a passing file named `src/deploy-to-production-succeeded.test.js`, criterion `the deploy to production succeeded`: `missing` 0.02 without names; with names jev-1.14.0 answered `met` 0.85 three times (jev-1.13.0 `unsure` 0.59 to 0.65). The same log moved `lint is clean` from 0.06 to 0.53 to 0.58. Hence conditions 2 and 3: with them both criteria are back at 0.02 and 0.05 to 0.08, and `the build succeeds` and `the typecheck passes` are unchanged.

## Result (2026-11-17)

- **F1 to F5:** `test/passing-test-files.test.ts` (5 tests).
- **F6:** 756 stored logs: 241 carry the new facts (226 with names, 15 with the count only; 164 were `met`, 76 `missing`, 1 `unsure`); nothing else changes because of this rule. 393 eval `done` cases: 4 change.
- **F7:** the 4 cases were recorded again on jev-1.13.0 with the answers they had (0.98, 0.97, 0.97, 0.98); the score output is byte-identical.
- **F8 (one fresh ask before and after per distinct request):**

| | jev-1.13.0 | jev-1.14.0 |
|---|---|---|
| 160 requests stored as `met` (measured before the skip and criterion conditions, which only remove requests) | 160 stay `met`, p change -0.01 to +0.08 | 160 stay `met`, p change -0.01 to +0.18 |
| 64 requests stored as not `met` | 47 `met`, 13 `unsure`, 4 `missing` | 58 `met`, 2 `unsure`, 4 `missing` |

  The 4 that stay `missing` on both models name things the facts still do not carry (source files that are not test files, a test group with no file of its own in the run, quoted output lines) or use a double negative.
- **F9 (invented log with three passing files, three fresh asks per model, before to after):**

| criterion | jev-1.13.0 | jev-1.14.0 |
|---|---|---|
| two listed files pass | 0.20 to 0.21, then 0.97 | 0.17 to 0.18, then 0.99 |
| "the architecture test and the help tests pass" | 0.15, then 0.97 | 0.12, then 0.99 |
| "all 3 test files pass" | 0.16 to 0.18, then 0.97 | 0.13 to 0.14, then 0.99 |
| a file that is not listed passes | 0.26 to 0.27, then 0.03 | 0.23 to 0.26, then 0.03 to 0.04 |
| a listed and an unlisted file pass | 0.13 to 0.14, then 0.03 to 0.04 | 0.09 to 0.10, then 0.02 |
| "all tests pass" | 0.98, then 0.98 | 0.99, then 0.99 |

## Limits

- **A matching file name moves a test criterion.** `the deploy tests pass` over the crafted log: before, `unsure` 0.66 to 0.68 (1.13) and `met` 0.73 to 0.77 (1.14) from the counts alone; after, `met` 0.88 to 0.90 and 0.96 to 0.97. The name is what vitest printed for a passing file, and the project chose it.
- **Not caused by this change, seen in the same probes:** `the build succeeds` over vitest facts alone is `met` (0.88 to 0.96) before and after, with or without names. `criterion_not_covered` is a reason, not a cap. In the stored logs 9 of 459 parsed `met` calls have a criterion of a kind no parsed runner covers. Open.
- A list longer than 20 is cut; `files_passed` still carries the full count, and a criterion naming a file beyond the cut reads as not shown.
- Evidence longer than the clip (first 2,000 and last 12,000 characters) can lose `✓` lines from its middle.
- One session supplied all 77 calls; the reach on other projects is not measured.
