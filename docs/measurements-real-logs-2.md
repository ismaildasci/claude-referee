# done v2 on a second real-log sample: the first unseen test

Registered in [done-v2-real-logs-2.md](decisions/done-v2-real-logs-2.md) on 2026-10-05 (registration commit `d5d14f3`, amended once before any label, see "Deviations"), before any run or log of this sample was fetched. Code frozen at `6ff4d0aaa61f4b90dffcb4c71f150da93495a319` (tag `v0.2.1`); the plugin CLI, the redaction screen, `parseEvidence` and `doneRequest` all ran from a `git archive` of that tag, one recording (receipt `rmuveb0ms866t`, `jev-1.13.0`), nothing changed afterwards. `done` v2 stays "not measured" on the old bar.

**Result: all three registered Jev-dependent bars failed on unseen data.** Wrong `met` 2 of 85 expected-`missing` sent cases (bar 0); `met` recall among parsed cases 69 of 79 = 0.873 (bar 0.9, evaluable); `missing` recall 45 of 85 = 0.529 (bar 0.9). Both wrong `met` are parsed (class R) logs; exit-code-only (class E) has 0 wrong of 56. One of the two wrong `met` rests on a label I think is contestable (below); the registered count stays 2.

## Sample

| | First sample (2026-10-02) | Second sample (2026-10-05) |
| --- | --- | --- |
| Repositories contributing cases | 94 (13 buckets) | 126 (17 buckets: the 13 plus Dart 6, Elixir 6, Scala 6, Shell 6) |
| Runs | last 80 days before 2026-10-02 | created at or after 2026-10-04T00:00Z |
| Cases kept | 229 | 272 (231 sent to Jev, 41 failed steps decided in code) |
| Failed-step share | 13.1% (target 20%) | **15.1%** (41 of 272; target 25%, **not reached**) |
| By criterion (kept) | tests 99, lint 50, build 80 | tests 123, lint 60, build 89 |
| Succeeded steps, expected `met` / `missing` | 123 / 76 | 146 / 85 |
| Max cases per repository | 5 | 5 (3, plus up to 2 failed from the top-up; 12 repositories have more than 3) |
| Labeller 2 share, agreement, kappa | 30%, 66 of 67, 0.966 | 40% (98 cases), 97 of 98 = 0.990, 0.978 |
| Parsed coverage of sent cases | 34.2% (50.8% after the dev parsers, fitted) | **108 of 231 = 46.8%** (exact 40.2% to 53.4%) |
| Jev requests | 181 (+18 cached) for 199 | 206 (+25 cached) for 231; receipt `rmuveb0ms866t` |

Repositories were chosen per bucket in star order from `gh search repos ... pushed:>2026-10-03 --limit 100`, skipping the 94 repositories of the first sample's `split.json` and `ripgrep`. Accepted: 8 per bucket for the 13 old buckets and 6 for the four new; 128 accepted at fetch, 126 after the screen and label drops left cases (Go 7, Rust 7). The license of every inspected repository is in `docs/data/done-v2-real-2/repos.json` (of the 126 contributing repositories: 42 MIT, 28 Apache-2.0, 13 GPL-3.0, 9 AGPL-3.0, 21 "other", the rest various); no log text is committed, as registered. 483 candidate repositories were inspected in all (`repos.json`); the others yielded no case (no run in the two-day window, no plain `run:` test, lint or build step, or only dropped jobs; not counted per repository).

**Dropped, counted.** 449 jobs had a segment count that does not match the mapped steps (composite actions, groups), 6 job logs were gone, 11 steps matched more than one purpose; 2 cases stopped by the redaction screen (`secret_assignment`); labelling dropped 5 ambiguous (4 by labeller 1, 1 by labeller 2) and 9 silent-`met` (a `met` label on output that is only the command echo plus the exit line); 0 disagreements between the labellers on the 98 double-labelled cases (so none dropped for that). By the registered rule every one of these was dropped before any Jev answer.

**Labelling cost.** Labeller 1: 49 `claude -p` batches, $13.26 as reported by the CLI (`total_cost_usd`); labeller 2: 20 batches, $4.50; total about $17.76, both on the Claude quota. The Jev requests cost about 206 x $0.00004 = $0.008.

