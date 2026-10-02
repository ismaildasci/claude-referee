# done v2 on real CI logs: what is measured so far

Registered in [done-v2-real-logs.md](decisions/done-v2-real-logs.md) on 2026-10-02, before any log was fetched. This is a **re-definition of the success bar made after six failed registered checks**; `done` v2 stays "not measured" on the old bar whatever this document shows.

**Status of this document: half of the registered measurement is done.** The data, labels, parser coverage and the offline structural numbers are in. **The Jev answers are not recorded**, so wrong `met` and `met` recall among parsed (registered bars 1 and 3) are **not measured**. Nothing below was tuned (see "What is missing").

## Data

| | |
| --- | --- |
| Source | public GitHub Actions job logs, runs of the 80 days before 2026-10-02, fetched with `gh` (`scripts/real-ci/`) |
| Repositories | 102 distinct, in 13 primary-language buckets (JavaScript 9, TypeScript 8, Python 9, Go 8, Rust 9, Java 8, Ruby 9, PHP 8, C# 8, C++ 8, C 8, Swift 8, Kotlin 2); selection by stars per bucket, 40 candidates each, as registered |
| Cases | 256 kept: 226 succeeded steps that would be sent to Jev, 30 failed steps decided in code (non-zero exit code; all 30 `missing` without a request) |
| By criterion | tests 107 (90 succeeded), lint 60 (52), build 89 (84) after drops |
| Expected labels | succeeded steps: 149 `met`, 77 `missing`; failed steps: 30 `missing` |
| Failed-step share | 30 of 256 = 11.7%, **below the registered 20% target**; the one allowed failed-run top-up pass was used (22 to 30 failed cases) and it was not enough |
| Redaction | 0 cases stopped (GitHub masks secrets as `***`); nothing was dropped for that reason |
| Log size | 89 of 256 evidence texts exceed 14,000 characters and are cut by `doneEvidence` (first 2,000, last 12,000); the longest is 2.3 million characters. Characters cut are in `table.jsonl` per case (`chars`, `chars_cut`) |

**What the sample dropped, counted as registered.** 2,429 jobs had a different number of log segments than mapped steps (composite actions, parallel groups and container steps print no `Run` header; the registration drops them), 161 job logs had expired or were gone, 26 steps matched more than one purpose, and many candidate repositories yielded no case at all (no test, lint or build step of the registered classifier, no run in the window, or only dropped jobs; the fetch counter was cumulative over three passes, so no exact number is given). The step-mapping rule therefore selects workflows made of plain `run:` steps, and the sample is not representative of every popular workflow (limits are in the registration).

**Labelling.** Labeller 1 (a separate `claude -p` process, no tools, no repository) labelled all 233 succeeded-step cases that survived redaction: 149 `met`, 77 `missing`, 7 `ambiguous` (dropped: rl-e07bb3a6, rl-d9b43643, rl-3ed5f6f7, rl-b2f6f892, rl-5fcd27a3, rl-82c103d2, rl-4a996cc8). Labeller 2 (a second process, blind to labeller 1) re-labelled a random 30% (70 cases): **raw agreement 0.986, Cohen's kappa 0.966, no disagreement dropped**; the one deviation was a pair where labeller 1 said `ambiguous` (the case was dropped for that). Many expected-`missing` cases are steps that only *mention* the tool (installing it, configuring CMake, a matrix generator): the classifier picks them by name and command, the labeller correctly says the criterion is not shown. They are a natural adversarial set for the exit-code-only bucket.

## Registered metric 2: parsed coverage (measured, offline)

Of the 226 succeeded-step cases, **78 are parsed (34.5%, exact 95% interval 28.3% to 41.1%)**: a parser recognised at least one runner. 148 are not parsed; with the appended exit line they are `exit_code` trust, without it they would be `unparsed`.

| By criterion | parsed | share | 95% interval |
| --- | --- | --- | --- |
| all tests pass | 59 of 90 | 65.6% | 54.8% to 75.3% |
| lint is clean | 7 of 52 | 13.5% | 5.6% to 25.8% |
| the build succeeds | 12 of 84 | 14.3% | 7.6% to 23.6% |

By language (parsed of cases): Rust 18/23, Go 12/24, Ruby 8/15, JavaScript 10/20, PHP 10/24, Python 8/22, TypeScript 7/18, C 2/13, Java 2/17, C# 1/12, C++ 0/20, Swift 0/16, Kotlin 0/2 (wide intervals; `node scripts/real-ci/score.mjs docs/data/done-v2-real/table.jsonl` prints all intervals).

Parsers that fired, by number of cases: `node:test` 12, `phpunit` 11, `go test` 8, `cargo build` 8, `vitest` 7, `unittest` 7, `cargo test` 7, `ruff` 5, `pytest` 5, `jest` 5, `clippy` 5, `dotnet test` 3, `cargo nextest` 2, `rspec` 2, `vite` 2, and one each `eslint`, `prove`, `golangci-lint`, `next build`. The tests criterion is where parsers help; lint and build logs are mostly not read.

## Registered code-level check (measured, offline)

All 148 succeeded-step cases whose native text (without the appended exit line) has no recognised runner and no exit code were fed to `doneRequest` with a recorded answer of p = 1.0: **0 returned `met`** (the registered check; violations: none).

## Offline structural numbers (not registered metrics, not Jev results)

If Jev answered p = 1.0 for every case, how many would code allow to end as `met` (skip, incomplete, no-tests and warning caps applied)? This is a property of the caps and the parsed facts, not of Jev.

| Group | allowed `met` |
| --- | --- |
| parsed, expected `met` | 52 of 54 (96.3%) |
| parsed, expected `missing` | 7 of 24 (29.2%): the other 17 are stopped by code whatever Jev says |
| exit-code only, expected `met` | 87 of 95 (91.6%) |
| exit-code only, expected `missing` | **44 of 53 (83.0%)**: only Jev stands between these and a wrong `met` |

The last row is the exposure the registration singled out. Of the 53 expected-`missing` cases in the exit-code bucket (mostly steps that never ran the check), code caps (warning, failure and skip wording, no-tests text) stop 9; the other 44 rely on Jev's answer to the criterion and the log text. There are 54 parsed expected-`met` cases, so registered bar 3 would be **evaluable** (at least 30).

## Registered metrics 1 and 3: not measured yet

- **Wrong `met` (hard bar 0):** 77 expected-`missing` succeeded steps are exposed (24 parsed, 53 exit-code only); the one-sided 95% upper bound for 0 wrong would be 1 - 0.05^(1/77) = 3.8%. No Jev answer exists, so there is no count.
- **`met` recall among parsed (bar 0.9, n = 54):** no Jev answer exists. The offline ceiling is 52 of 54 (96.3%): the bar can be met only if Jev says `met` on at least 49 of those 52 (the bar is on all 54; at 0.9 that is 49 `met` verdicts).

## What is missing

The Jev answers were not recorded in this run. Recording uses the repo CLI on a local suite (`done-v2-real`, with the evidence text, kept outside the repository). One command from a shell that allows it:

```bash
node plugins/claude-referee/dist/cli.mjs eval record --suite done-v2-real --evals-dir <local suite root>
node scripts/real-ci/analyze.mjs <cache>/real-ci <local suite root> <out dir>
node scripts/real-ci/score.mjs <out dir>/table.jsonl
```

The local suite root held 256 cases (226 to send, 30 decided in code) when this was written; its text is not in the repository. The registration says the result is committed separately and the suite allowance is set to the observed wrong `met` count if there is one.

## Parser backlog, ranked by frequency in this sample

Unparsed cases by the classifier's tool label (`docs/data/done-v2-real/backlog.json`), ranked by expected-`met` cases, which are the ones a parser would turn into `met`. "Cases" counts every kept unparsed case of the tool, "repos" the distinct repositories.

| Tool | Criterion | Cases | Expected `met` | Repos |
| --- | --- | --- | --- | --- |
| `cmake --build` / `msbuild` / `ninja` | build | 24 | 10 | 14 |
| `docker build` | build | 7 | 7 | 6 |
| `go build` | build | 7 | 7 | 3 |
| `dotnet build` | build | 6 | 6 | 5 |
| `npm run build` (wrapper; inner tool varies) | build | 11 | 9 | up to 8 |
| `swift test` | tests | 7 | 5 | 5 |
| `make` | build | 5 | 5 | 5 |
| `phpcs` / `phpstan` / `php-cs-fixer` | lint | 8 | 4 | 5 |
| `swift build` | build | 6 | 4 | 3 |
| `npm run lint` (wrapper) | lint | 5 | 4 | 5 |
| `make test` | tests | 8 | 3 | 7 |
| `rubocop` | lint | 5 | 3 | 5 |
| `pre-commit` | lint | 5 | 3 | 3 |
| `dotnet test` (**a parser exists; real output not recognised**) | tests | 3 | 3 | 1 |
| `ctest` | tests | 4 | 2 | 4 |
| `mvn package` / `compile` | build | 3 | 2 | 2 |

Two readings: build and lint criteria carry most of the gap (a build success has no per-test summary to parse, only an absence of errors), and **seven expected-`met` cases are in tools that do have a parser but were not recognised on real output**: `dotnet test` in the VSTest format (`Test Run Successful.` / `Total tests: 133` / `Passed: 133`, three cases of one repository), a `cargo build` log, an `eslint` run that printed only the command line (`--max-warnings=0`, no summary when clean), a `ruff check` through `uv run` after a long install log (clean output with no summary line), and a `vite`-type bundle step (webpack output, not Vite). The `eslint` and `ruff` ones show a general limit: clean linters often print nothing, so there is nothing to parse and the exit line is the only evidence. No parser is added in this branch.

## Limits (unchanged from the registration, and what the run added)

- GitHub Actions only, popular repositories, plain `run:` steps; the step-mapping rule dropped 2,429 jobs. Failed-step share is 11.7%, under the 20% target.
- Labels come from the same model family as the author: two processes, one labeller on every case, a second on 30%. High agreement (kappa 0.966) says the convention is applied consistently, not that it is right.
- No Jev result yet: the registered bars 1 and 3 have no number.
- Redistribution of log text is unresolved, so none is committed (`decide`: first ask 0.54 / 0.44 / 0.01, receipt `rmuqaymlia1f7`; with two neutral facts added 0.64 / 0.34 / 0.01, receipt `rmuqayxupkfma`; orders agreeing both times; under the 0.90 bar, so the conservative option). This directory holds hashes, labels and facts only; the suite is not rerunnable from the repository.
