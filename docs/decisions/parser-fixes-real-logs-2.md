# Two parser fixes after the second real-log test

2026-10-05. The first unseen real-log test of `done` ([registration](done-v2-real-logs-2.md), [result](../measurements-real-logs-2.md)) failed its registered bars and had two wrong `met`. Both come from parser gaps that do not depend on the data, so both were fixed in code, on those two cases. The fixes are fitted to them: the 0 wrong `met` afterwards is not an unseen test, and `done` v2 stays "not measured" on the old bar.

## 1. A build log is not a test result (`rl-7c6caf48`, maven)

The `maven` parser counted a bare `BUILD SUCCESS` as one passed check when no `Tests run:` line existed, which is the build-parser convention (`passed` = completed build units: msbuild `ok`, swift build `ok`, docker `done.size`, ninja edges). `done` has no notion of the criterion's subject except for lint and clean criteria, so a test criterion backed by a build log reached Jev as "1 passed" and Jev answered `met` (0.93).

How the existing contract expresses "no tests ran": a text rule in `done.ts` (`NO_TESTS`: `Tests run: 0`, `No tests to run`, `0 tests`) caps `met` at `unsure` with `reason: no_tests_run` for any criterion; a parsed run that is empty is `incomplete`. A test-less maven log has neither, so nothing fired. A new optional fact, `build_only`, marks a runner whose facts are build output. `done` caps `met` at `unsure` (`no_tests_run`, with its own next step) when every parsed runner of the log is build-only and the criterion mentions tests (`tests`, `testing`, `test suites`, `specs`). A build criterion is not capped, so `BUILD SUCCESS` can still be `met` for "the build succeeds"; a mixed criterion ("the tests pass and the build succeeds") is capped.

- `maven` is build-only when its summed `Tests run:` is 0 (no totals, or `Tests run: 0`). With surefire totals it is not.
- The same mark is set on `ninja`, `msbuild`, `docker build`, `make`, `swift build`, `cargo build`, `next build`, `nix build` and `vite`, the parsers that report build units or markers as `passed` or nothing; test runners and linters are not marked. This is the general form of the fix: the defect class is a build success read as a test pass.
- The mark is read in code and stripped before the facts go to Jev (`factsOf`), so the state hash of every build case is unchanged and no recorded answer went stale; the cap is a code cap and applies to the recorded answer exactly as the skip caps do.
- Forged text cannot set it: the mark follows from anchored lines only (`[INFO] BUILD SUCCESS`, surefire totals), a `Tests run:` printed by test output with other indentation or prefix is not counted, and any failure in the facts still wins (`BUILD SUCCESS` after `Tests run: 3, Failures: 1` stays failed: the parser takes the worst case and `done` reports a conflict with exit code 0).

Fork: all build parsers or maven only. Neutral framing, strongest form of both; `decide`: all build runners 0.86, maven only 0.13, orders agreeing, receipt `rmuvfadkxuuli`: under the 0.90 bar, so the conservative option (the broader, tighter cap) was taken. In replay it changes no verdict other than the maven case, in either version.

## 2. Several Swift summaries, and known issues (`rl-c4542111`, swift)

The `swift test` parser kept only the last Swift Testing summary and the last `All tests` block, and read nothing of known issues. The CotEditor log shows four summaries (47 tests passed with 4 known issues, then 12, 13, 11 passed) and the parser reported 11.

- Every `Test run with N tests in M suites passed|failed after ...` line is added; so are the `All tests` / `Selected tests` blocks of several `swift test` invocations (the `.xctest` bundle lines count only when no such block exists).
- `with N known issues` on a summary line and `Test ... recorded a known issue` lines count as `expected_failures` (a fact for Jev) and cap `met` at `unsure` (`skipped_tests`), with `SKIPPED_NEXT` extended to name known issues.
- A "passed" summary that also reports non-known `issues` counts as one failure (worst case); `warnings` count as warnings; a `Test run started` line with no later summary makes the run `incomplete` (this fired on one other sample-1 log, a Swift run that never printed its summary).
- Forged or indented summary lines do not match the anchored patterns; a failing summary anywhere wins over any number of passing ones.

Fork: cap known issues, ignore them, or count them as failures. **This is a conservative choice, made because the labelled case is contestable.** In Swift Testing a known issue is an expected failure the author marked (`withKnownIssue`) and the run is reported as passed, so a human may reasonably call the CotEditor log a correct `met`; the labeller said `missing`. The repository already treats skips, xfail and "expected failure" as not shown to pass (`skips.ts`, `hasSkips`), so known issues follow that precedent; no earlier rule named them. Neutral framing with the three options in their strongest form: cap 0.76, ignore 0.23, count as failed 0.00, orders agreeing, verdict `weak` (receipt `rmuvfa6dvnr1a`), under the 0.90 bar, so the conservative option was taken (the cap, which also costs a true `met` on every package with a known issue; one such case exists in the data).

## Replay and re-recording

Both real-log tables were replayed with the recorded answers: the old code reproduces the committed tables with 0 differing rows. The new code changes 6 rows (listed in the [measurements note](../measurements-real-logs-2.md#after-the-two-parser-fixes-fitted-to-these-cases-not-an-unseen-test)); five changed their facts and were re-recorded with `eval record` on copies of the local suites (5 requests, receipts `rmuvf61f3tvvb` and `rmuvf62dqqqip`); the maven case needed none. `eval score --suite all` is unchanged for all 16 suites, same allowances; no synthetic case changed its facts.

## Not done

The `done` clip drops the middle of a long log (78,509 of 92,520 characters for the CotEditor case) and the code does not treat a clipped parsed log differently; known issues and extra summaries in the omitted part are not seen. The recall misses, the exit-code-only class, `mix test` and the other backlog items are untouched. A linter or type checker under a test criterion is not marked build-only.
