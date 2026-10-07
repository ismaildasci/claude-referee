# Result: a narrower lint cap for combined logs

**Status: shipped** on 2026-10-07 after all four bars passed; `decide` `ship` 0.96, `hold` 0.04, both orders agreeing (receipt `rmuy90bmc9luc`).

**Bar: passed, all four items.** Result of [combined-log-lint-cap-narrow.md](combined-log-lint-cap-narrow.md), 2026-10-07. The rule was built as registered and replayed on the same data with the same scripts as the [first version](combined-log-lint-cap-result.md), which was not shipped. The numbers are replays of recorded answers or, where marked, of a stubbed answer. No new Jev request was made. As the registration says, this is a fix fitted to cases already seen, not a clean test.

After a review, three changes were made inside the registered rule, and the replay was run again on the result. All four bar numbers are the same as before:

- the bare `N warnings` / `N errors` summary line from the registration's fourth bullet was added (it was missing);
- the `N problems` summary now has to be the whole summary line, so a test title such as `3 problems are reported for a bad file` no longer counts;
- the exit-code-only and parsed-linter paths keep their old next step text word for word, and only the new cap has its own text.

## What was built

- `src/cli/commands/done.ts`: a new exported function, `hasLinterDiagnostic`, reads the log line by line and returns true on the first line shaped like a linter diagnostic:
  - `path:line:col: warning ...` or `path:line:col: error ...`, in lower case as the registration and the captures show. This is the compiler-style shape. It is also the head of each diagnostic in oxlint's agent format: the real oxlint 1.87 captures print `path:line:col: warning eslint(rule): message`, and `path:line:col: error eslint(rule): ...` for a rule at error level. The path must contain a `.` or a `/`, so a timestamp such as `2026-10-07T12:30:45: error` does not count;
  - `path:line:col: CODE ...` with a flake8 or pycodestyle code: 1 to 3 capital letters and 3 digits (`E501`, `F401`, `W291`, plugin codes such as `B950` or `SIM115`). pylint's four-digit codes (`W0611`) do not match;
  - an indented `line:col  warning|error  message` row directly under a file header line (eslint stylish). Rows with stylelint's `⚠` or `✖` in place of the word do not match; stylelint is caught by its summary;
  - a linter summary with a count above 0, in one of three forms:
    - `✖ N problems`, `⚠ N problem` or `N problems` alone (oxlint's unix format) as the whole line, with an optional `(… errors, … warnings)` after it;
    - `Found N warnings`, `Found N errors` or `Found N warnings and M errors` at the start of a line (oxlint, biome, ruff);
    - `N warnings`, `N errors` or `N warnings and M errors` as the whole line, with an optional `found` and full stop after it (stylelint's verbose `2 warnings found`, jshint's `2 errors`).

    Any count above 0 triggers, so `Found 0 warnings and 1 error` counts. Only these words are read: `Summary: 3 issues` (markdownlint-cli2), golangci-lint's `3 issues:` and `Found 2 problems` (deno lint) do not count. The `Found` form also matches a type checker's own summary: tsc's `Found 2 errors in 1 file.` and mypy's `Found 1 error in 1 file (checked 36 source files)`.

  Counts of zero never trigger. Neither do test runner summaries (`ℹ fail 0`, `0 failed`, `Skipped: 0`, pytest's `12 passed, 1 warning` and `1 warning in 0.01s`), the follow-up line `1 warning potentially fixable with the --fix option`, npm or Node deprecation notices, file names or command echo lines. None of those has one of the shapes above.
- The cap: `met` becomes `unsure` (`reason: "warning_in_log"`) for a criterion that matches `CLEAN_CRITERION` when all of these hold:
  - `trust` is `parsed`;
  - no parsed runner covers the lint kind (`RUNNER_KINDS` in `src/engine/runners/kinds.ts`, the map `criterion_not_covered` uses);
  - `hasLinterDiagnostic` is true.

  Exit-code-only evidence keeps `hasWarningMessage` or `hasProblemMessage`, unchanged. Parsed linter warnings keep `hasParsedWarnings`, unchanged. Test criteria, and criteria that are not lint or clean criteria, are untouched.
- In practice the ruff parser claims flake8 lines (the same `path:line:col: CODE` shape), and the eslint parser claims stylish rows, before this check runs. Those logs then have a lint runner, so the narrow check does not run on them; they are not `met` either way. The shapes that reach the narrow check on their own are:
  - the severity lines;
  - the `Found` summaries with no parsed linter behind them;
  - the bare count summaries;
  - `N problems`;
  - stylelint's summary.
- Next step text. The exit-code-only and parsed-linter `warning_in_log` paths keep the old text word for word. When the cap comes from the new check alone, the next step says: "The log has a linter's warning or error line, or a linter summary with a count above 0, and no linter's summary was recognised, so done won't say met. Run the linter as its own done call and pipe its full output, or say yourself that the warning is acceptable." These all describe the narrow rule:
  - the `--describe` reason text;
  - the file header;
  - the skill's line on combined logs;
  - the CHANGELOG `[Unreleased]` bullet.

  The 0.2.4 changelog entry is left as released.
- Tests: `test/combined-log-lint-cap.test.ts`, 10 tests on invented lines.
  - `hasLinterDiagnostic` on each shape, including the bare count summaries.
  - `hasLinterDiagnostic` on negatives: zero counts, the seven clean test summaries, pytest's quiet summary, notices, file names, command echo lines, test titles that start with a count, `--fix` follow-up lines, a stylish row with no file header, a timestamp, pylint and markdownlint.
  - Verdicts next to vitest, jest and vite. The seven clean summaries and the notices stay `met` under "lint passes" and "the type check is clean".
  - The exit-code-only and parsed-linter paths are checked as unchanged, their next step text included.
  - Known residual wrong `met` cases are pinned as they are today.

  The full suite: 1006 tests, 1006 pass.

## The bar

| bar item | registered | measured | pass |
|---|---|---|---|
| real-use true `met` lost by the first version stay `met` | 6 of 6 | 6 of 6 (`parsed [node:test]: met -> met`) | yes |
| recorded passing suite logs capped under a lint criterion | at most 2 of 60 | 0 of 60 (the first version: 25) | yes |
| the combined test and lint call with a `file:line:col: warning` line, at a stubbed 0.98 | capped | `met` -> `unsure` (`warning_in_log`), through the `path:line:col: warning` (or `error`) shape only | yes |
| recorded eval suites | no verdict, reason or fact change | 0 verdict, 0 reason, 0 fact changes | yes |

## Replay on the recorded suites

Every `done` case of every recorded suite was replayed on the base code (`6f4ef56`) and on the new code, each with its recorded answer (`evaldiff.ts`, `evalexposure.ts`):

| suite | cases | lint or clean criterion | of those, parsed with no lint runner | verdicts (met / unsure / missing), before and after | wrong `met` | facts sent to Jev changed | next step text changed |
|---|---|---|---|---|---|---|---|
| `done-v2` | 107 | 13 | 0 | 36 / 15 / 56 | 0 | 0 | 0 |
| `done-v2-h2` | 40 | 2 | 1 | 9 / 6 / 25 | 0 | 0 | 0 |
| `done-v2-h3` | 36 | 9 | 0 | 9 / 4 / 23 | 0 | 0 | 0 |
| `done-v2-h4` | 45 | 10 | 1 | 13 / 10 / 22 | 0 | 0 | 0 |
| `done-v2-h5` | 35 | 7 | 0 | 10 / 3 / 22 | 0 | 0 | 0 |
| `done-v2-h6` | 53 | 12 | 0 | 10 / 7 / 36 | 0 | 0 | 0 |
| `done-v2-h6p` | 8 | 1 | 0 | 4 / 2 / 2 | 0 | 0 | 0 |
| `injection` | 33 | 0 | 0 | 0 / 1 / 32 | 0 | 0 | 0 |

- No verdict, reason or next step text changed, and no state hash changed. The review run found 10 changed next steps: the existing `warning_in_log` cases, 8 exit-code-only and 2 with parsed linter warnings. They keep their old text now.
- The 2 cases with a lint or clean criterion and a parsed log with no lint runner (`h2-d-07`, `h4-f-08`) have a non-zero exit code. Both are `missing` without a request, before and after.
- `eval score --suite all --fail-on violated` exits 0, and its output is the same as at the earlier gate runs.

**Stubbed exposure** (`exposure.ts`): every `done` case labelled `met` whose log is parsed, has exit code 0 or none, and has no lint runner. That is 74 cases, 60 of them `met` on the base code. Each is replayed for "lint passes" and for "the type check is clean" at a stubbed p of 0.98. 0 of the 60 move for either criterion, and no other verdict changes. The first version moved 25 (dotnet test 5 of 5, pytest 5 of 10, cargo test, cargo nextest, vitest and phpunit 2 each, and 1 each for node:test, ctest, behave, maven, jest, rspec and go test).

**All recorded cases, stubbed.** All 889 recorded cases with evidence, from every suite, were replayed for "lint passes", "no lint warnings" and "the type check is clean" at a stubbed 0.98. Exactly 1 case moves: `h3-c-08`, for all three criteria (`met` -> `unsure`/`warning_in_log`). It is a mypy run that the tsc parser claims, its `Found 1 error ...` summary triggers the cap, and its label is `missing`, so the move is toward the label. The bare count summary fires on 1 recorded case, `h5-d-03`: esbuild's `1 error`, in an exit-code-only log with exit code 1, so it is `missing` either way.

## Real-use replay

The data is the same as for the first version: the `done` calls in the transcripts on this machine. 299 calls are paired with their result, 215 in other projects and 84 in this repository's own sessions. The evidence was rebuilt the same way. A rebuilt text counts only when the base code, replayed on it with the recorded p, gives the recorded trust, exit code and verdict (`realreplay.ts`). Aggregate numbers only; no project names, paths or text.

- **This repository's own sessions.** 8 calls were `met` with a clean criterion and a parsed `node:test` runner. 6 reproduce (all full views), and all 6 stay `met`. The first version moved all 6 through `ℹ fail 0` (one also had `ℹ skipped 0`). None of the 6 has a line in a narrow shape.
- **Other projects.** 50 calls were `met` with a lint or clean criterion: 47 with `trust: exit_code`, and 3 from an older version that recorded neither trust nor p. The one that reproduces is exit-code-only and does not change. None recorded a parsed runner, so the rule moves 0 reproducing `met` calls there.
- **The motivating shape, with a stubbed answer (not a recorded one).** 12 calls in other projects combine tests and lint with only vitest parsed. Their recorded verdicts are 11 `missing` and 1 `unsure`. 9 have no visible evidence, 2 do not reproduce, and 1 reproduces. That one is `met` on the base code at a stubbed p of 0.98, and `unsure` (`warning_in_log`) on the new code. A per-shape count shows that only the `path:line:col: warning|error` shape fired. No code, row, summary or bare count shape fired, on that call or on any other replayed call. One case is not a measurement.
- **Not counted, unverified.** These calls do not pass the faithfulness filter, so they are not counted:
  - the call with no recorded trust that parses as vitest in a partial view moves from `met` to `unsure` at a stubbed 0.98, through the same severity shape;
  - the first version moved 2 calls whose rebuilt text does not reproduce, with the recorded p. The vitest one still moves (severity shape). The node:test one (test summary wording) now stays `met`.

## What changed against the first version's costs

- The clean summaries of node:test, cargo test, cargo nextest, dotnet test, ctest, behave and maven surefire no longer cap a lint or clean criterion. The tests pin all seven as `met`.
- On the first version's review probe (`probe.ts`, 26 invented logs, each with a lint, a type check and a test criterion at a stubbed 0.98), the new code gives the base verdict on all 26. The first version changed 11. The 10 exit-code-only probes (`exitonly.ts`) are unchanged, as before.
- When a test runner is parsed, these no longer cap:
  - a test runner's own warnings (pytest's `1 warning`, a React `act(...)` warning);
  - Node's `ExperimentalWarning` hint line and `DeprecationWarning`;
  - npm's `warn deprecated` notices;
  - a file named `errors.test.ts`;
  - an npm script echo line with a flag.

  On exit-code-only evidence the old check is unchanged, so what it caught before still caps there: the hint line, `DeprecationWarning`, `deprecated`, the file name and the echo line.

## Known limits, not changed

Each limit needs its own registration.

**Real captures from the review.** These are eslint 10.12.0, stylelint 17.16.0, oxlint 1.87.0, biome 2.5.15, markdownlint-cli 0.49.1, markdownlint-cli2 0.23.3, shellcheck, pylint, mypy, flake8, pycodestyle, ruff, cargo, clang, gcc and swiftc. Each was combined with a real passing vitest 5.0.3, node:test or pytest run, at a stubbed p of 0.98, for "lint passes" and "no lint warnings". The replay of these captures gives the same verdicts on the new code as at the review. Most of these linters exit non-zero when they find something. With the linter last, the exit line is the linter's, and the log is `missing` (`exit_code_nonzero`) without a request. The rows below are the other order: the linter first and the test run last, so the exit line is the test's 0. A row marked "both orders" is `met` either way, because that linter exits 0 on warnings.

- **Wrong `met` left.** These linter warnings or errors, in shapes outside the rule, still give `met` for a lint criterion next to a passing test run:
  - shellcheck's default (tty) format (`In file line N:` and `^-- SC2086 (info): ...`), and its json, checkstyle, diff and quiet formats. Quiet prints nothing, so only its exit code shows the finding. `shellcheck` is a named linter, so "shellcheck passes" is a clean criterion;
  - stylelint's compact format (`file: line 1, col 12, warning - ...`, both orders for warnings), its json format (both orders, for warnings and for errors), its tap format (both orders for warnings), and its github format. Its string, unix and verbose formats are caught by their summary lines;
  - markdownlint-cli and markdownlint-cli2: `path:line error MD022/...` has no column, and cli2's `Summary: 3 issues in 1 file` uses "issues";
  - pylint's default and parseable formats (four-digit codes such as `W0611`);
  - eslint `-f json`, with warnings (both orders) or with errors;
  - oxlint's json, checkstyle, junit and gitlab reporters (both orders);
  - biome's json, github, gitlab, junit, checkstyle and rdjson reporters. Biome exits 1 on these findings, so with biome last the log is `missing`;
  - cargo test with a rustc warning (`warning: unused variable`, ` --> src/lib.rs:2:9`, `generated N warnings`), both orders. cargo test is parsed in every combination (vitest, node:test or pytest plus cargo test), and the warning still gives `met`.

  **Invented lines, no real capture:**
  - a parsed clean linter next to another linter's warnings (jest with stylelint's summary and biome's `Checked N files`; vitest with ruff's `All checks passed!` and stylelint). The parsed lint runner turns the narrow check off;
  - oxlint's default report cut before its summary, and its GitHub format cut the same way;
  - eslint's compact format (`file: line 1, col 7, Warning - ...`);
  - `svelte-check found 0 errors and 2 warnings`;
  - golangci-lint v1 and v2 text lines (not installed, so not captured). Its `path:line:col: message (linter)` lines carry no severity word, and its `N issues:` summary uses "issues".
