# The Next.js route legend is not a jest failure

Written 2026-11-17, the day of the change. The measurements and the Jev `decide` ran before the code; this record was written after it. Found while reading the local `done` receipts and stored evidence since 2026-10-25 (aggregates only).

## Why (local data, aggregates only)

- The jest parser counts every `● <name>` line as a failing test, also in a log with no jest summary, so that a cut-off jest log with only failure headers is never read as passing.
- `next build` ends its route table with a legend, and one legend line is `●  (SSG)      prerendered as static HTML (uses generateStaticParams)`. Route rows start with a tree character (`├ ● /path`), so only the legend line matches the failure pattern.
- 3 stored `done` calls (of 756 with stored evidence, 2026-11-03 to 2026-11-17; 1 session) are a clean Next.js 16 build with exit code 0 parsed as two runners: `next build` with 0 errors and `jest` with 1 failed test named after the legend line, `conflict: true`. A conflict caps `met`, so each was a refusal of a clean build: `the build succeeds` `unsure` 0.70, an exit-status criterion `unsure` 0.90 twice.

## The rule

The jest parser ignores a `●` line whose name starts with `(SSG)` and a space. Every other `●` line counts as before.

## Bars

- **N1 (tests):** a clean Next.js build log with a static-params route and the legend parses as one `next build` runner, 0 failed, no conflict. A jest failure header still counts with no summary line. A jest test whose name starts with `(SSG) ` is still counted from the `Tests:` line.
- **N2 (replay, counts only):** every stored log and every eval case: only logs with that legend line change, each losing the `jest` runner.
- **N3:** `eval score --suite all --fail-on violated` byte-identical. `ci:local` green.
- **N4 (live probe, reported):** an invented Next.js 16 build log with the legend, three fresh asks per model, before (the live install) and after.

## Cost, stated up front

One condition in `src/engine/runners/js.ts` and a test. A jest test whose full name starts with `(SSG) ` no longer counts from its header line alone; jest's `Tests:` and `FAIL` lines still count it. The rejected option (count `●` lines only next to a jest summary or `FAIL` line) would let a cut-off jest log with only failure headers read as passing.

## Decision

Jev `decide` over three options: `skip_ssg_legend` 0.95, `need_jest_summary` 0.04, `no_code` 0.01 (clear, both orders agree, receipt `rmwkobgda34mu`). The option costs were written by the assistant.

## Result (2026-11-17)

- **N1:** `test/runners-builds.test.ts` (1 new test; fails on the code before the change).
- **N2:** 756 stored logs: 3 change, from `jest` + `next build` to `next build` alone. 393 eval `done` cases: 0 change because of this rule.
- **N3:** byte-identical.
- **N4 (invented log, three fresh asks):**

| | jev-1.13.0 | jev-1.14.0 |
|---|---|---|
| `done --run build` (`the build succeeds`), before | `unsure` 0.69, 0.70, 0.66 (conflict) | `unsure` 0.72, 0.61, 0.64 (conflict) |
| `done --run build`, after | `met` 0.93, 0.93, 0.93 | `met` 0.89, 0.90, 0.88 |
| piped, `the next build command finished with exit code 0`, before | `unsure` 0.75 to 0.77 (conflict) | `unsure` 0.88 to 0.91 (conflict) |
| piped, same criterion, after | `met` 0.97, 0.97, 0.97 | `met` 0.99, 0.99, 0.99 |
| piped, `the build succeeds`, before | `missing` 0.41 to 0.48 | `unsure` 0.51 to 0.68 |
| piped, `the build succeeds`, after | `unsure` 0.50, 0.52, `missing` 0.46 | `missing` 0.29 to 0.32 |

- **Real calls re-asked** (the 2 distinct stored requests, one fresh ask each, before to after): `the build succeeds` under `--run` 0.59 to 0.92 (1.13) and 0.66 to 0.91 (1.14); the exit-status criterion 0.76 to 0.97 and 0.86 to 0.99. All four are `met` after; before, the conflict capped them.

## Open

The last two table rows are not caused by this change, but the probe shows them: a piped clean `next build` log under `the build succeeds` is not `met` on either model (0.29 to 0.52). The facts are `next build`, 0 errors, 0 warnings, test counts of 0 and the summary line `Route (app)`; under `--run` the command name is one more fact and the same criterion is `met`. Candidates, not measured: drop the zero test counts for build runners (rejected once for its eval cost in [php-agent-zero-counts.md](php-agent-zero-counts.md)), or use the `Compiled successfully` line as the summary.
