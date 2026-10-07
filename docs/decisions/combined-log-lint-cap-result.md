# Result: the lint warning cap in combined logs

**Status: not shipped.** The replay below shows a net loss on real use (6 true `met` lost, 0 linter warnings caught), so on 2026-10-07 `decide` chose to keep this version out of the code and register a narrower rule first: `narrow` 0.96, `ship` 0.01, `keep_code` 0.02, both orders agreeing (receipt `rmuy6ylhm8ct7`). The narrower rule is in [combined-log-lint-cap-narrow.md](combined-log-lint-cap-narrow.md). The code described under "What was built" exists only in a working branch.

Result of [combined-log-lint-cap.md](combined-log-lint-cap.md), 2026-10-07. The rule was built as registered; the numbers below are replays of recorded answers or, where marked, of a stubbed answer, with no new Jev request. This is a fix toward the documented rule, fitted to cases seen in review and real use, not a clean test.

## What was built

- `src/cli/commands/done.ts`: the wording check that applied to exit-code-only evidence (`hasWarningMessage` or `hasProblemMessage` on the log) now applies whenever no parsed runner covers the lint kind, read from `RUNNER_KINDS` in `src/engine/runners/kinds.ts`, the map that `criterion_not_covered` uses. With `trust: exit_code` no runner is parsed, so that case is the same as before; `unparsed` evidence is already `unsure` and is untouched. The cap still lowers only `met`, only for a criterion that matches `CLEAN_CRITERION`, and gives `reason: "warning_in_log"`. A log with a parsed lint runner (eslint, biome, ruff, rubocop, clippy, golangci-lint, or oxlint with warnings or errors) keeps the parsed-warnings check alone, and test criteria and criteria that are not lint or clean criteria are untouched.
- With several criteria, a lint entry capped this way is no longer `met` and has no lint runner, so its entry in `criteria` carries `criterion_not_covered` while the top-level reason is `warning_in_log`. The skipped-tests cap already behaves this way.
- Text only, no verdict: the `warning_in_log` next step said "only an exit code backs the lint criterion", which was already wrong for parsed linter warnings and would be wrong for the new case; it now says "no clean linter summary backs the lint criterion". The `--describe` reason text, the file header and the skill's line on combined logs now describe the rule. The skill's line had said that warnings in a combined log "cannot trigger `warning_in_log`". The 0.2.4 changelog entry says the same and is left as released. After review, the skill's line also says that once one linter's summary is recognised, another linter's warnings in the same log are not read and can still give `met` (see Known limits).
- Tests: `test/combined-log-lint-cap.test.ts`, with invented lines in the shapes of vitest, jest, vite, cargo test, cargo nextest, node:test, dotnet test, ctest, behave and maven next to oxlint agent-format warnings, stylelint, ruff and biome. Four of the six tests fail on the base code (`6f4ef56`). Two pass on both: one pins what must not change, and one pins a known residual wrong `met` as it is today (see Known limits), so a later fix has to change that assertion.

## Replay on the recorded suites

Every `done` case of every recorded suite, base code (`6f4ef56`) against the new code, each with its recorded answer:

| suite | cases | lint or clean criterion | of those, parsed with no lint runner | verdicts (met / unsure / missing), before and after | wrong `met` | facts sent to Jev changed | next step text changed |
|---|---|---|---|---|---|---|---|
| `done-v2` | 107 | 13 | 0 | 36 / 15 / 56 | 0 | 0 | 0 |
| `done-v2-h2` | 40 | 2 | 1 | 9 / 6 / 25 | 0 | 0 | 0 |
| `done-v2-h3` | 36 | 9 | 0 | 9 / 4 / 23 | 0 | 0 | 0 |
| `done-v2-h4` | 45 | 10 | 1 | 13 / 10 / 22 | 0 | 0 | 2 |
| `done-v2-h5` | 35 | 7 | 0 | 10 / 3 / 22 | 0 | 0 | 2 |
| `done-v2-h6` | 53 | 12 | 0 | 10 / 7 / 36 | 0 | 0 | 5 |
| `done-v2-h6p` | 8 | 1 | 0 | 4 / 2 / 2 | 0 | 0 | 1 |
| `injection` | 33 | 0 | 0 | 0 / 1 / 32 | 0 | 0 | 0 |

