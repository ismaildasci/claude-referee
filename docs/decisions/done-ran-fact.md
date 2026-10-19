# `done --run`: send the command name, and give a build-only log the right next step

Written 2026-10-19 after a throwaway prototype and a live before/after probe, not before the code (the prototype was a few lines and was run to see whether the idea does anything at all). The bars below were set after seeing that probe, so the probe is the motivation and not a clean test; D1 to D5 were checked afterwards. Advisor first. Scope chosen with Jev `decide` over three options (next step only; next step plus the command name for parsed output; the name for every trust level): clear, the middle option 0.93, both orders agree, receipt `rmvexnu5ie0j0`; the option costs were written by the assistant.

## Why (local data, aggregates only)

- After the PHP runners went live, 5 `done` calls on one real PHP project ran `composer test`; 0 were `met` (3 `missing`, 2 `unsure`). That check runs formatters and static analysis and no unit tests, so `done --run test` (default criterion `all tests pass`) answers `missing`, which is right. But the answer carried no reason and the generic "the same output gives the same answer", and the better hint (`--criteria "<command> exits with code 0"`) existed only for the case where Jev says `met` and the code caps it.
- That hint was a dead end anyway. Probe on an invented project whose test script prints a stored real log, `done --run test`, temporary data directory, both models:

| criterion | jev-1.13.0 before | jev-1.14.0 before | jev-1.13.0 after | jev-1.14.0 after |
| --- | --- | --- | --- | --- |
| `all tests pass` (default) | `missing` 0.23, generic next step | `missing` 0.09, generic | `missing` 0.34, `no_tests_run` + hint | `missing` 0.21, `no_tests_run` + hint |
| `npm run test exits with code 0` | `missing` 0.30 | `missing` 0.19 | `met` 0.98 | `met` 0.99 |

- Cause: for parsed output only the counts reach Jev, so the command the exit code belongs to was never named (a piped `composer test exits 0` over the real log was `met` 0.70, `unsure` 0.52, `missing` 0.48 across models and wordings).

## What

1. `done --run` adds `ran` to the facts when the output was parsed: the detected command (a manifest script name such as `composer test`), any leading `cd <folder> && ` removed so no folder name leaves the machine, 80 characters at most. Exit-code-only and unparsed evidence are unchanged (their command echo lines already reach Jev under the old rules).
2. A parsed log whose runners are all build or lint runners (none failed, no conflict) under a criterion that claims tests gets `reason: no_tests_run` and the build-only next step when the verdict is `missing` or `unsure`, not only when a `met` was capped. The verdict is not touched; `done --run` then names the command and the criterion to claim (the existing run-mode text).

## Bars

- **D1:** tests (`test/done-ran-fact.test.ts`): `ran` only for parsed evidence, prefix removed, 80 characters; reason and next step for `missing` and `unsure`; none when the criterion is not a test claim, a runner failed, or the evidence is not parsed; an end-to-end `done --run` with a fake Jev.
- **D2:** `ci:local` green, recorded evals unchanged.
- **D3:** replay over the locally stored evidence logs with stubbed answers 0.1, 0.6 and 0.98: no verdict changes at any of them, no change at all at 0.98.
- **D4:** adversarial live probes, both models: a failing Pint or PHPStan summary with exit code 0 and the criterion `npm run test exits with code 0` is never `met`; a silent script and a real test runner behave as before.
- **D5:** the `done` describe text, `docs/privacy.md` and both READMEs say what is sent.

## Result

- **D3:** 78 stored logs (this includes the logs of today's own gate runs), verdicts changed 0 of 78 at 0.1, 0.6 and 0.98; reasons changed in 3 logs at 0.1 and 0.6 (one `criterion_not_covered` and two empty ones became `no_tests_run`), 0 at 0.98.
- **D4:** `pint` failed with exit code 0 gave `unsure` 0.97 (1.13) and 0.98 (1.14), `phpstan` failed with 3 errors `unsure` 0.97 and 0.99: the conflict cap holds, never `met`. A script that prints nothing: exit-status criterion `met` 0.97 and 0.98 as before (`ran` is not sent for exit-code evidence), `all tests pass` `missing` 0.25 and 0.05. A real runner line (`Tests: 3 passed, 3 total`): `all tests pass` `met` 0.97 and 0.99.
- **D1:** one existing test asserted the old contract (a Jev `missing` on a build-only log had no reason, `test/runners-real-log-fixes.test.ts`); it now expects `reason: no_tests_run` with the verdict still `missing`. The other tests pass unchanged.
- D2: see the commit.

## Cost, stated up front

- Egress: the detected command name now reaches TypeSafe for parsed `--run` calls. It is a script name from the manifest, in the same class as the echoed `$ cmd` lines already sent for exit-code evidence, and is shorter and cleaner (no arguments).
- A criterion that names the command (`composer test exits with code 0`) can now be `met` over a log made only of lint and static-check runners. That is what the criterion says (an exit status), the test-claim caps still apply to `all tests pass`, and a log with a failing summary or warnings is capped as before.
- Not measured: the effect on real calls (none yet after the change); the probe project is invented around a stored real log from one PHP project.