**Registered code-level check.** All 135 succeeded cases whose native text has no recognised runner and no exit line, fed to `doneRequest` with p = 1.0: 0 returned `met` (violations: none).

**By language (parsed of sent):** C 4/19, C# 12/19, C++ 6/17, Dart 7/10, Elixir 2/13, Go 8/13, Java 12/14, JavaScript 9/18, Kotlin 2/8, PHP 6/14, Python 7/17, Ruby 2/10, Rust 14/17, Scala 4/7, Shell 1/9, Swift 5/10, TypeScript 7/16. **By criterion:** tests 65/98 (66.3%), lint 10/50 (20.0%), build 33/83 (39.8%). Intervals in `report.json`.

## Registered bars

Intervals: exact two-sided 95% Clopper-Pearson over cases, then the repository-level bootstrap (B = 2000, resampling repositories, percentile 2.5 / 97.5). For wrong `met`, where the bootstrap is degenerate at 0 events, also the repository-clustered exact one-sided bound (unit = repository). (`report.json` prints a "repo_clustered" block for every ratio; it is meaningful only for wrong `met`.)

| Registered bar | Result | Exact 95% | Repo bootstrap 95% | Verdict |
| --- | --- | --- | --- | --- |
| 1. Wrong `met` = 0, pooled | **2 of 85** (one-sided upper bound 7.2%; repository-clustered 2 of 64 repositories, bound 9.5%) | 0.003 to 0.082 | 0 to 0.060 | **failed** |
| 1. Wrong `met`, class R | **2 of 29** (bound 20.2%; clustered 2 of 25, 23.1%) | 0.008 to 0.228 | 0 to 0.167 | **failed** |
| 1. Wrong `met`, class E | 0 of 56 (bound 5.2%; clustered 0 of 43, 6.7%) | 0 to 0.064 | degenerate | met (weak, wide bound) |
| 1. Wrong `met`, class U | 0 of 0 (U is empty by construction: the exit line is always appended) | | | not applicable |
| 2. `met` recall among R >= 0.9 (n = 79 sent R expected-`met`, evaluable) | **69 of 79 = 0.873** | 0.780 to 0.938 | 0.800 to 0.935 | **failed** (0.873 < 0.9; the interval includes 0.9) |
| 3. Class E: `met` recall, report only | 0 of 67 | 0 to 0.054 | degenerate | reported |
| 3. Parsed coverage, report only | 108 of 231 = 0.468 | 0.402 to 0.534 | 0.388 to 0.543 | reported |
| 4. `missing` recall >= 0.9 (all sent; carried from the split bar) | **45 of 85 = 0.529** | 0.418 to 0.639 | 0.408 to 0.659 | **failed** |

`missing` recall by class: R 5 of 29 = 0.17 (0.058 to 0.358), E 40 of 56 = 0.71 (0.578 to 0.827). Verdicts on the 231 sent cases: `met` 71, `missing` 85, `unsure` 75. By class and expected label: R expected `met` 69 `met` / 7 `missing` / 3 `unsure`; R expected `missing` 22 `unsure` / 5 `missing` / 2 `met`; E expected `met` 33 `missing` / 34 `unsure` / 0 `met`; E expected `missing` 40 `missing` / 16 `unsure` / 0 `met`. Duplicate evidence hashes: 0 (clustering by evidence is a no-op, as in the first sample). The 41 code-decided cases are all `missing` with no request.

How hard the negatives were. Of the 85 expected-`missing` sent cases, 41 are `ran_not_clean` (the check ran and shows a skip, warning, zero tests or failure; the caps would still allow `met` in 8) and 44 are `not_run` (the step only mentions the tool; 40 of those pass the caps). Offline, if Jev answered p = 1.0, `met` is reachable for 74 of 79 R expected-`met`, 3 of 29 R expected-`missing`, 66 of 67 E expected-`met` and 45 of 56 E expected-`missing`: so in class E only Jev's answer stood between 45 of the 56 negatives and a wrong `met` (it gave 0), and in class R the caps stop 26 of 29 whatever Jev says.

## Side by side with the first sample

