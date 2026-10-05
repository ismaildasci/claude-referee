# Skip markers beyond the parsed summary

2026-10-05. The real-log measurement found 2 wrong `met` of 76 expected-`missing` steps, both dev cases: a `node --test` log whose nested script prints `2 skipped` while the `node:test` summary says 0, and an `npm test` log where an earlier vitest summary says `50 skipped` and the last summary, the one parsed, says 105 passed. The skipped-tests cap read only the parsed summary.

## Rule

`done` now also caps `met` at `unsure` (`reason: skipped_tests`) when the log text holds a structured skip marker (`src/engine/runners/skips.ts`), for parsed and exit-code-only logs alike:

- a per-test directive: TAP `# SKIP` / `# TODO`, a trailing `(skipped: reason)`, a vitest file line `(N tests | M skipped)`, pytest `SKIPPED`/`XFAIL` lines and progress letters, Go `--- SKIP:`, RSpec `(PENDING`, unittest `... skipped` and `skipped=N`, jest `○ skipped`, cargo `... ignored`, dotnet `Skipped!`, a trailing `SKIPPED`;
- a count line with a non-zero skip, pending, todo, xfailed or ignored tally, printed by any runner, in any earlier or nested summary. The line must consist only of count tokens (`N word`, `word: N`) after an optional label, so a test named `reports 2 skipped files` or prose never matches.

Never counted: test names, prose, zero counts (`# skipped 0`, `0 skipped`), echoed commands, Gradle `> Task ... SKIPPED`.

## Fork and receipts

Scope (broad: all logs and any runner's count line; narrow: parsed logs, directives and same-format earlier summaries only; none) went to `decide` with the measured facts and the disfavoured options stated in their strongest form. First ask: broad 0.54, narrow 0.45, none 0.00, orders disagreed (receipt `rmuv2b3idhmqc`). With one added neutral fact (narrow and broad differ on 1 dev case): broad 0.52, narrow 0.47, none 0.00, orders agreed (receipt `rmuv2bbaz3xck`). Both under the 0.90 bar, so the conservative option was taken: broad, the one that can only turn `met` into `unsure`. Its recall cost beyond this sample is unmeasured.

## Offline replay

Both defect cases become `unsure` with `skipped_tests`; no other case of the 229 changed (dev and hold-out), `eval score --suite all` is unchanged. The rule was designed from the two dev cases; the hold-out is a regression check, not a clean test.
