# Runner parsers added to raise `met` recall of `done`

2026-10-01. The [fifth hold-out](done-v2-holdout5.md) found `met` in 11 of 22 expected cases; all 11 misses were exit-code-0 runs of tools without a parser. Eleven parsers were added (`cargo nextest`, `prove`, `dart test`, `flutter test`, Julia `Pkg.test`, `behave`, `kaocha`, `tox`, `biome`, `next build`, `nix build`) and the `cargo build` parser no longer reads `nextest` logs. Code: `src/engine/runners/suites.ts`, `scenarios.ts`, `builds.ts`, shared helpers in `util.ts`. Tests: `test/runners-suites.test.ts`, `runners-scenarios.test.ts`, `runners-builds.test.ts`, `runners-more.test.ts`, `done.test.ts`.

## How the formats were established

Each format comes from a real run or from the tool's own source, not from the hold-out text. Runs were made on 2026-10-01 in a scratch directory outside the repository, tools installed there only. Real outputs (pass, failing, skipped, empty, truncated variants) were fed to the parsers before the unit tests were written; the unit fixtures are trimmed from them with neutral paths.

| Tool | Version run | Other source read |
| --- | --- | --- |
| cargo nextest | 0.9.146 (`cargo install --locked`) | nextest-runner 0.124.0 `src/reporter/displayer/imp.rs` and its `summary_line_output.snap` (status labels, summary line incl. `M/N tests run`, flaky, leaky, timed out); https://nexte.st/docs/running/ (status line, `Summary`, `--no-tests`) |
| prove (Perl TAP) | `/usr/bin/prove`, TAP::Harness 3.43, Perl 5.34.1 | none |
| dart test | Dart 3.13.5, package `test` 1.32.0 | none |
| flutter test | Flutter 3.47.5 (`flutter create -t package`) | none |
| Julia | 1.11.7 `Pkg.test()` | none |
| behave | 1.3.3 | `behave/reporter/summary.py` of that install (status parts: error, hook_error, cleanup_error, pending, undefined, untested) |
| kaocha | 1.91.1392 on Clojure tools 1.12.6.1673 | `kaocha/report.clj` in the jar (summary line, pending, dots) |
| tox | 4.64.6 | `tox/session/cmd/run/common.py` of that install (OK, SKIP, NOT AVAILABLE, IGNORED FAIL, FAIL code, final line); tox 3.28.0 `src/tox/session/__init__.py` (summary section; not run), https://raw.githubusercontent.com/tox-dev/tox/3.28.0/src/tox/session/__init__.py |
| biome | 2.5.15 (npm) | none |
| next build | 14.2.35 (webpack, ESLint, `Failed to compile.`) and 16.3.8 (Turbopack, `> Build error occurred`) | none |
| nix build | not installed, not run | `src/libstore/build/derivation-building-goal.cc` (`Cannot build '%s'.`, `Reason: builder ...`) and `src/libcmd/installables.cc` (`build of %s failed`) on master of https://github.com/NixOS/nix; the older `builder for '...' failed with exit code N;` line is from memory and unverified |

## What the parsers do

Counts come only from anchored structural lines. Any failure, error, exit-code disagreement, skip, pending or missing summary yields facts that cannot give `met`:

- Failures and errors are counted worst-case across several summaries (a forged "all passed" line cannot hide a failing one); names are taken from the tool's own failure lines.
- Skipped, ignored, `~N`, broken, pending, undefined and untested items go to `skipped`; `done` already caps `met` at `unsure` when `skipped > 0`.
- New fact `incomplete` on a runner: the log has no final summary, tested zero items, was cancelled (`M/N tests run`, signals), was flaky or leaky (`nextest`), changed files (`biome` `Fixed N files`) or lacks the completion marker (`next build` without its route table, `nix build` with neither an error line nor an exit code line, Julia without a table or verdict). `done` caps `met` at `unsure` with `reason: "incomplete_run"`.
- `warnings` on a parsed runner now cap a lint or clean criterion at `unsure` (`warning_in_log`), as they already did for exit-code-only evidence; build, typecheck and test criteria are not affected.
- `nix build` has no structural success line; its facts hold only errors, warnings and the exit-code requirement, so success rests on the exit code line the user adds.