| | First sample, registered run (code before the fixes) | First sample, final code (0.2.1; fitted on its dev half) | Second sample, frozen 0.2.1 (unseen) |
| --- | --- | --- | --- |
| Wrong `met` | 2 of 76 | 0 of 76 (hold-out 0 of 33) | **2 of 85** |
| `met` recall among parsed | 33 of 44 = 0.75 | 65 of 75 = 0.867 (dev 36 of 37, hold-out 29 of 38 = 0.76) | **69 of 79 = 0.873** |
| Parsed coverage of sent | 34.2% | 50.8% | 46.8% |
| E `met` recall | 1 of 79 | about 1 of 48 | 0 of 67 |

The first-sample numbers carry the fitting caveats of [measurements-real-logs.md](measurements-real-logs.md): the code was written from its dev half, and its hold-out was scored three times. The recall among parsed cases is about the same on unseen data (0.873 against 0.867 and 0.76 on the hold-out), so the parsers did not simply overfit the first dev half, and they do not reach 0.9. Wrong `met` did not stay at 0: two cases got through. The first-sample 0 of 76 was never a bound of "no wrong `met` exists" (upper 3.9%); here the bound is 7.2%.

## The two wrong `met`

Both are single-labeller labels (neither was in the 40% second-labelled share), both parsed, both with high p. Nothing was fixed in this task.

- **`rl-7c6caf48`, `google/gson`, Java, criterion "all tests pass", Jev p 0.93.** The step "Verify no plugin issues" runs `mvn artifact:check-buildplan --projects '!metrics,!test-graal-native-image,!test-jpms,!test-shrinker'`; the unchanged classifier labelled it purpose `test`, tool `maven test` (the `mvn ... test` pattern; the project list contains `test-` names). The log shows `No known issue in N plugins` four times and `BUILD SUCCESS`; no test was run. Label `missing` (no tests executed): correct on the log. Why the code missed it: the `maven` parser in `src/engine/runners/native.ts` counts every `BUILD SUCCESS` line as `passed` when there is no `Tests run:` line (`passed: run > 0 ? ... : ok`), so a build-only goal is reported to Jev as 1 passed test; no cap applies, and Jev accepts the parsed summary. The parser was written for the build criterion and also fires under the tests criterion.
- **`rl-c4542111`, `coteditor/CotEditor`, Swift, criterion "all tests pass", Jev p 0.98.** `swift test --package-path "Packages/EditorCore"`, a log of 92,520 characters, cut by `doneEvidence` to the first 2,000 and last 12,000 (78,509 omitted). The shown part has four Swift Testing summaries, `Test run with 47 tests in 8 suites passed ... with 4 known issues` (after a line `recorded a known issue ... Expectation failed`), then 12, 13 and 11 tests passed; the parser reports 11 passed, the last summary only. The labeller said `missing` ("4 known issues; expectations failed"). **I think this label is contestable**: in Swift Testing, a known issue is an expected failure marked by the author (`withKnownIssue`), and the test passes; whether "all tests pass" is shown with expected failures present is the same question as the first study's skipped tests, and the conventions say skipped or incomplete tests mean not shown, which suggests treating known issues the same way, but no rule of the registration names them. The parsed count therefore covers one of four runs and ignores the known issues. Reported as a wrong `met` because the registration fixes labels before scoring and nothing is relabelled after Jev's answers; a human reading may call it a correct `met`, in which case pooled wrong `met` is 1 of 85 (one-sided bound 5.5%) and the bar still fails on the gson case.

## Recall misses among parsed expected-`met` (10 of 79)

`rl-1c13f280` (`npm test` wrapper, `missing` 0.03), `rl-f7ad7be8` (maven build, `unsure` at p 0.98), `rl-c659bc38` (checkstyle, `missing` 0.24), `rl-2017f35f`, `rl-80adf7d3`, `rl-db9ff0ad` (`npm run build` wrappers; `missing` 0.40, 0.29, `unsure` 0.65), `rl-f732be66` (maven test, `missing` 0.13), `rl-e7b16d31` (cargo test, `unsure` 0.6), `rl-a9656f54` and `rl-92dc2301` (clippy, `missing` 0.25 and 0.24). Most are the same shape as the first sample's remaining misses (wrapper builds, clippy, no positive marker for a clean lint). Not analysed further, not fixed.

