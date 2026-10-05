# Parsers for ninja, MSBuild, docker build, make, maven, swift and the VSTest summary

2026-10-05. Written from the dev half of the real-log sample (`docs/data/done-v2-real/split.json`) and the tools' own documentation or source; the frozen hold-out half was not read, and nothing was tuned on it. Contract as for the earlier parsers: counts come from anchored lines only, any error, a missing completion marker or a cut-off log gives facts that cannot reach `met`, and a forged success line cannot hide an error (worst case wins).

## Formats and sources

| Parser | Claims a log on | Completion marker | Source |
| --- | --- | --- | --- |
| `ninja` (`cmake --build`, `ninja`) | `[N/M]` status lines with a CMake or Meson edge description (`Building CXX object`, `Linking CXX executable`, `Install the project...`), or `ninja:` lines | last counter N equals M, `ninja: no work to do.`, or `[M-1/M] Install the project...` followed by `-- Install configuration:` (a `console` pool edge prints its status at start, so N is M-1) | dev logs (opencv and tesseract builds); ninja manual (`NINJA_STATUS`, `%f` finished edges, console pool: <https://raw.githubusercontent.com/ninja-build/ninja/master/doc/manual.asciidoc>). `FAILED:` and `ninja: build stopped` are from ninja's behaviour; the manual and `build.cc` do not quote them, so this is not documented there |
| `msbuild` (`dotnet build`, `msbuild`) | `Build succeeded.` or `Build FAILED.`, or an `error CSnnnn`-style diagnostic with an MSBuild, C#, VB, F#, NuGet or SDK code | `Build succeeded.`; several builds in one step are summed, `N Error(s)` and diagnostics take the worst case | dev logs (ShareX `dotnet build`); `dotnet publish` and `-v:minimal` output has no marker and is not claimed. `error TSnnnn` (tsc) is not an MSBuild code |
| `docker build` (BuildKit plain progress) | `#N DONE`/`CACHED` lines plus a `#N [stage]` or `exporting` vertex | an `exporting ...` vertex that reached `DONE`; `#N ERROR`, `ERROR: failed to solve` and `CANCELED` count as errors | dev logs (two); moby/buildkit `util/progress/progressui/printer.go` format strings (`#%d DONE%s`, `#%d CACHED`, `#%d ERROR: %s`, `#%d CANCELED`). Program output is prefixed `#N <seconds> `, so it cannot forge a vertex line. The legacy builder (`Step 1/5`) is not parsed (no dev log) |
| `make` | only when it shows an error: `make: *** ...`, `Error N` lines (also `(ignored)`), compiler `error:` lines | none exists; a clean make log is not claimed and stays with the exit line | dev logs; GNU make prints `Error 1 (ignored)` for `-` recipes. Claiming clean logs hid the raw text from Jev and moved p towards `missing` on true passes (dev: 0.63 to 0.39), so it is not done |
| `maven` | `[INFO] BUILD SUCCESS`/`BUILD FAILURE`, `Reactor Summary`, `Scanning for projects...`, `Failed to execute goal` | `BUILD SUCCESS`; surefire totals (`Tests run: N, Failures: F, Errors: E, Skipped: S` without `Time elapsed`) give passed, failed and skipped | dev logs (`mvn install`, `-DskipTests`); Maven's standard output |
| `swift build` | `Building for debugging...`, `Build complete!`, `[N/M] Compiling` | `Build complete! (Ns)` or `Build of product 'X' complete!`; not claimed when test output is present | dev logs; `warning:` only from anchored `file:line:col: warning:` lines (source snippets echo the word) |
| `swift test` | XCTest `Test Suite '` / `Test Case '` lines or a Swift Testing `Test run with N tests in M suites passed after` line | XCTest `Executed N tests, with M failures (K unexpected)` after `All tests` or `Selected tests` (else the sum of `.xctest` bundles); Swift Testing run line; zero tests is incomplete | dev logs; swift-corelibs-xctest `PrintObserver.swift` and swift-testing `Event.HumanReadableOutputRecorder.swift` message templates (raw.githubusercontent.com, swiftlang). A run with both reports (XCTest 42 tests plus `Test run with 0 tests`) is the sum |
| `dotnet test` (existing parser) | VSTest block `Test Run Successful.` / `Total tests:` / `Passed:` / `Failed:` / `Skipped:` | block counts add up to the total; `Test Run Failed.` is a failure; `Aborted` and `Canceled` are incomplete | dev logs (three, ShareX); microsoft/vstest `Resources.resx` strings (raw.githubusercontent.com/microsoft/vstest) |

## Not done, and why

- `go build`: no dev case is left (six silent `go build` steps were dropped as silent-`met`, see Deviations in `docs/measurements-real-logs.md`); a silent build has nothing to parse. No parser from documentation alone.
- CMake with the Make generator (`[ 50%] Building`): one dev log, a failing one. No parser from one log.
- `phpcs`, `phpstan`: the dev logs are expected-`missing` steps; no expected-`met` shape to write from.
- `xcodebuild` (`** BUILD SUCCEEDED **`), bazel (`Executed N out of N tests`), CMake `ctest`, `npm run build` wrappers: not in the task list.

## What the clip does

`done` keeps the first 2,000 and last 12,000 characters. A ninja log whose last status line is cut away is parsed as incomplete (not `met`), so a 500 KB `ninja install` log usually stays `unsure`; this is a property of the clip, not of the parser.

## Effect on recorded suites

A parser that newly claims a log changes the facts sent to Jev, and `eval score` refuses stale recordings. Replayed offline over all recorded `done-v2*` cases, the new parsers changed the facts of 12 cases; 7 are failing runs decided in code without a request (no recording involved) and 5 are sent cases that really are maven, make or msbuild logs: `done-v2-h2/h2-c-04`, `done-v2-h4/h4-a-01`, `h4-a-07`, `h4-e-08`, `done-v2-h5/h5-d-04`. They were re-recorded in place (5 requests, receipts `rmuv2wzwiau4b`, `rmuv2x0e0xsqi`, `rmuv2x0x397h9`); `eval score --suite all` is unchanged for every suite (same counts, same allowances). Two claims of other tools were removed before this (an MSBuild rule that matched tsc `error TS` lines and dotnet test logs, and a ninja rule that matched a `meson test` log). Re-running `scripts/done-bar/rescore.mjs` would move these 5 cases between classes (R `met` recall 23 of 30 becomes 25 of 33); `docs/data/done-bar-split/` and `docs/measurements-done-bar-split.md` keep the numbers of the code at c4d7f36.