Limitations, stated rather than fixed: non-verbose `prove` hides TODO and skip directives inside a file (`t/e.t .. ok`), so they are visible only with `-v`; Julia `@test_skip` is counted as `Broken` by Julia itself and shows as skipped; `kaocha` counts skipped tests only through its own warnings; `tox` reports environments, not tests, so `passed` counts environments; the tox 4 environment-line regex accepts leading whitespace of any width because real tox indents two spaces and the hold-out text had none (a loosening made after reading hold-out case `h5-e-03`); the tox 3, nix and older `next` shapes are not verified by a run of that version here; `biome ci` and `format` outputs were not run beyond `check` and `lint`.

## Replay of the fifth hold-out (offline, no request)

The 47 recorded texts were parsed by the old and the new code and the facts compared. 12 changed:

| Case | Expected | New facts |
| --- | --- | --- |
| h5-a-01 nextest | met | `cargo nextest` 23 passed (was `cargo build`, no tests) |
| h5-a-03 prove | met | `prove` 118 passed |
| h5-a-05 dart test | met | `dart test` 47 passed |
| h5-a-06 flutter test | met | `flutter test` 31 passed |
| h5-b-02 Julia | met | `julia test` 87 passed |
| h5-b-06 behave | met | `behave` 2 scenarios passed |
| h5-b-08 kaocha | met | `kaocha` 7 passed |
| h5-c-06 biome | met | `biome` 87 files, 0 errors, 0 warnings |
| h5-d-01 next build | met | `next build` 0 errors, 1 warning |
| h5-d-02 nix build | met | `nix build` 0 errors, 1 warning |
| h5-e-03 tox | met | `tox` 3 environments passed |
| h5-e-04 tox | missing | `tox` 1 failed (decided in code anyway: exit code 1) |

The other 35 are unchanged. Across all `done` suites the parsers also changed the facts of `h4-d-08` (tox around nose2, expected `missing`), `h4-e-05` and `h4-f-07` (`next build` inside a Docker log and a killed turbo run; both exit non-zero and are decided in code, with no recording); these two stay where they are. Two overreaches were found and fixed in this replay: `biome` claimed any ruff or tsc `Found N errors.` log, and `kaocha` claimed any `ERROR in ./file` webpack line.

## Re-recording

Moved to the dev split of `done-v2` (both `cases.jsonl` and `cases-dev.jsonl`, as in earlier sets): the 12 above and `h4-d-08` (its facts changed and it has a recording). The old recordings were dropped from `done-v2-h5` and `done-v2-h4`; `eval record --suite done-v2` sent 12 requests (the 13th is decided in code), `jev-1.13.0`.

| Moved case | Expected | Verdict now | p |
| --- | --- | --- | --- |
| h5-a-01, a-03, a-05, a-06 | met | met | 0.98, 0.97, 0.98, 0.98 |
| h5-b-02, b-06, b-08 | met | met | 0.96, 0.96, 0.97 |
| h5-c-06 biome | met | met | 0.95 |
| h5-e-03 tox | met | met | 0.96 |
| h5-d-01 next build | met | unsure | 0.60 |
| h5-d-02 nix build | met | unsure | 0.57 |
| h5-e-04 tox | missing | missing (exit code) | 0 |
| h4-d-08 | missing | unsure (`skipped_tests`) | 0.79 |

**These are dev numbers, not a pass.** The cases were used to decide the parsers (the nix and next facts were looked at and left alone; the tox whitespace was loosened after reading them), so they say what the parsers do on those texts and nothing about unseen output. 9 of the 11 expected `met` now come out `met`; 0 wrong `met`. The two `unsure` cases show the facts do not convince Jev when a tool has no success line (nix) or a warning is present; nothing was tuned to move them. The 35 remaining `done-v2-h5` cases are a regression check only: 0 wrong `met`, `met` 11 of 11 expected `met` left, `missing` and `unsure` as before. No hold-out has passed; `done` v2 stays "not measured".