## Tools without a parser in this sample (backlog, unparsed sent cases; cases / expected `met` / repositories)

`cmake --build` 21 / 8 / 12, `make` 7 / 7 / 5, **`mix test` (Elixir, new bucket) 10 / 5 / 5**, `npm run build` wrappers 7+3 / 5+2 / 6+3, `phpstan` 4 / 4 / 4, `ctest` 8 / 3 / 5, `make test` 7 / 3 / 6, `npm test` wrappers 5 / 3 / 2, `xcodebuild` 3 / 3 / 1, `rubocop` 6 / 2 / 3, `npm run lint` wrappers 3+2 / 2+2 / 3+2, `go build` 3 / 2 / 3, `dotnet build` 2 / 2 / 2 (a parser exists, output not recognised), `clang-tidy` 5 / 1 / 4, `docker build` 3 / 1 / 3 (parser exists, not recognised), `hadolint`, `pylint`, `phpcs` 1 each. 45 tools in all, in `backlog.json`. Dart is parsed 7 of 10 and Shell 1 of 9 (no `shellcheck` or `bats` parser). Frequency here is an unseen-sample ranking; no parser was written from it in this task.

## Deviations and limits

1. **Amendment 1 (failed-step top-up), before any label or Jev answer.** After the first pass the failed share was 23 of 270 cases (8.5%), against the 25% target. A failed-only top-up on the accepted repositories was registered (commit `53c9e54`) and run once: 288 cases, 41 failed (14.2% before drops, 15.1% after). The target of 25% was **not reached**; no second pass. Failed steps are decided in code and cannot move a Jev bar. Many failed jobs fail in steps that are not a plain test, lint or build `run:` step, or in jobs the segment mapping drops (449 mismatches).
2. **Parallel fetch.** The fetch was first run as one sequential process (stopped after a few repositories, too slow), then as 6 parallel processes (stopped), then as 17 parallel processes, one per bucket, which finished; repositories and logs cached by the earlier processes were reused, the selection rule per bucket is unchanged.
3. Candidate repositories were chosen with a `pushed:>2026-10-03` qualifier, so the set is "recently active popular repositories", not all popular ones. Four repositories of the first fetch that lost all cases are not in committed data and may reappear (none was checked).
4. The two-day run window favours repositories with many daily runs; the sample is one time slice.
5. One labeller on 60% of succeeded cases, two model processes on 40%; model labels, no human; the CotEditor label above shows the risk. One Jev model version, one recording.
6. Wrong-`met` and missing-recall verdicts are over a few dozen negatives (85, 56 in class E); a pass would have been weak evidence, and failures are clear on the point values.
7. `scripts/real-ci/fetch2.mjs`, `score2.mjs` and the parameterised `label.mjs`, `assemble.mjs`, `analyze.mjs` are in the repository; `lib.mjs` is byte-identical to the frozen one. `prepare`, `assemble`, `analyze` and `eval record` ran from the frozen tree with the new script files copied in (they import only the frozen `src/`).
8. The suite and the log text are not in the repository (decision of the first registration), so this is not rerunnable from the repository; `node scripts/real-ci/score2.mjs docs/data/done-v2-real-2/table.jsonl` reproduces the numbers from the table.

## What this says

On logs nobody tuned for, with code frozen before the sample existed, `done` v2 does what it was built to do in the exit-code-only class (0 wrong `met` of 56, at the price of 0 `met` of 67 true passes) and fails the three bars where a runner is recognised: it says `met` for a build-only maven log read as a test pass, `met` recall among parsed is 0.873, and `missing` recall is 0.53 because it answers `unsure` where a human says `missing` (R 22 of 29 negatives are `unsure`, which is safe but not a hit). The next dev-backed items, not started here: the maven build-versus-test distinction (a `BUILD SUCCESS` without `Tests run:` is not a test result), Swift Testing known issues and multi-run `swift test` logs, `mix test`, wrapper builds, and a positive marker for clean linters.

Jev receipt: `rmuveb0ms866t` (231 cases, 206 requests, 25 cache hits). The `decide` receipts about log text are those of the first registration.
