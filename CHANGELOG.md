# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `done`: a test criterion backed only by build output (maven without surefire totals, `ninja`, `msbuild`, `docker build`, `make`, `swift build`, `cargo build`, `next build`, `nix build`, `vite`) is capped at `unsure` (`reason: no_tests_run`); a build criterion can still be `met`. The mark is read in code and not sent to Jev. This fixes the wrong `met` of `google/gson` in the second real-log test, a `mvn artifact:check-buildplan` step that ran no tests ([decision](docs/decisions/parser-fixes-real-logs-2.md)).
- `done` parser for `swift test`: every Swift Testing summary and every XCTest `All tests` block is added (before, only the last counted); known issues are counted as expected failures and cap `met` at `unsure` (`skipped_tests`), the same way skips and xfail do (a conservative choice, the one labelled case is contestable); a `Test run started` with no summary is incomplete. This fixes the wrong `met` of `coteditor/CotEditor`.
- Both fixes were made on the two failing cases, so the 0 wrong `met` that follows (0 of 85 on the second sample, 6 table rows changed in the two samples) is fitted, not an unseen test; `met` recall among parsed (69 of 79) and `missing` recall (45 of 85) did not move. `eval score --suite all` is unchanged. See [the note](docs/measurements-real-logs-2.md#after-the-two-parser-fixes-fitted-to-these-cases-not-an-unseen-test); re-derived tables are in `docs/data/done-v2-real-2/after-parser-fixes/` and `docs/data/done-v2-real/after-parsers/parser-fixes/`.
- Wording: the README (English and Turkish), FAQ, `configuration.md`, the `jev` skill, `docs/verify-skill.md` and `docs/measurements.md` now say that `done` v2 is not measured on its original bar, failed its registered bars on unseen real CI logs, almost never says `met` on exit-code-only evidence, and that the Stop gate is a reminder and `active` is not recommended.
- TypeSafe's models page now lists 80 requests per second (was 40; tokens per second unchanged at 100K): the `jev` skill reference and `docs-watch.json` follow it. The `api.md` and `llms.txt` pages changed in content with the same extracted facts.

### Added

- First unseen test of `done` v2 on real CI logs ([registration](docs/decisions/done-v2-real-logs-2.md), [result](docs/measurements-real-logs-2.md), data in `docs/data/done-v2-real-2/`): a fresh sample of 126 repositories in 17 language buckets (none from the first sample, runs from 2026-10-04), 272 cases of which 231 sent to Jev and 41 failed steps decided in code (failed share 15.1%, target 25% not reached), scored once on the code frozen at v0.2.1 (receipt `rmuveb0ms866t`, 206 requests). All three registered bars failed: wrong `met` 2 of 85 (both in parsed logs; exit-code-only 0 of 56), `met` recall among parsed 69 of 79 = 0.873 (bar 0.9), `missing` recall 45 of 85 = 0.53 (bar 0.9). Parsed coverage 46.8%. Nothing was fixed in that task (the fixes are under Changed); one wrong `met` is a `maven` `BUILD SUCCESS` without any test counted as one passed test, the other a Swift Testing log with known issues whose parsed summary covers one of four runs (its label is contestable).
- `scripts/real-ci/fetch2.mjs` (cap of 3 cases per repository, an exclusion list, a failed-step top-up), `score2.mjs` (metrics per evidence class with exact, repository-bootstrap and repository-clustered intervals) and `--share`/`--cost` for `label.mjs`; the first study's scripts keep their defaults.
- Option-order scale study for `decide` (`docs/decisions/decide-order-scale.md`, `docs/measurements-decide-order-scale.md`, harness `scripts/decide-scale/`, recorded answers `jev-evals/decide-scale/`): on 252 invented decisions (3 to 6 options, every order for 3 to 4 options and 24 random ones for more, asked twice) written + reversed agrees with the 24-order leader in 0.99 of the 179 decisions whose lead is 0.08 or more but only 0.66 of 32 near-ties; the balanced design of n rotations plus their reversals (2n requests) reaches 0.94 and is the cheapest policy the registered rule accepts, while 3 or 4 rotations are not distinguishable from two orders. Renaming options to neutral names moved the leader in 22 of 183 decisions. 16,044 Jev requests, about 0.36 USD. `decide` is unchanged; the policy decision is the maintainer's.
- Stop gate state study (`docs/decisions/stop-state-design.md`, `docs/measurements-stop-state.md`, harness `scripts/stop-state/`, recorded answers `jev-evals/stop-state/`): giving Jev the edit contents and a question about the task's requirements separates wrong from true dones (hold-out AUC 0.867, task-clustered interval 0.748 to 0.959, against 0.553 for the current gate state), but at the threshold frozen on dev recall is 6 of 9 (bar 0.8) and the hard-task-only AUC is 0.643, so the registered adoption rule fails on recall: separates, but not usefully. 2 674 Jev requests, about 0.11 USD. Nothing shipped changes; the experimental questions are in a pack that is not shipped.
- Stop gate requirements question without edit contents (`docs/decisions/stop-requirements-question.md`, `docs/measurements-stop-requirements.md`, harness `scripts/stop-req/`, recorded answers `jev-evals/stop-req/`): four requirements-style wordings on the state the gate already sends (R0) and on states enriched with parsed check counts and per-file line counts did not separate wrong from true dones. Frozen on dev (a dev failure, best hard AUC 0.571); on 56 fresh sessions (5.79 USD, 49 in the population, 11 wrong dones) the shipped-state candidate has AUC 0.626 (task-clustered interval 0.432 to 0.791, p 0.107) against 0.543 for the shipped gate, recall 10 of 11 and false blocks 29 of 38, so the registered adoption rule fails and the signal of the contents study needed the code; the seen-once hold-out gives AUC 0.453. 2 833 Jev requests, about 0.11 USD. Nothing shipped changes.

## [0.2.1] - 2026-10-05

What changed in the measurements: `done` v2 was scored on 229 real GitHub Actions step logs from 94 repositories with Jev's answers. The first scoring (before any change) failed both registered bars: 2 wrong `met` of 76 and `met` recall among parsed logs 33 of 44 (0.75). This release adds a skip-marker cap and parsers for ninja, MSBuild, `docker build`, maven, swift and `cargo build`, written from the dev half only; afterwards wrong `met` is 0 of 76 and `met` recall among parsed logs is 65 of 75 (0.867), still under the 0.9 bar, so `done` v2 stays "not measured" on its old bar. The zero was reached by rules designed from two dev cases, so it is not a pass; the frozen hold-out half was looked at twice (the second look is stated as such) and one expected-`met` hold-out case regressed from `met` to `missing`. Exit-code-only evidence still almost never gets `met` by design. The plugin name `claude-referee` remains flagged as reserved by the Claude Code validator; CI tolerates only that error.

### Added

- Measured `done` v2 on the 229-case real CI log sample with Jev's answers (recorded 2026-10-05): wrong `met` 2 of 76 and `met` recall among parsed logs 33 of 44, so both registered bars failed; the frozen hold-out half has 0 wrong `met` of 33. The two wrong `met` are logs where skips show outside the parsed summary. Scored table and recorded answers are in `docs/data/done-v2-real/`; no log text is committed.
- `done` parsers for `ninja` (`cmake --build`), MSBuild (`dotnet build`), `docker build` (BuildKit plain progress), `maven`, `swift build` and `swift test` (XCTest and Swift Testing), the VSTest summary of `dotnet test`, and `make` errors (failed or ignored), written from dev-half real logs and the tools' own formats; a missing completion marker, an error or a cut-off log never reaches `met` ([decision](docs/decisions/native-build-parsers.md)). Five sent cases of `done-v2-h2`, `h4` and `h5` were re-recorded because their facts changed.
- Re-derived the real-log sample after the skip fix and the parsers (`docs/data/done-v2-real/after-parsers/`): wrong `met` 0 of 76, `met` recall among parsed 61 of 75 = 0.81 (bar 0.9, still failed; hold-out 28 of 38, parsed coverage 50.8% against 34.2%). Designed from the dev half, the hold-out is a regression check, not a clean test; `done` v2 stays not measured on the old bar.
- `done` parser for `cargo build` and `cargo check` gets a positive marker: the `Finished` line (strict shape, no error, no output after it, no chained command) goes to Jev as the summary; a missing, cut-off or chained build is `incomplete` and capped at `unsure`; cargo test, nextest and clippy logs keep their parsers ([decision](docs/decisions/cargo-build-marker.md)). Real-log sample re-derived (`docs/data/done-v2-real/after-parsers/cargo-build/`): wrong `met` 0 of 76, `met` recall among parsed 65 of 75 = 0.87 (dev 36 of 37, hold-out 29 of 38 on a second look, not an unseen test; one hold-out `met` was lost to the new guards); bar 0.9 still failed.

### Changed

- The clippy parser no longer claims verbose `cargo build` or `cargo test` logs because of `--warn=clippy::...` rustc lint flags (two dev logs were wrongly claimed).
- `done` caps `met` at `unsure` (`skipped_tests`) on a skip, pending, xfail or todo marker anywhere in the log (nested reporters, earlier summaries, unrecognised runners), not only in the parsed summary; the two wrong `met` of the real-log sample are gone, no other recorded case changed ([decision](docs/decisions/skip-markers-beyond-summary.md)).
- The package is on npm (`claude-referee@0.2.0`): `npx claude-referee` works, and the README no longer carries the "Not on npm yet" warning or the tarball alias.

## [0.2.0] - 2026-10-05

The measured state: `claims` and `judge` held on their hold-outs; `done` v2 is still not measured on its original bar (six invented hold-outs failed; a split bar was registered afterwards and rescored post hoc, see `docs/measurements-done-bar-split.md`); the Stop gate stays in `shadow` or `soft`, because in two synthetic studies it blocked nearly every success claim (precision about 0.1) and `active` is not recommended. The plugin name `claude-referee` is flagged by the Claude Code 2.1.287 validator as reserved; installs still work and CI tolerates only that one error.

### Changed

- The CI size tripwire for `dist/cli.mjs` moved from 280000 to 400000 bytes (v0.1.6 was 206 KB, now about 341 KB after the local ui, decide eval suites, judge baseline, i18n extractor, redaction patterns and stop-gate analysis; the limit now leaves headroom so it is not nudged again for each feature). It guards against unplanned growth, not safety; `hook.mjs` stays under 200000.
- bench: the four-arm A/B registration is superseded and archived (PREREG Appendix A); a two-arm delegation A/B (Claude alone against Claude with the judge, 4 public repositories pinned by commit, script-built labels, 16-session underpowered pilot) is registered instead. Harness, bench-only pack `bench-todo`, tests in `test/bench-delegation.test.ts`. Nothing beyond a 2-session dry run has been run.
- bench: delegation leak rule now excludes both arms of a (case, rep) block and flags outside-path reads (PREREG D8, amendment 3); no label file is written.

### Changed

- The Stop done-gate no longer reports a command Claude Code refused to run as a failed check. A Bash result that is an error and either carries `toolDenialKind` on its entry or starts with a real denial text (`This command requires approval`, the compound-command `... require approval` messages, `Newline followed by # inside a quoted argument`, `Permission for this action/command was denied`, `The user doesn't want to ...`, a `PreToolUse:<tool> hook error`, the auto-mode `temporarily unavailable` message) now has the status `denied`: the command did not run, so it is never a pass, never a fail, and never makes the stop skip; Jev receives it as `denied` in `checks`. Shapes taken from real transcripts, see `test/stopgate-marks.test.ts`. Found by the [stop-check study](docs/decisions/stop-check-detection.md); no recorded Stop eval case contains a denial, so no recording changed and no allowance moved.
- The rename to `evidence-referee` (235ebd8) was reverted before any release, so no migration is needed: the plugin data directory is `claude-referee-claude-referee` again. Anyone who ran the main branch in between has data under `~/.claude/plugins/data/evidence-referee-evidence-referee` to copy back. `receipts --usage` still counts calls under both names. Reason and accepted risk: [record](docs/decisions/rename-reverted.md).
- Known issue, accepted: Claude Code 2.1.287 `claude plugin validate` reports the name `claude-referee` as reserved for third parties (installs and runs still work; claude-mem fails the same validation). CI and `scripts/ci-local.sh` run `scripts/validate-plugin.mjs`, which ignores only that exact error for `claude-referee` and fails on every other validation error or warning; `--self-test` and `test/validate-plugin.test.ts` prove an unrelated defect still fails.
- The Stop done-gate no longer treats a `<task-notification>` entry (what Claude Code writes when a subagent or background command finishes: `origin.kind` `task-notification`, string content) as a new user prompt. Before, such a notification cut the turn, so edits made before it fell out and the stop was skipped as `no_edits`; the turn now runs back to the last prompt the user typed. The weak label hint no longer reads a notification as the user's next prompt either.
- A Bash check whose output was cut by Claude Code can no longer count as a passing check after the last edit: a result that starts with `<persisted-output>` (large output saved to a file, only a preview kept), holds `... [N lines truncated] ...` or `... [N characters truncated] ...`, or says the command was moved to the background after its timeout is never `passed` (it is `unknown`, and the stop is asked about instead of skipped as `check_passed_after_edit`). A cut output that already failed stays `failed`. The marker shapes were taken from real transcripts, see `test/stopgate-marks.test.ts`.
- Runner parsers no longer turn unrecognised output into `met`: biome needs its own tail (`No fixes applied.`, `Fixed N files`), a diagnostic header or a biome command; nix counts indented and space-less `error:` lines; Julia and kaocha count named or unnamed failures even when a clean summary is present.
- `done` caps `met` at `unsure` (`reason: "incomplete_run"`) when a parsed run is cut off before its summary, tested nothing, was cancelled, flaky or changed files (new runner fact `incomplete`), and caps a lint or clean criterion at `unsure` (`warning_in_log`) when a parsed runner reports warnings, not only for exit-code-only evidence.
- `done` caps `met` at `unsure` (`reason: "warning_in_log"`) when the evidence is only an exit code line, the criterion is about lint or being clean, and the log shows a warning or notice message (flags such as `--max-warnings` and "0 warnings" do not count). Build, typecheck and test criteria are unaffected. Decided with Jev (p 0.91, both orders agreeing); on the recorded hold-outs it caps 1 wrong `met` and loses 0 true ones ([record](docs/decisions/exit-code-only-met.md)). The question "should an exit code alone ever give met" is closed: yes, except in that case.
- `done` widens the exit-code-only lint cap (same `reason: "warning_in_log"`): besides warning and notice messages, a lint or clean criterion is now capped at `unsure` when the log (command lines, flags and negated phrases such as "0 errors" removed) has failure, skip, partial, error, violation or finding wording, or the command swallows its exit code (`|| true`, `--no-fail`, `--exit-zero`). Decided with Jev (round 1 weak 0.67, round 2 clear 0.96, both orders agreeing). Replayed on the recorded data it caps both wrong `met` of the sixth hold-out and loses 3 more true `met` (of the 13 exit-code-only lint true `met`, 4 are now capped, 1 before); fitted to the h4/h6 wrong cases, not a clean test ([record](docs/decisions/exit-code-only-lint-wide.md)).

### Added

- `i18n` pack with the `string.translatable` judge question (extends `generic`), and the `extract` command that finds candidate UI strings in JSX/TSX, Vue, HTML and UI calls, offline and free, as items for `judge --items`; `judge --items` accepts a per-item `context`. Recipe: docs/recipes/i18n.md.
- Added: split `done` v2 success bar by evidence class (R parsed, E exit code only, U neither), registered in `docs/decisions/done-bar-split.md`; offline rescoring scripts `scripts/done-bar/` (class, cluster, split, report) with tests.
- Added: frozen repository-level dev and hold-out split of the real-log sample (`docs/data/done-v2-real/split.json`) and a parser backlog ranked from dev only (`backlog-dev.json`).
- `scripts/session-study/replay-note.mjs`, an offline replay of a code-only Stop note (edits, no counted passing check, keyword success claim) over recorded study sessions; result in [docs/decisions/stop-code-note.md](docs/decisions/stop-code-note.md): not adopted, no mode built.
- Added [a decision record on Claude Mods](docs/decisions/claude-mods.md) (Claude Code 2.1.287): what a pane, band or status line can do, how a mod gets data, the security model, and a comparison with the planned localhost dashboard. Decision: wait; no mod is built yet (Jev tie, p 0.55 against 0.45, below the 0.90 bar).
- Registered a real-log hold-out for `done` v2 with metrics that do not conflict with the safety rule (wrong `met` 0, parsed coverage, `met` recall among parsed logs only); `done` v2 stays "not measured" on the old bar ([registration](docs/decisions/done-v2-real-logs.md)).
- Added `scripts/real-ci/` (fetch real GitHub Actions step logs with `gh`, label, score) and the sample: 229 cases from 94 repositories in 13 language buckets, after the registered 8-per-bucket selection and the ambiguous and silent-`met` drops ([results](docs/measurements-real-logs.md)).
- Result of the pre-registered hard-task Stop-gate study ([measurements](docs/measurements.md#the-stop-gate-on-hard-tasks-wrong-done-study)): 76 sessions on 32 trap tasks (the 8.00 USD cap stopped it at 7.88), 72 asked stops, 15 wrong dones in 74 usable sessions (0.203, exact 0.118 to 0.312; sonnet alone 0.093, haiku 0.625). H1 met, H2 met on the point estimate (14 of 15, 0.933, 0.681 to 0.998), H3 not met (51 of 53 asked true dones blocked), H4 not met (`claims_verified` AUC 0.398, exact p 0.880); precision of `would_block` 0.215, p95 631 ms, no Jev errors. A descriptive breakdown (score distributions, per-model and per-task figures, a threshold sweep with no point at precision 0.8, the roadmap's `active` criteria: stop count, p95 and error reporting met, precision, false blocks and the A/B not) is added; no threshold, pack or question changed, `active` stays not recommended. `scripts/session-study/cli.mjs breakdown` prints it.
- `bench/`: the pre-registration (`bench/PREREG.md`) and harness for the v0.4 A/B (no gate, a 20-line test hook, `/goal`, claude-referee in `soft` mode): frozen cases and controls with a pinned hash, arm configurations, a seeded Williams-square plan, a pilot sizing rule, the registered analysis and a resumable runner. The referee arm runs without the session-start briefing; the test hook acts on 7 of 16 cases and P1 is reported per stratum. Nothing has been run beyond a 4-session dry run (0.19 USD).
- A transcript cost accountant (`bench/cost.mjs`) that groups usage by request id and prices 1-hour and 5-minute cache writes separately from the official price table; in the dry run it matched the CLI's own total to 0.000001 USD, except for a `/goal` session where the evaluator's requests are not in the transcript (23.5% gap).
- Added `claude-referee ui`: a local dashboard on 127.0.0.1 behind a random 128-bit token (URL fragment, header), with Host, Origin and Fetch-Metadata checks, no CORS and a strict CSP. It has a labelling queue (the weak hint is shown, never applied), an overview with stop stats and exact intervals, privacy counters and a per-project export. `--port` and `--no-open`. No new runtime dependency, no network calls out, no telemetry ([security design](docs/decisions/ui-security.md)).
- `judge --baseline <file>` is a ratchet for adopting a rule on existing code: only findings not in the baseline count, so the verdict is `flagged` for a new yes only and `--fail-on flagged` fails on regressions. The result adds `new`, `baselined` and `gone`. `judge --baseline <file> --baseline-write` records the current yes answers (verdict `recorded`, with `recorded`, and over an existing file `added` and `dropped`). The file (`version` 1, the pack name, and per question a count per hash) holds SHA-256 prefixes of the question id plus whitespace-normalised text and nothing else; line moves and re-indentation stay known, an edited line is new, and duplicates match as a multiset. See [docs/judge-baseline.md](docs/judge-baseline.md) and [the design record](docs/decisions/judge-baseline.md).
- A composite GitHub Action (`action.yml`) that runs `done` on a test log and `claims` on the doc lines a pull request adds, uploads results and receipts as an artifact, and skips with exit 0 and nothing sent when no TypeSafe key is available (fork pull requests). The default claims source excludes real lockfiles, minified files and files with sensitive names (`.env*`, keys, credentials) by file name, and the runner's `CLAUDE_PLUGIN_OPTION_API_KEY` is ignored so the key input is the only key used. Recipe: [docs/recipes/github-action.md](docs/recipes/github-action.md).
- Result of the pre-registered Stop-gate base-rate study ([measurements](docs/measurements.md#the-stop-gate-on-self-generated-sessions-base-rate-study)): 119 self-generated sessions (24 seeded tasks, a hidden verifier each, haiku and sonnet), 100 asked stops, 1 wrong "done". The registered kill criterion fires: `active` is not recommended and the gate stays in `soft`. All 100 asked stops would have been blocked, 99 of them correct (51 of 51 and 48 of 48 in the two own-code strata); p95 655 ms, no Jev errors; `receipts --stops --label` reproduced the harness labels and gave `too_few_labels` for the threshold suggestion; the weak hint could not fire on single-prompt sessions. Self-generated tasks, one author, one model family, small n.
- `jev-evals/stop-hard`: 23 redacted hard-study sessions as a CI regression suite for the Stop gate (all 15 wrong dones expected `block`, 8 correct sessions expected `allow`; allowances 5 false blocks and 1 wrong negative, the observed counts). Recorded with `jev-1.13.0`.
- `jev-evals/stop-study`: 13 redacted real study sessions as a CI regression suite for the Stop gate (1 wrong "done" expected `block`, 5 skipped, 7 correct sessions the gate blocks, allowance 7 false blocks). New optional suite key `max_wrong_negative`: `eval score` reports `violated` when more expected positives than that get a definite non-positive verdict, a skip included; suites without the key score as before.
- `scripts/session-study/receipts-check.mjs`: labels a study run's stops through `receipts --stops --label` in an isolated data directory and reads back stats, threshold suggestion and weak-hint results.
- The fixture redactor now also scrubs the local account and host names (an `ls -la` owner column carried the account name).
- `eval` suites with command `stop`: a case names a redacted transcript and an expected `block` or `allow`, and the hook's own analysis, skip rule, request and decision run on it (code-skipped cases score as `skipped`). The shared rules moved to `src/engine/stopgate/decide.ts`. `jev-evals/stop-sessions` holds 12 synthetic seed cases with recorded `jev-1.13.0` answers, and the offline score allows the 2 false blocks observed on them. `scripts/session-study/` holds the harness of the pre-registered base-rate study (24 seeded tasks, hidden verifiers, a budget cap) and the redactor that turns its sessions into fixtures. The CLI bundle size check is now 280000 bytes (the transcript analysis moved into it).
- Stop done-gate wording measured, not changed: 40 invented final messages (20 negated such as "I haven't run the tests", 20 done-claims; a second labeller agreed on all 40) with `scripts/stop-wording.mjs`; the current `stop.claims_done` wording blocked none of the 20 negated messages (dev and hold-out) and 19 of 20 done-claims, so the pre-registered screen stopped before any variant reached the hold-out ([record](docs/decisions/stop-negation.md), [numbers](docs/measurements.md#the-stop-gate-on-negated-sentences)).
- Stop done-gate marks in `stops.jsonl`, code-side facts only and not sent to Jev (no measurement shows that sending them helps): `truncated_checks` (checks whose output was cut), `subagent_calls` (Agent or Task launches in the turn), `subagent_reports` (subagent or background-task finish notifications in the turn), `stale_pass` (the turn edited, has no passing check after its last edit, and the previous turn had a passing check; a final message that says "tests pass" may be repeating that). Each appears only when it applies, on skipped and asked stops alike, and none can turn a stop into a skip.
- `done` parses `cargo nextest`, Perl `prove`, `dart test`, `flutter test`, Julia `Pkg.test` summaries, `behave`, `kaocha`, `tox` (4 and 3), `biome`, `next build` and `nix build` output in code, written from real runs and the tools' own source ([sources and limits](docs/decisions/runner-parsers-met-recall.md)). `cargo nextest` logs were read by the `cargo build` parser with no tests counted; they no longer are. Failures, errors, skips, pending items, a missing summary or a run that tested nothing give facts that cannot be `met`. On the fifth hold-out text the changed cases moved to dev (9 of 11 expected `met` now `met`, 0 wrong `met`; dev numbers, not a pass).
- `docs/verify-skill.md` and `docs/recipes/verify/SKILL.md`: a copyable project `verify` skill that pipes the test output to `claude-referee done` before a commit (Claude Code 2.1.286 guidance, cited in the page). The plugin does not install it; a test checks its frontmatter. The recipe appends an `exit code:` line, says what to do without a verdict (for example the pre-publish npx 404), and the page carries a not-on-npm note and a privacy note (test output is sent to the TypeSafe API).
- `receipts --stops`: a weak label hint for an unlabelled `would_block` stop, read from the user's next prompt in the session transcript. Only `right` is ever suggested, with reason `reported_broken` (the prompt says it does not work, fails, errors, English or Turkish; negated, hypothetical, question and instruction clauses such as "no crash", "add a failing test" or "do not run the tests" are ignored, so a missed report is preferred over a wrong hint) or `repeated_request` (it largely repeats the prompt of the turn that stopped). Approval, thanks and silence suggest nothing (decided with Jev, p 0.95, both orders). The hint is computed on read, stored nowhere, never printed with the message text, never counted in stats and never overrides a human label.
- `receipts --stops` returns `threshold_suggestion`: available only with at least 10 human labels of each class on `would_block` stops. It uses exact Clopper-Pearson 95% intervals (no dependency) and suggests the smallest `claims_done` at or above the current threshold whose kept labelled stops have a precision lower bound of 0.8 or more, or null; it never suggests lowering it and writes nothing.
- `hooks.stopGate: "soft"`: like `shadow`, and when Jev would block the Stop hook also prints one `systemMessage` warning (shown to the user, no block, no context for Claude). Stops are recorded with `mode: "soft"`.
- Receipt integrity: each receipt carries `prev`, the sha256 of the previous line of its project's chain, and `receipts verify [--project-only]` reports breaks (`mismatch`, `fork` from two runs appending at once, `unreadable`); receipts written before this are counted as `unchained`. `receipts overrule <id>` records a human veto in `overruled.jsonl` and deletes the cached answers that receipt used, so the next run asks Jev again. Receipts now list the `cache_keys` they used. The chain detects edits and deletions in the middle of the history; it does not stop someone who rewrites it from the start or truncates its end.
- `eval` now handles `decide` suites. `eval record` asks both option orders per case; `eval score` reports leader agreement with the labelled best option, the clear/weak/tie mix, order disagreements and agreement per verdict as raw counts, with no precision, recall or pass/fail threshold. Metric choice and first numbers: [docs/decisions/decide-eval-metric.md](docs/decisions/decide-eval-metric.md).
- `eval record` and `eval score` take `--ablation context|reversed` for decide suites: `context` leaves the context text out of the request, `reversed` asks the written order only (rescored from the same recording, no request).
- New suite `jev-evals/decide-best`: the 39 close-call decisions with one author-written best option each, recorded against `jev-1.13.0`.
- More credential formats stop a request before it is sent: Stripe live keys (`sk_live_`, `rk_live_`), npm, PyPI, Hugging Face, SendGrid, Google API and GitLab tokens, Telegram bot tokens, Azure storage `AccountKey=` values, Docker `auths` entries, Slack webhook URLs and `xapp-`/`xoxe` tokens, and PGP and PuTTY private key blocks. Test and publishable Stripe keys are kept. Each format has stop and keep fixtures; which formats were added, why, and which were left out (Twilio, Mailgun, Discord) is in `docs/decisions/redaction-patterns.md`.

### Documentation

- `docs/decisions/decide-policy.md`: `decide` keeps two separate requests (written and reversed order) for 2 to 6 options. One request with two questions and balanced rotations were not adopted: no measured benefit beyond noise, and nothing measured for other than 4 options. Jev decide: keep two requests 0.99, both orders agreeing.

### Fixed

- `eval score` fails on a recorded decide line that lacks an answer for an order instead of scoring it as a tie, and recordings are matched by their `ablation`: `eval record --ablation reversed` no longer writes a line (it needs the full recording and records nothing), so it cannot shadow the two-order recording.
- Redaction: Telegram bot tokens in the Bot API URL form (`.../bot<id>:<secret>/getMe`) now stop a request. The token pattern requires the `AA` secret prefix, so numeric strings like `20260101:...` no longer stop; Hugging Face tokens need a digit, so long identifiers such as `hf_getUserSessionToken...` no longer stop.
- Added a weekly canary workflow that installs the plugin with the latest and the pinned Claude Code in an isolated config dir, and a local `scripts/canary-install.mjs` (also run by `npm run ci:local` when `claude` exists).
- Added docs/decisions/name-canary.md with the detection scope and the unexecuted `evidence-referee` fallback plan.

## [0.1.6] - 2026-10-01

### Changed

- `done` never says `met` when the log itself says no tests ran (`no tests to run`, `no tests found`, `0 tests executed`, `Tests run: 0`, `nothing to run`), even with an exit code of 0: `unsure` with `reason: "no_tests_run"`.

### Added

- `jev-evals/claims-tr`: 44 invented Turkish claim and source pairs (registered in `docs/decisions/claims-tr.md`); no wrong `supported`, 13 of 17 true claims confirmed.
- `claims` is the new name of `verify`, so it isn't confused with Claude Code's own `/verify`; `verify` stays an alias until 1.0 and behaves the same. Receipts still record the command as `verify`.
- `jev-evals/done-v2-h4`: a fourth hold-out for `done` v2 (46 cases, registered in `docs/decisions/done-v2-holdout4.md`); it failed its registered check, and the suite's allowance is the 1 remaining observed wrong `met`.
- `jev-evals/done-v2-h6` and `done-v2-h6p`: a sixth hold-out for `done` v2 (53 cases in tools without parsers, labels agreed by a separate second labeller) and a separate 8-case parser regression group, registered in `docs/decisions/done-v2-holdout6.md`. The main set failed its registered check on all three counts (2 wrong `met` from exit-code-only lint logs, `missing` found 0.84, `met` found 0.50; tests criteria 1 of 11, lint and build 10 of 11); the parser group had 0 wrong `met` and 4 of 5 expected `met` found. Nothing was tuned; `done-v2-h6` allows the observed 2 wrong `met`.
- `jev-evals/done-v2-h5`: a fifth hold-out for `done` v2 (47 cases in new tools, registered in `docs/decisions/done-v2-holdout5.md`, one labeller); 0 wrong `met`, `missing` found in 23 of 25, `met` found in 11 of 22 (0.50), so the registered check failed on that count. Nothing was tuned on it; the suite allows 0 wrong `met`.

## [0.1.5] - 2026-10-01

### Fixed

- Labelling a stop (`receipts --stops --label`) rewrote the whole `stops.jsonl`, so a stop recorded by another session at that moment could be lost. Labels are now appended to `labels.jsonl` and merged on read; labels written inline by earlier versions are still read. The size-based pruning of old stops now skips the rewrite when the file changed under it.
- A project's `stop.gate` threshold for `claims_verified` or `blocked` could only be raised, which made the done-gate fire more, the opposite of "a project can only make a check stricter". Those two now accept only a lower value. Shadow mode only; `decideStop` now has direct tests for every threshold edge.

### Changed

- `done` never says `met` when tests were skipped, risky or incomplete (a skipped or ignored count above 0, or PHPUnit's "OK, but incomplete, skipped, or risky tests!"): the verdict is `unsure` with `reason: "skipped_tests"`, whatever Jev answers. The skipped count stays in the facts.

### Added

- Parsers for `node --test` TAP output, the `eslint` summary line (warnings are a separate fact), `tsc -b`, `golangci-lint`, `vite build` and `cargo build`/`check` (warnings are a separate fact). Fewer runs depend on an exit code alone. PHPUnit's `Risky:` and `Incomplete:` counts now count as not fully passed (in `skipped`). The 10 cases of `done-v2-h3` and one of `done-v2-h2` that these changed moved to `done-v2` as dev.
- `jev-evals/done-v2-h3`: a third hold-out for `done` v2 (46 cases, registered in `docs/decisions/done-v2-holdout3.md`). It failed its registered check (2 wrong `met`); the suite's allowance is those 2 observed cases.
- Parsers for Python `unittest` and `cargo clippy`. Clippy output reports its warnings as a separate `warnings` fact, so a criterion like "lint is clean" no longer rests on an exit code alone.
- `jev-evals/done-v2-h2`: a second hold-out for `done` v2 (45 cases, registered in `docs/decisions/done-v2-holdout2.md`). It failed its registered check with one wrong `met`; the suite's allowance is that one case. `eval` now applies the non-zero exit-code rule like `done` does.
- `scripts/hook-latency.mjs` and a CI step: a hook process must stay within 40 ms of a bare `node` at p95 (measured locally: +27.5 ms and +24.5 ms).
- `receipts --stops` also reports `errors`, `error_rate` and `p95_all_ms`: Jev errors and breaker skips are counted, and the p95 covers failed calls too, so a slow failure can no longer make the gate's latency figure look better.

## [0.1.4] - 2026-10-01

Correction: the done-gate in `shadow` mode, `lint-pack` and `verify` v2 shipped in 0.1.3 (`git log v0.1.2..v0.1.3`), although the sections below list them under 0.1.2; the released sections were left as they are.

### Fixed

- A timeout or abort that fires after the API's headers have arrived no longer kills the CLI and the hooks with an uncaught `AbortError` or `TimeoutError` and no output. The SDK (0.6.0) leaves that rejection behind; only those two are ignored, the command now ends with its JSON `timeout` line. Covered by a test that runs in CI on Node 22 and 24.
- A PHPUnit `Tests: 45, Assertions: 90` line was read as a jest summary, which put a phantom `jest 0/0/0/0` runner next to `phpunit` in the facts sent to Jev. The jest parser now needs a `passed`, `failed`, `skipped`, `todo` or `total` count on its `Tests:` line. 4 `done-v2` cases whose evidence changed were re-recorded; no wrong `met`, and the held-out counts did not move (15 of 18 `met`, 27 of 30 `missing`).
- A probability exactly on a band is no longer pushed over it by float arithmetic: `judge` now counts 0.10 as `no` at the 0.9 band (`1 - 0.9` is 0.0999...8 in JavaScript), and `decide` counts a margin of exactly 0.1 as `weak` instead of a tie.
- The TypeSafe key is sent only to `https://api.typesafe.ai`. A `TYPESAFE_BASE_URL` pointing elsewhere (for example set by a project's `.claude/settings.json` `env`) used to receive it; now it needs its own `REFEREE_BASE_URL_KEY`, and without one no request is made and `doctor` says why. The three live-check scripts follow the same rule.

### Changed

- `done` with a non-zero exit code in the evidence (an `exit code: N` line) answers `missing` with `reason: "exit_code_nonzero"` and does not ask Jev, even after a clean runner summary; `--dry-run` still shows the request. A criterion that is about the failure itself can't be judged this way.

### Added

- `eval` handles `judge` suites (`suite.json` with `"command": "judge"` and a `question`; cases with `text` and an expected `yes`, `no` or `review`), and `eval record` takes `--max-requests` and `--max-usd`: it stops before the first request when more cases are still to record, or the estimated input cost is higher.
- `jev-evals/judge-risky` and `jev-evals/judge-env`: 62 invented labelled cases each for `line.risky` and `failure.env`, with their recorded answers; both suites allow no wrong `yes` and pass.
- `scripts/docs-watch.mjs` and a weekly workflow compare TypeSafe's `models.md`, `api.md` and `llms.txt` with the hashes in `docs-watch.json` and fail when one changes, printing the limits row; TypeSafe's limits changed once without an announcement we could find.
- CI scans the whole git history with gitleaks 8.30.1 (pinned, checksum verified); `.gitleaks.toml` allows only the fake-credential fixtures in `test/redact.test.ts`, `test/key.test.ts` and `test/doctor.test.ts` and the case ids in `jev-evals/decide-close/subsets.json`. The history scan of 67 commits found nothing else.

## [0.1.3] - 2026-10-01

## [0.1.2] - 2026-10-01

### Added

- `lint-pack <dir> [--recorded <evals dir>]` checks a pack's questions against TypeSafe's question-writing rules and flags a Noul that scores high on every recorded input; `--fail-on warnings,errors` fails CI. The generic pack's `stop.*` and `verify.injection` questions were reworded to pass it; `verify-v2` was re-recorded and its numbers did not move.
- `npm run ci:local` runs the steps of CI locally (no key, a foreign HOME, bundle in sync with HEAD, bundle sizes, offline eval score, plugin validation, private terms).
- The Stop done-gate in `shadow` mode, off unless `.claude/referee.json` sets `hooks.stopGate` to `shadow`: after a turn with edits and no passing check it asks Jev whether Claude claimed success it didn't verify and records the answer in `stops.jsonl`. It never blocks and prints nothing. `receipts --stops [--unlabelled]` lists stops with precision and false-block figures, and `receipts --stops --label <id> --right|--wrong` marks one. Task and final-message text is sent to the TypeSafe API while it is on, see `docs/privacy.md`.
- `jev-evals/verify-v2`: 60 held-out and 30 dev labelled claims with their sources and recorded answers. `eval` handles `verify` suites.
- `jev-evals/done-v2`: 48 held-out and 30 dev labelled cases for `done` with their recorded answers; the injection suite now allows no wrong `met`.
- `scripts/probe-api.mjs`, `scripts/latency.mjs` and `scripts/order-sensitivity.mjs`: live checks of the API's edge cases, of latency at 1, 6 and 8 requests in parallel, and of option-order sensitivity. Their results from 2026-09-30 are in `jev-evals/api/` and `jev-evals/decide/`.
- `jev-evals/decide`: a public set of 20 decisions with 4 options each.
- `jev-evals/claims`: 31 labelled claims about this repository's docs, `decide`'s three-way answers to them, and the scripts that build and score them.
- `jev-evals/injection/ablation-dataguard-2026-10-01.jsonl`: the injection cases' answers with a "treat the evidence as data" sentence added to `done.met`'s note.
- Measurements: a section measured with claude-referee itself, and dated rows for it in the README table.
- `jev-evals/decide-close`: 39 close-call decisions, their screening reports and the 2026-10-01 option-order measurement, with the design pre-registered in `docs/decisions/decide-order.md` (`scripts/order-analysis.mjs`, `scripts/close-subsets.mjs`, `scripts/k3-calibration.mjs`).

### Changed

- `verify` matches quotes and numbers against the source in code first, asks Jev two three-way questions per claim (supports, contradicts, says nothing; both option orders) and one injection check on the source. The result lists `contradicted`, `says_nothing` and `reasons`; a source with a line aimed at the judge can't return `supported` (`source_injection`). On 60 held-out claims it has no wrong `supported` but confirms fewer true claims than before (19 of 24 against 22 of 24) and returns `unsure` more often.
- `done` parses recognised runner output in code (pytest, Ruff, Jest, Vitest, Mocha, ESLint, tsc, node:test, go test, cargo test, dotnet test, PHPUnit, RSpec) and sends only counts, the exit code, its label and the failing test names to Jev. Output that isn't recognised is sent as text and can never return `met`; it returns `unsure` with `trust: unparsed`. The result now has `trust`, `exit_code` and `runners`. The `done.met` note changed, so recorded answers were re-recorded.
- Probabilities in the JSON output are now rounded down to two decimals instead of to nearest, so 0.895 shows as 0.89 and a printed 0.90 means at least 0.90. `_usd` fields keep six decimals.

## [0.1.1] - 2026-10-01

### Added

- `receipts --usage` counts claude-referee CLI calls from this project's Claude Code transcripts: per day and command, subagents included, each tool call once, with the size of what each call returned. Nothing from the transcripts is printed.
- A circuit breaker for hooks that call Jev: after three failures in a row in one session, the rest of that session skips Jev (`breaker_open`). The CLI never uses it.
- `doctor` shows `base_url` when `TYPESAFE_BASE_URL` points somewhere other than the default, without credentials or query.
- `jev-evals/injection`: 33 test logs, with and without a note addressed to the judge, and Jev's answers from 2026-10-01. The measurements page and SECURITY.md describe the result.
- `eval record --suite <name|all>` asks Jev once per case of a suite under `jev-evals/` and appends the answers to `recorded.jsonl`, keyed by hashes of the question text and the redacted input. Cases already recorded are skipped unless `--fresh`.
- `eval score` re-scores recorded answers offline, without a key: verdict counts, precision, recall, automation and wrong positives, plus `--sweep`, which won't suggest a threshold while a class has fewer than 10 cases. It fails when a case has no recording or its question text changed.
- CI scores every recorded suite and fails when a suite's wrong positives exceed its `max_wrong_positive`. The injection suite allows one: the known wrong `met`, kept visible until `done` v2 fixes it.

### Changed

- README: a `judge` example, a pointer to TypeSafe's official plugin, and notes on Node's `PATH` and on Windows being untested. Diff examples use `git diff --no-ext-diff`, so an external diff tool can't empty the pipe.
- The session briefing prints the CLI path once and fits in 600 characters with a long installed plugin path.
- CI also runs the tests on macOS.
- The README uses the final design: new images, the yellow-card mark and plainer wording, checked section by section with Jev.
- Measurements now include the cache re-run and label the briefing numbers by version.

### Fixed

- `decide` no longer sends the home directory to TypeSafe in `context_files` paths: object keys in the request state are now redacted like values, so the home directory in a key becomes `~`.
- Two state keys that redact to the same text are both kept; the later one gets a `#2` suffix.
- A failed write to the data directory no longer loses the verdict: the result still prints, with a one-line warning on stderr.
- The plugin's `model` setting now reaches the CLI: the session hook exports it as `REFEREE_MODEL`.
- `--verbose` prints the run's requests, tokens, cost and time to stderr.
- `decide` uses a pack's `decide.micro.*` questions when the input has no `micro`.
- The session hook treats `false`, `0`, `no` and `off` in `hooks_enabled` as off.
- Code such as `inputTokens: reply.inputTokens` or `apiKey = config.apiKey` no longer stops a request as a secret assignment: a value made only of dotted letter segments, with no digits, is treated as code.
- `judge` and `verify` keep the answers they got when one request fails or the 90-second batch deadline passes; items without an answer are listed in `unanswered`, and `judge` never calls such a run clear.
- The client reports `rate_limited` at once when a 429's Retry-After is longer than the time budget.
- An unknown model now gets a `next_step` that names the model and points to `doctor --online`.
- `decide` rejects option names made only of digits, which would defeat the reversed order.
- `--dry-run` writes nothing to disk; long requests are shortened inline, and `--pretty` shows them in full.
- The no-key hint says `--values-stdin` needs Claude Code 2.1.285 or later.

## [0.1.0] - 2026-09-30

First public release.

### Added

- `done`: checks piped test or lint output against one or more criteria; verdicts `met`, `unsure` and `missing`.
- `decide`: scores 2-6 options, asking in the written and the reversed option order; verdicts `clear`, `weak` and `tie`, with a `lean` and `order_disagrees`. Reads `context_files` itself, supports per-option micro questions reported as flags, and switches to per-option scores when the options don't fit one request.
- `judge`: runs a pack's yes/no questions over up to 500 items, six requests at a time.
- `verify`: checks up to 100 claims against a source text, with the probability of each claim it can't confirm.
- `receipts`: totals, per-day token rows with `--tokens`, and `receipts export`.
- `doctor`: Node and Claude Code versions, where the key comes from (never the key), data directory, packs and model; `--online` checks the key with one free call.
- `--describe`, `--pretty`, `--dry-run`, `--fresh`, `--fail-on` and `--data-dir` on every command that needs them.
- Redaction before every request: credential-shaped values stop the request; emails, IP addresses, the home path and, in the `generic` pack, UUIDs are replaced.
- Local receipts and a 30-day answer cache; identical requests in flight are merged.
- API key lookup: plugin setting, `TYPESAFE_API_KEY`, `EVAL_TYPESAFE_API_KEY`, `TYPESAFE_API_KEY_CMD` and the macOS Keychain.
- The SessionStart briefing, at most 800 characters, only in projects with `.claude/referee.json`.
- The `generic` pack and the `jev` skill.

[0.1.3]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.3
[0.1.2]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.2
[0.1.1]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.1
[0.1.0]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.0
