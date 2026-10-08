# Result: a rubocop run that says an analysis will be skipped is not a clean lint run

Result of [rubocop-skip-warning.md](rubocop-skip-warning.md), 2026-10-08. The rule was built as registered: in the rubocop parser (`src/engine/runners/more-tools.ts`), a line containing "will be skipped" counts as one warning. Nothing else changed; no new reason code.

## Bars

- **Bar 1, recorded suites: met.** The 512 entries of `jev-evals` have the same facts at base (`HEAD` before the change, `src` from `git archive`) and with the change (`eval-facts`): 0 changed.
- **Bar 2, real logs: met.** The ten rubocop lint rows of the two real-log samples. Each log was fetched from its job (the job is still served), its evidence text rebuilt with the study's own functions (`scripts/real-ci/lib.mjs`), and its SHA-256 compared with the recorded `evidence_sha256`: 10 of 10 match, so the texts are the recorded ones. The texts stay outside the repository.
  - Parser facts: only `rl-2160ff01` changes (warnings 0 to 1). Passed counts do not change anywhere.
  - Done verdicts for "lint is clean" at a stub answer of 0.98: `rl-2160ff01` moves from `met` to `unsure` (`warning_in_log`). No row moves from `missing` to `met`.
  - The three `met` rows keep their verdict: `rl-3cee1e31`, `rl-46863d59`, `rl-a50cea6a` (none of their logs has the line).
  - Stub verdicts are not Jev answers. Three rows that have no rubocop parser facts (`rl-355ac767`, `rl-51c719c8`, `rl-8d9d1a40`) read `met` at the stub on both base and change; their recorded Jev answers were `missing` (labels and p 0.23 to 0.26). This rule does not touch them, and the shape is recorded for later.
- **Bar 3, tests: met.** `test/rubocop-skip-warning.test.ts`, four tests. Two fail before the change (the parser count and the lint verdict) and pass after it; the other two (a clean run stays `met`; a non-lint criterion reads the skip-line run exactly as the run without it) pass before and after.
- **Bar 4, gates: met.** `npm run check`: 1,078 of 1,078 tests pass. Jev on the test output: `met` 0.97 (receipt `rmuznapl83sen`). Jev on this repository's typecheck (`tsc -b --verbose --force`, exit 0): `met` 0.93, from the cache (`rmuznaquag14l`, the same text asked before). No path from the machine appears in `dist` or `npm/cli.mjs`.

## The known wrong met

`rl-2160ff01` (hold-out, criterion "lint is clean"): before, Jev said `met` at p 0.96; both labellers said `missing`. After the change, the same facts give `unsure` with reason `warning_in_log`. This is the case README.md named as "not fixed yet".

## What stays

- The fix is fitted to one sentence from one real log. The only recorded instance of this skip is that log; recall on other phrasings of the same skip is unknown.
- A correct `met` on a rubocop log that printed the same sentence would become `unsure`. That is a lost `met`, not a wrong one, and no recorded log has the sentence besides this one.
- Exit-code-only lint runs with no rubocop parser facts (the three rows above) are not covered by this rule.

## Decision

`decide` (ship or hold, both orders), with the registration and this record as context: `ship` 1.0, `hold` 0, orders agreeing (receipt `rmuznb1phys7i`). Shipped to main as one commit with the rebuilt bundle; no release is implied.
