# done v2 on real CI logs: what is measured so far

Registered in [done-v2-real-logs.md](decisions/done-v2-real-logs.md) on 2026-10-02, before any log was fetched. This is a **re-definition of the success bar made after six failed registered checks**; `done` v2 stays "not measured" on the old bar whatever this document shows.

**Status of this document: the registered measurement is complete, and both Jev-dependent bars failed** (recorded 2026-10-05, `jev-1.13.0`, 181 requests and 18 cache hits for 199 sent cases; receipt `rmuv1s6mngwo4`). Wrong `met` is 2 of 76 expected-`missing` cases (bar 0, **failed**); `met` recall among parsed cases is 33 of 44 = 0.75 (bar 0.9, **failed**). The two wrong `met` are both in the dev half; the frozen hold-out half has 0 of 33. `done` v2 stays "not measured" on the old bar.

## Data

| | |
| --- | --- |
| Source | public GitHub Actions job logs, runs of the 80 days before 2026-10-02, fetched with `gh` (`scripts/real-ci/`) |
| Repositories | 94 distinct contribute cases, in 13 primary-language buckets (JavaScript 7, TypeScript 7, Python 8, Go 6, Rust 8, Java 8, Ruby 8, PHP 8, C# 8, C++ 8, C 8, Swift 8, Kotlin 2); the registered selection accepted 98 (8 per bucket in star order, Kotlin 2) and 4 of them lost every case to the ambiguous and silent-`met` drops below |
| Cases | 229 kept: 199 succeeded steps that would be sent to Jev, 30 failed steps decided in code (non-zero exit code; all 30 `missing` without a request) |
| By criterion | tests 99 (82 succeeded), lint 50 (42), build 80 (75) after drops |
| Expected labels | succeeded steps: 123 `met`, 76 `missing`; failed steps: 30 `missing` |
| Failed-step share | 30 of 229 = 13.1%, **below the registered 20% target**; the one allowed failed-run top-up pass was used and it was not enough |
| Redaction | 0 cases stopped (GitHub masks secrets as `***`); nothing was dropped for that reason |
| Log size | 88 of 229 evidence texts exceed 14,000 characters and are cut by `doneEvidence` (first 2,000, last 12,000); the longest is 2.3 million characters. Characters cut are in `table.jsonl` per case (`chars`, `chars_cut`) |

**Deviations from the registration, all made before any Jev answer existed.**

1. *Selection.* A first aggregation of this sample read every cached repository file, not only the repositories the registered rule accepts, so it held 5 repositories outside the rule (one each of Python, JavaScript, Rust, Ruby and TypeScript, 12 cases) and showed 9 repositories in four buckets against the cap of 8. `scripts/real-ci/fetch.mjs` now aggregates only the accepted repositories (regression test in `test/real-ci-lib.test.ts`), the table was rebuilt from the same cache with no network call, and every number in this document is from the rebuilt table. Cases of a repository the rule accepts are unchanged.
2. *Silent `met` labels.* Labeller 1 called two silent `make` builds `ambiguous` but called silent lint and build steps `met` on knowledge of the tool alone (`isort --check`, `flake8`, `eslint`, `go build`: evidence is the command echo and `exit code: 0`, which cannot be told from a no-op, for example an `eslint` glob that matched no file). The convention says `met` only if the evidence shows the check ran, so these labels were unsupported. Rule applied in `scripts/real-ci/assemble.mjs`: a `met` label on evidence whose output after the run header is only the command echo, npm `> ` and yarn `$ ` echo lines, the shell and env block, a runner deprecation notice, a PHPStan "Using configuration file" note and the exit line is treated as `ambiguous` and dropped (`silentOutput` in `lib.mjs`, tested). **15 cases dropped** (8 lint: four `npm run lint` wrappers around `eslint`, one each of `eslint`, `isort`, `flake8` and PHPStan; 7 builds: six `go build` and one `npm run build`); a silent step labelled `missing` is kept, because its script shows that the check did not run. Labeller 2 had also said `met` on 7 of those 15 (agreement on a wrong label is not validity, see Labelling). The tool field of PHPStan and php-cs-fixer steps, previously the class name `phpcs`, now names the command (`refineTool`).
3. *Failed-step share* 13.1% against 20% (see the table).

**What the sample dropped, counted as registered.** Across all inspected candidate repositories, including those that yielded no case, 2,429 jobs had a different number of log segments than mapped steps (composite actions, parallel groups and container steps print no `Run` header; the registration drops them; 835 of them in the accepted repositories), 161 job logs had expired or were gone (36 in accepted ones), 26 steps matched more than one purpose (25), and many candidate repositories yielded no case at all (no test, lint or build step of the registered classifier, no run in the window, or only dropped jobs; the fetch counter was cumulative over three passes, so no exact number is given). The step-mapping rule therefore selects workflows made of plain `run:` steps, and the sample is not representative of every popular workflow (limits are in the registration).

**Labelling.** Labeller 1 (a separate `claude -p` process, no tools, no repository) labelled all 221 succeeded-step cases of the accepted repositories that survived redaction: 138 `met`, 76 `missing`, 7 `ambiguous` (dropped: rl-e07bb3a6, rl-d9b43643, rl-3ed5f6f7, rl-b2f6f892, rl-5fcd27a3, rl-82c103d2, rl-4a996cc8). After the silent-`met` rule (15 dropped) 199 succeeded cases are kept: 123 `met`, 76 `missing`. Labeller 2 (a second process, blind to labeller 1) re-labelled the 30% with the lowest `sha256(id + "label2")` (67 cases): raw agreement 66 of 67 (0.985), Cohen's kappa 0.966. **There is exactly one disagreement**: rl-b2f6f892, where labeller 1 said `ambiguous` and labeller 2 said `missing`; it is dropped as ambiguous. There was no `met` against `missing` disagreement. That agreement measures consistency, not correctness: both runs are the same model with the same prompt, batch format and convention, and on the silent cases above labeller 2 repeated labeller 1's unsupported `met` (7 of 7 that it labelled). No human labelled any case and the labels were not checked against the real step conclusions or tool semantics; only the silent-output rule above is a check that does not depend on the model. Many expected-`missing` cases are steps that only *mention* the tool (installing it, configuring CMake, a matrix generator): the classifier picks them by name and command, the labeller correctly says the criterion is not shown. They are an adversarial set for the exit-code-only bucket, but an easy one (next section).

**Selection bias of the drops.** All 7 ambiguous cases are truncated or silent evidence (the labeller's reason is "summary cut off" or "printed nothing"), and the 15 silent-`met` cases are silent too. Dropping them leaves a sample that has output to read: the hard real-world cases (long logs cut by `doneEvidence`, silent linters and builds) are under-represented, and the sample is easier than real use. A silent clean linter (the common case for `eslint`, `isort`, `flake8`, `go build`) is the stratum this study cannot say anything about: it has no label here, and for these steps `done` can only trust the exit line.

## What the wrong-`met` bar can test

The 76 expected-`missing` succeeded steps are not equally hard. Classified from the labeller's reason by `negativeKind` (`lib.mjs`, tested; `negative_kind` in `table.jsonl`):

| Kind | Cases | Code caps would still allow `met` | One-sided 95% upper bound if 0 wrong |
| --- | --- | --- | --- |
| `ran_not_clean`: the check ran and shows a skip, pending, warning, zero tests or a failure | 29 | 9 | 9.8% (of 29) |
| `not_run`: the step only mentions the tool (install, echo, configure, a different check, a policy matrix) | 47 | 41 | 6.2% (of 47) |

The headline bound for 0 wrong of 76 is 3.9%, but it is taken mostly over trivial negatives: 47 steps never ran the check, and of the 29 where it did, 20 are stopped by code (skip, warning, failure and no-tests caps) whatever Jev answers. **Only 9 hard negatives test Jev's reading at all** (a bound of 28.3% for 0 wrong of 9). A hard-negative-only run is the honest reading of bar 1. The classification is by a regular expression over the reason text and was checked by reading the 29 `ran_not_clean` reasons; the line is semantic (an `eslint` run that printed warnings versus a step that only prints the linter version) and a few cases sit on it.

## Registered metric 2: parsed coverage (measured, offline)

Of the 199 succeeded-step cases, **68 are parsed (34.2%, exact 95% interval 27.6% to 41.2%)**: a parser recognised at least one runner. 131 are not parsed; with the appended exit line they are `exit_code` trust, without it they would be `unparsed`.

| By criterion | parsed | share | 95% interval |
| --- | --- | --- | --- |
| all tests pass | 51 of 82 | 62.2% | 50.8% to 72.7% |
| lint is clean | 7 of 42 | 16.7% | 7.0% to 31.4% |
| the build succeeds | 10 of 75 | 13.3% | 6.6% to 23.2% |

By language (parsed of cases): Rust 15/19, Go 12/18, Ruby 8/14, PHP 10/23, TypeScript 7/16, Python 6/17, JavaScript 5/12, C 2/13, Java 2/17, C# 1/12, C++ 0/20, Swift 0/16, Kotlin 0/2 (wide intervals; `node scripts/real-ci/score.mjs docs/data/done-v2-real/table.jsonl` prints all intervals).

Parsers that fired, by number of cases: `phpunit` 11, `go test` 8, `vitest` 7, `unittest` 7, `cargo build` 7, `node:test` 6, `cargo test` 5, `ruff` 5, `pytest` 5, `jest` 5, `clippy` 5, `dotnet test` 3, `cargo nextest` 2, `rspec` 2, and one each `eslint`, `vite`, `prove`, `golangci-lint`, `next build`. The tests criterion is where parsers help; lint and build logs are mostly not read.

## Registered code-level check (measured, offline)

All 151 succeeded-step cases (of the 221 screened, before the ambiguous and silent drops) whose native text (without the appended exit line) has no recognised runner and no exit code were fed to `doneRequest` with a recorded answer of p = 1.0: **0 returned `met`** (the registered check; violations: none).

## Offline structural numbers (not registered metrics, not Jev results)

If Jev answered p = 1.0 for every case, how many would code allow to end as `met` (skip, incomplete, no-tests and warning caps applied)? This is a property of the caps and the parsed facts, not of Jev.

| Group | allowed `met` |
| --- | --- |
| parsed, expected `met` | 42 of 44 (95.5%) |
| parsed, expected `missing` | 7 of 24 (29.2%): the other 17 are stopped by code whatever Jev says |
| exit-code only, expected `met` | 74 of 79 (93.7%) |
| exit-code only, expected `missing` | **43 of 52 (82.7%)**: only Jev stands between these and a wrong `met` |

The last row is the exposure the registration singled out. Of the 52 expected-`missing` cases in the exit-code bucket (mostly steps that never ran the check), code caps (warning, failure and skip wording, no-tests text) stop 9; the other 43 rely on Jev's answer to the criterion and the log text, and 39 of them are `not_run` steps (see above). There are 44 parsed expected-`met` cases, so registered bar 3 is **evaluable** (at least 30); the silent-`met` drop removed none of them (all were exit-code only).

## Registered metrics 1 and 3: measured with Jev's answers (2026-10-05)

Recorded once with `eval record` on the local suite of 229 cases (199 sent to Jev, 30 decided in code), scored once with `scripts/real-ci/score.mjs` from `docs/data/done-v2-real/table.jsonl` (now with `verdict` and `p` per case; no log text). Nothing was tuned, no parser, cap or question was changed. A first recording was made by mistake on the superseded 256-case suite (226 sent, 195 requests); it was not used and is not reported.

| Registered bar | Result | Verdict |
| --- | --- | --- |
| Wrong `met` = 0 (expected-`missing` succeeded steps) | **2 of 76** (one-sided 95% upper bound 8.1%); parsed 2 of 24, exit-code-only 0 of 52 | **failed** |
| `met` recall among parsed >= 0.9 (n = 44) | **33 of 44 = 0.75** (exact 95% 0.597 to 0.868) | **failed** |
| Parsed coverage (offline) | 78 of 226 = 34.5% (see above) | reported |

Verdicts on the 199 sent cases: `met` 36, `unsure` 81, `missing` 82. Exit-code-only evidence got `met` once in 79 expected-`met` cases (0.013): Jev sees only the exit code and answers `unsure` or `missing`, as in the invented hold-outs. `missing` found: parsed 8 of 24 (0.33), exit-code-only 36 of 52 (0.69).

**The two wrong `met`** (`rl-d7e82393`, a `node --test` run, p 0.97; `rl-cfdcfb61`, an `npm test` wrapper with a `vitest` summary of 105 passed, p 0.98). Both succeeded and parsed cleanly, and both were labelled `missing` by the single model labeller because the log shows skipped tests: the first has a nested script that prints "2 skipped" while the `node:test` summary says 0 skipped; the second shows skipped tests from another runner in the same step, which the parsed summary does not cover. Neither case was in the 30% second-labelled sample, so the label is one model's reading; a human may disagree on the first. Whichever way the labels fall, the code cap for skipped tests looks only at the parsed summary, so a skip line elsewhere in the same log is not seen. This is added to the parser backlog as a defect class (multi-runner logs and nested reporters), not fixed here.

**By split** (registered in `done-bar-split.md`; dev 124 cases, frozen hold-out 105, by repository): hold-out wrong `met` **0 of 33** (upper bound 8.7%), met recall among parsed **20 of 28 = 0.71** (0.513 to 0.868; 28 is below the 30 needed for that bar to be evaluable); dev wrong `met` 2 of 43, met recall among parsed 13 of 16. The whole-sample bars above are the registered ones; the hold-out numbers are reported because the dev half drove the parser backlog.

**What this does and does not show.** Real logs from 94 public repositories, labelled by one model with a 30% blind check (agreement 0.986). On this sample `done` never says `met` for exit-code-only evidence by accident (0 wrong of 52) but also almost never says `met` at all there; with a recognised runner it says `met` for 3 of 4 true passes and, in 2 of 24 negatives, for a log that hides skips. It does not show how `done` behaves on your tests: the sample over-represents plain `run:` workflows and the failed-step share is 11.7%.

## Parser backlog, ranked by frequency in this sample

Unparsed cases by the classifier's tool label (`docs/data/done-v2-real/backlog.json`), ranked by expected-`met` cases, which are the ones a parser would turn into `met`. "Cases" counts every kept unparsed case of the tool, "repos" the distinct repositories.

| Tool | Criterion | Cases | Expected `met` | Repos |
| --- | --- | --- | --- | --- |
| `npm run build` (wrapper; inner tool varies) | build | 13 | 11 | up to 10 |
| `cmake --build` / `msbuild` / `ninja` | build | 24 | 10 | 14 |
| `docker build` | build | 7 | 7 | 6 |
| `dotnet build` | build | 6 | 6 | 5 |
| `swift test` | tests | 7 | 5 | 5 |
| `make` | build | 5 | 5 | 5 |
| `swift build` | build | 6 | 4 | 3 |
| `phpstan` / `phpcs` / `php-cs-fixer` | lint | 7 | 3 | up to 6 |
| `make test` | tests | 9 | 3 | 8 |
| `pre-commit` | lint | 5 | 3 | 3 |
| `dotnet test` (**a parser exists; real output not recognised**) | tests | 3 | 3 | 1 |
| `rubocop` | lint | 4 | 2 | 4 |
| `ctest` | tests | 4 | 2 | 4 |
| `mvn package` / `compile` | build | 3 | 2 | 2 |
| `make lint` | lint | 2 | 2 | 1 |

`go build` fell from 7 expected-`met` cases to 1: six of them were silent and are in the drop above. The count of `npm run lint` wrappers fell for the same reason.

Two readings: build and lint criteria carry most of the gap (a build success has no per-test summary to parse, only an absence of errors), and **six expected-`met` cases are in tools that do have a parser but were not recognised on real output**: `dotnet test` in the VSTest format (`Test Run Successful.` / `Total tests: 133` / `Passed: 133`, three cases of one repository), a `cargo build` log, a `ruff check` through `uv run` after a long install log (clean output with no summary line), and a `vite`-type bundle step (webpack output, not Vite). The `ruff` one shows a general limit: clean linters often print nothing, so there is nothing to parse and the exit line is the only evidence; the silent `eslint`, `isort` and `flake8` steps of the sample are the same case and were dropped for it (Deviations). No parser is added in this branch.

## Limits (unchanged from the registration, and what the run added)

- GitHub Actions only, popular repositories, plain `run:` steps; the step-mapping rule dropped 2,429 jobs across all inspected candidates. Failed-step share is 13.1%, under the 20% target.
- Labels come from the same model family as the author: two processes, one labeller on every case, a second on 30%. High agreement (66 of 67, kappa 0.966) says the convention is applied consistently, not that it is right: on the 15 silent-`met` cases labeller 2 repeated labeller 1.
- The sample is biased toward easy evidence: ambiguous (truncated, silent) and silent-`met` cases were dropped, 7 and 15 of 221 labelled succeeded steps. Its wrong-`met` bar rests on 29 hard negatives of which 9 reach Jev (see "What the wrong-`met` bar can test").
- One Jev model version and one recording (2026-10-05); the two wrong `met` rest on one labeller's reading (neither was in the second-labelled 30%).
- Redistribution of log text is unresolved, so none is committed (`decide`: first ask 0.54 / 0.44 / 0.01, receipt `rmuqaymlia1f7`; with two neutral facts added 0.64 / 0.34 / 0.01, receipt `rmuqayxupkfma`; orders agreeing both times; under the 0.90 bar, so the conservative option). This directory holds hashes, labels and facts only; the suite is not rerunnable from the repository.

## After the skip fix and the dev parsers

### Skip markers beyond the summary (replayed offline, 2026-10-05)

The skipped-tests cap now reads structured skip markers anywhere in the log ([decision](decisions/skip-markers-beyond-summary.md)). Re-derived from the recorded Jev answers (no new request; code caps do not change the state hash) with `scripts/real-ci/analyze.mjs` and `scripts/done-bar/halves.mjs`. **The rule was designed from the two dev cases; the hold-out numbers are a regression check, not a clean test, because the hold-out was seen when scoring.**

| Half | Wrong `met` before | after | `met` recall among parsed before | after |
| --- | --- | --- | --- | --- |
| dev (124 cases) | 2 of 43 | 0 of 43 | 13 of 16 | 13 of 16 |
| hold-out (105 cases) | 0 of 33 | 0 of 33 | 20 of 28 | 20 of 28 |
| all (229 cases) | 2 of 76 | 0 of 76 | 33 of 44 | 33 of 44 |

Exactly two table rows changed (`rl-d7e82393`, `rl-cfdcfb61`, both `met` to `unsure`, `skipped_tests`). No expected-`met` case of either half is capped, so recall is unchanged at 0.75; parsed coverage is unchanged (68 of 199). Nothing here claims the bar passes: the registered measurement is the earlier one and `done` v2 stays not measured on the old bar.