- No verdict or reason changed in any case, and no case moved to `met`. The facts sent to Jev are the same for every case (equal state hashes), as expected: the rule only changes how an answer is read.
- The suites do not exercise the rule. Of 54 cases with a lint or clean criterion, 2 have a parsed log with no lint runner (`h2-d-07`, pytest; `h4-f-08`, phpunit), and both have a non-zero exit code, so they are `missing` without a request, before and after.
- The 10 next step changes are the existing `warning_in_log` cases (8 exit-code-only, 2 parsed linter warnings) getting the new wording.
- `eval score --suite all --fail-on violated` passes.

## Real-use replay

The `done` calls in the transcripts on this machine (`~/.claude/projects`), extracted again for this replay with every session except this one: 299 calls paired with their result, 215 in other projects and 84 in this repository's own sessions. Aggregate numbers only; no project names, paths or text. The evidence was rebuilt as in [lint-cap-tool-names-result.md](lint-cap-tool-names-result.md): this call's part of the command's own output (done's JSON removed), and the output of the earlier Bash call that wrote the evidence file and of calls that printed it. A rebuilt text counts only when the base code, replayed on it with the recorded p, gives the recorded trust, exit code and verdict.

- **Other projects.** 50 calls were `met` with a lint or clean criterion: 47 with `trust: exit_code`, already under the same check and unchanged by construction (1 reproduces, and it does not change), and 3 from an older version that recorded neither trust nor p, which cannot be replayed. None of them *recorded* a parsed runner, so the rule moves 0 reproducing `met` calls in other projects. That 0 covers only what can be replayed. One of the 3 calls with no recorded trust, rebuilt as a partial view, parses as vitest on the base code and would move from `met` to `unsure` (`warning_in_log`) at a stubbed p of 0.98, through linter wording. Among the 16 calls whose rebuilt text does not reproduce, 2 parse as node:test or vitest and would move with the recorded p (one through linter wording, one through the test runner's summary and other wording). None of these passes the faithfulness filter, so they are not counted and are unverified.
- **This repository's own sessions.** 8 calls were `met` with a clean criterion and a parsed `node:test` runner; this repository has no linter. 6 reproduce (all full views) and 2 do not. All 6 move from `met` to `unsure` (`warning_in_log`):
  - wording from a linter: 0;
  - wording from the test runner's own summary: 6. In all 6 it is node:test's `ℹ fail 0` (one also has `ℹ skipped 0`); one rebuilt text also keeps a cut-off fragment of an earlier `done` JSON with a `failed` key.
- **Lost true `met`, by shape: 6.** Each is a node:test summary next to a type check that prints nothing on success, with a type check criterion that falls under the cap only through the word "clean". The p values were 0.95 to 0.97, and all 6 were recorded before 2026-10-06. Nobody labelled them; nothing in the logs points to a problem, so they are counted as true `met` lost. **Caught warnings: 0.** As the registration says, more true `met` were lost than warnings caught, and that is recorded here as the rule's cost, not tuned away.
- **Counterfactual with a stubbed answer (not a recorded one).** The motivating shape is a call that combines tests and lint with only vitest parsed: 12 such calls in other projects, recorded as 11 `missing` and 1 `unsure`. 9 have no visible evidence, 2 do not reproduce, and 1 reproduces. With a stubbed p of 0.98 that one is `met` on the base code and `unsure` (`warning_in_log`) on the new code, from one linter warning line (the `file:line:col: warning` shape). One case is not a measurement.

## Cost found in review, not changed

- `hasProblemMessage` matches `fail…`, `skipp…` and `error(s)`, among others, and its negation removes only phrases such as "0 failures" and "no errors". So the clean summaries of several test runners carry problem wording: node:test (`ℹ fail 0`, `# fail 0`, `ℹ skipped 0`), cargo test (`0 failed`), cargo nextest (`0 skipped`), dotnet test (`Failed:     0`, `Skipped:     0`), ctest (`0 tests failed`), behave (`0 failed, 0 skipped`) and maven surefire (`Failures: 0, Errors: 0, Skipped: 0`). On invented summaries at a stubbed p of 0.98, a lint or clean criterion ("lint passes", "the type check is clean") next to any of these seven with no parsed linter is now always `unsure`. The tests pin all seven as the registered cost.
- Full logs of other runners cap too, not only these summaries. Stubbed exposure on the recorded suite fixtures: every `done` case labelled `met` whose log is parsed, has exit code 0 or none and has no lint runner (74 cases, 60 of them `met` on the base code), replayed for "lint passes" and for "the type check is clean" at a stubbed p of 0.98. 25 of the 60 move to `unsure` (`warning_in_log`), the same 25 for both criteria:

  | runner | moved / `met` on base |
  |---|---|
  | dotnet test | 5 / 5 |
  | cargo test | 2 / 2 |
  | cargo nextest | 2 / 2 |
  | node:test | 1 / 1 |
  | ctest | 1 / 1 |
  | behave | 1 / 1 |
  | maven | 1 / 1 |
  | pytest | 5 / 10 |
  | vitest | 2 / 5 |
  | phpunit | 2 / 4 |
  | jest | 1 / 4 |
  | rspec | 1 / 3 |
  | go test | 1 / 5 |
  | 13 other runner sets | 0 / 16 |

  The trigger words found in the moved logs are `failed`, `fail`, `Failures`, `skipped`, `error(s)`, `warning(s)`, `DeprecationWarning`, `deprecated` and `Deprecation(s)`. This is exposure, not lost `met` and not a verdict change: no recorded suite case asks a lint or clean criterion of these logs (the table above shows no change), and it applies only when a user writes such a criterion against a log like these. The 6 real-use losses above are the realised cost.
- A test runner's own warnings cap the same way: a React `act(...)` warning in vitest's stderr, or pytest's `12 passed, 1 warning`.
- `CLEAN_CRITERION` matches "clean" on its own, so a type check or build criterion worded "is clean" is capped by test wording too. That is the registered scope; it is how all 6 real-use losses happened.
- Negating `fail 0`, `0 failed` or `skipped 0`, or narrowing "clean" to lint, would be a new rule and needs its own registration. Running separate checks as separate `done` calls, as the skill says, avoids the cost.

## Known limits, not changed

Each of these is outside the registered rule and needs its own registration. Each was reproduced on invented logs with exit code 0 at a stubbed p of 0.98.

- **A wrong `met` left (the product's worst failure).** A log with one parsed clean linter next to another linter's unparsed warnings still reaches `met`: a parsed lint runner turns the wording check off, and only parsed warnings count. vitest, ruff's `All checks passed!` and stylelint's `⚠ 1 problem (0 errors, 1 warning)` give "lint passes" `met`, before and after. The test "known residual, outside the registered rule" pins the jest, biome and stylelint shape as it is today. A rule could, for example, run the wording check on the lines outside the parsed linter's own lines.
- **Linter warnings with no trigger word** still reach `met` next to a parsed test runner, as they already did with exit-code-only evidence: `eslint -f json` output (`"severity":1`, `"warningCount":1`; `warningCount` has no word boundary), oxlint diagnostics (`⚠ eslint(no-unused-vars)`) with the `Found N warning` summary cut off, and pylint `W0611` lines (pylint usually exits non-zero, so the exit code catches most of these).
- **False caps carried from the exit-code-only path into combined logs.** An npm script echo line with a flag such as `> eslint . --no-error-on-unmatched-pattern` (only `$` lines are stripped), a test file named `src/errors.test.ts` in vitest's list, and Node's own runtime warnings cap a lint criterion: the hint line ``(Use `node --trace-warnings ...` to show where the warning was created)`` after an `ExperimentalWarning` (any ESM jest run), or a `[DEP0040] DeprecationWarning`. The bare word `ExperimentalWarning` does not match. `npm warn ...` lines and a plain `> eslint .` header do not cap.