- **Caps the rule now adds that may be unwanted.**
  - A compiler warning in the compiler-style shape next to a passing test run caps any lint or clean criterion, including "the type check is clean". The real clang, gcc and swiftc captures (`c/util.c:3:7: warning: unused variable 'x' [-Wunused-variable]`) do this in both orders, next to vitest, node:test and pytest. This shape is registered, and none of the 60 recorded passing suite logs has it.
  - A type checker's own `Found N errors` summary (tsc, mypy) counts as a linter summary. In the recorded suites this moves only `h3-c-08`, toward its label.
  - Build and test tools can print the bare count line too. The one recorded case it fires on (`h5-d-03`) is esbuild's `1 error` after a failed bundle, with exit code 1. bun test's summary has a ` N error` line (`src/engine/runners/bun.ts` reads it), which matches too. With the `Ran N tests across N files.` line also in the log, the bun parser then reports `errors` above 0, so it is not a clean run. The real-use replay's per-shape count found no bare count line.
  - `CLEAN_CRITERION` still matches "clean" on its own, so a type check or build criterion worded "is clean" falls under the cap.
- **Where the evidence is thin.**
  - Item 3 of the bar rests on one real call with a stubbed answer; its recorded verdict was not `met`.
  - Items 1 and 3 are the cases that motivated the rule.
  - In other projects no `met` call with a parsed runner and a lint or clean criterion could be replayed, so the real-use cost outside this repository is unmeasured.
