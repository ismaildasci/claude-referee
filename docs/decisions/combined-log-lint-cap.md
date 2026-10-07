# The lint warning cap in combined logs

Registered 2026-10-07, before any code change or replay.

## Why

`done` caps `met` at `unsure` for a lint or clean criterion when the log shows warning or problem wording, but only when the evidence is exit-code-only (`trust: exit_code`) or a parsed runner reports warnings (`src/cli/commands/done.ts`, `warnCap`). When a test runner is parsed in the same log as a linter that has no parser (a combined `npm test && npm run lint` log, or a linter whose output shape is not read), `trust` is `parsed`, the linter's warnings are never looked at, and the lint criterion can reach `met` on the test runner's facts and the exit lines alone. A review of the 0.2.4 guidance work reproduced this with a stubbed answer of 0.98. Real use showed the shape is common: 13 combined test, build and lint calls in one project came back `missing` before 0.2.4, and 0.2.4 now tells the user such a criterion is not covered (`criterion_not_covered`) when the verdict is not `met`; the `met` side is still open.

## Rule

For a criterion that matches the lint or clean pattern (`CLEAN_CRITERION`, which since 0.2.4 also names linters), when no parsed runner covers the lint kind (the same kinds map that `criterion_not_covered` uses), the warning-wording check that applies to exit-code-only evidence (`hasWarningMessage` or `hasProblemMessage` on the log) applies too, and caps `met` at `unsure` with `reason: "warning_in_log"`. This extends the rule decided in [exit-code-only-met.md](exit-code-only-met.md) and [exit-code-only-lint-wide.md](exit-code-only-lint-wide.md) from "only an exit code backs the lint criterion" to "no parsed lint runner backs it". Nothing else changes: criteria that are not lint criteria, logs with a parsed lint runner, and test criteria are untouched.

## What will be reported, and the bar

- Replay on every recorded `done` suite (`eval score --suite all`) and the recorded facts: verdict changes per suite. The rule only lowers `met` to `unsure`, so no case can move to `met`; facts sent to Jev do not change.
- Replay on the local real-use `done` calls whose evidence is visible in the transcripts (aggregate counts only): how many `met` lint criteria in logs with a parsed non-lint runner move to `unsure`, split by whether the log's warning wording came from a linter.
- The cost is true `met` answers lost where a test log itself prints the word "warning" next to a clean linter; each such case is reported. If the replay shows more lost true `met` than caught warnings, that is recorded as the rule's cost, not tuned away.

A fix toward the documented rule, fitted to cases seen in review and real use, not a clean test.
