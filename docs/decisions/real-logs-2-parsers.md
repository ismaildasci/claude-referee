# Parsers written from the dev half of the second real-log sample

2026-10-06, under the [split registration](real-logs-2-split.md). Written from dev logs only (134 dev cases, 64 repositories); no hold-out log text was opened. Code: `src/engine/runners/more-tools.ts`, tests `test/runners-more-tools.test.ts`.

## Written (3)

| Tool | Dev cases of the tool | Format read (anchored, line start) | Never `met` when |
| --- | --- | --- | --- |
| `mix test` | 5 (3 repositories; 4 with a runner start line) | `Running ExUnit with seed: N`; then `Finished in ...` within 4 lines before `[N doctests, ][N properties, ]N tests, M failures[, K skipped][, K invalid][ (K excluded)]`; also the strict pass form `Result: N passed (...)` | no start line (gleeunit and eunit print the same summary, so a summary alone is not claimed); start with no summary (cut off, crash); 0 tests; excluded or skipped tests (counted as skipped, which caps `met`); failure header `N) test ...` or `** (` at line start; an unknown or failing `Result:` line; summaries are summed and a failing one wins |
| `ctest` | 4 (2 repositories) | `N% tests passed, M tests failed out of T` with `Total Test time (real) =` after it, the `The following tests FAILED:` and `did not run:` blocks, per-test lines `Passed` / `***Failed` / `***Exception` | no summary, no total-time line, `No tests were found!!!`, 0 tests, any failed or not-run entry (not-run counts as skipped), a per-test failure line |
| `rubocop` | 3 (2 repositories) | `Inspecting N files`, `N files inspected, no offenses|M offenses detected`, offense lines `path:L:C: X: Cop/Name:`, `[Corrected]`, `Warning:` / `Notice:` / deprecation lines | no summary after `Inspecting`, 0 files, any offense, a corrected offense (files changed), an `Error:` line; a warning or notice is counted so the existing lint warning cap applies; a log that only installs the gem has no `Inspecting` or summary line and is not claimed |

Facts reach Jev as for every parsed runner (counts and the failing names); `build_only` is not used (these are test or lint runners). Forged text: all patterns are anchored at the line start, the mix summary needs a start line and a `Finished in` line, and a failing summary or failure line wins over passing ones.

**Formats.** The official pages for ExUnit and CTest (`hexdocs.pm/ex_unit`, `cmake.org/cmake/help/latest/manual/ctest.1.html`) were fetched on 2026-10-06 and do not document the text of the summary lines; the RuboCop usage page at `docs.rubocop.org/rubocop/usage/basic_usage.html` returned 404. So the formats come from the dev logs (the dev ctest, rubocop and mix logs show every pattern above, except the failing rubocop and mix shapes, which come from the tools' public behaviour as recorded in the synthetic fixtures and are conservative where unsure). This is a limit: no pattern was checked against the vendor's text, and the `Result: N passed (...)` form of newer ExUnit is seen in one dev log only, hence parsed strictly (anything else on a `Result:` line makes the run incomplete).

## Fork: excluded tests

`mix test` prints `(41 excluded)` for tests deselected by tag. Options in their strongest form: count them as skipped (cap), ignore them, count them as failures. `decide`: cap 0.72, ignore 0.26, fail 0.01, orders agreeing, verdict `weak` (receipt `rmuw8e7miq4py`), under the 0.90 bar, so the conservative option was taken: excluded counts as skipped and caps `met` at `unsure`. Cost: a project that excludes tagged tests on purpose never reaches `met`; the dev data has two such logs, both labelled `missing`.

## Skipped, with the reason

- **`cmake --build` (Makefile generators, `[100%] Built target`)**: 6 dev cases of the tool, but only 1 shows that format (the others are configure-only logs, or Ninja and MSBuild logs other parsers read). A parser was drafted, then dropped. `decide` write against skip, neutral framing: write 0.06, skip 0.94, orders agreeing (receipt `rmuw8eejzcqpq`), so skipped. It stays in class E. (The synthetic suite recording made with the draft, receipt `rmuw8d5bpxrf9`, was discarded with it.)
- **`make`**: GNU make prints no success marker, and the dev logs show none: they end in compile or install output (`Leaving directory`, `Nothing to be done`) that a failed or cut-off build also produces, and the done clip drops the middle of the log. The exit-code line is the only signal, which is class E by design.
- **Wrapper builds (`npm run build`)**: the 5 dev wrappers wrap different tools (rollup, vitepress, tailwind, astro, next), each with its own marker and one example; no stable marker.
- **`phpstan`**: 2 dev cases (below 3). **`xcodebuild`**: 0 dev cases (its 3 cases are all in the hold-out). Both skipped by rule.

## Replay

Both real-log tables and every `done-v2*` suite were replayed with the recorded answers (old code reproduces the committed tables). Changed rows are listed in [measurements-real-logs-3](../measurements-real-logs-3.md). Synthetic suites: `done-v2-h3` (2 rows) and `done-v2-h4` (3 rows) changed their facts (rubocop and ctest logs are now parsed); re-recorded with `eval record` (5 requests, receipts `rmuw8d4rc17tc`, `rmuw8exa2enuc`); `done-v2-h4` has one case moving from `unsure` to `met` (an expected-`met` ctest log), no suite count of wrong `met` changed and no allowance moved. One existing test (`test/done.test.ts`, the ctest `0 tests failed` line) needed its fixture to carry ctest's own `Total Test time` line, because the ctest parser now reads that log and asks for it; the assertion is unchanged.

## Not done

Hold-out rows were never opened as text. In the replay the facts of hold-out rows were printed (counts only), which showed one hold-out rubocop log with a clean summary that is labelled `missing`; the cause cannot be told from the facts, so the parser was not changed. Other tools of the backlog (clippy, checkstyle, maven build and cargo test recall misses, `clang-tidy`, `hadolint`, `pylint`) are untouched.
