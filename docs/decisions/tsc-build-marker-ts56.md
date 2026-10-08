# A narrower `tsc -b` marker for TypeScript 5 and 6

Registered 2026-10-08, before any code change or replay. Follows the addendum of [tsc-build-marker.md](tsc-build-marker.md) and the first limit in [its result](tsc-build-marker-result.md#limits).

## Why

Since 0.2.5 a clean `tsc -b --verbose` log carries a pass marker (`passed`, `summary_line`) when every listed project ends in a `Building project` or `is up to date because` status line. TypeScript 7 prints a project's status lines once that project is done. TypeScript 5 and 6 print `Building project '/abs/...'...` before they compile it (`createProgram2` in `typescript.js` 5.9.3) and nothing after a successful build, so a 5 or 6 build killed during its last project (SIGKILL, no trailing text) is byte for byte a clean build and gets the marker. With the real non-zero exit line in the evidence, `done` answers `missing` in code; with no exit line, or with one swallowed by a pipe (`| tail`, then `echo "exit code: $?"` prints 0), the facts show a passed build. That is a path to a wrong `met`.

The two shapes can be told apart by the path: in the review's real logs every TypeScript 5 and 6 `Building project` line names an absolute path (32 of 32 lines from 5.9.3, 28 of 28 from 6.0.3) and every TypeScript 7 line a relative one (31 of 31 from 7.0.2; on 2026-10-08, TypeScript 7.0.2 run on this repository with an absolute project argument also printed `Building project 'tsconfig.json'...`).

## Rule

In the marker check (`tscBuilt`), a listed project whose last status line is a `Building project '<path>'...` line with an absolute path (`/` first, or a drive letter followed by `:/` or `:\`) counts as ended only when a later clock-stamped status line that names a project follows it after the list. Blank lines and exit lines (`exit code: 0`) do not count as a later status line. Everything else in [tsc-build-marker.md](tsc-build-marker.md) and its review guards stays as it is; no other fact changes.

## Cost, stated before the replay

A clean TypeScript 5 or 6 build whose last listed project is built (not `is up to date because`) ends in exactly the same line as the killed one, so it loses the marker too and reaches Jev as `passed: 0`, `summary_line: null`, as it did before 0.2.5 (a clean build with exit 0 was answered `missing` then). Builds whose last project is up to date, and builds where another status line follows the last `Building project` line, keep it.

## What will be reported, and the bar

On the review's 105 real logs (TypeScript 5.9.3, 6.0.3 and 7.0.2; the whole log with and without its exit line, and every `head` and `tail` cut with `exit code: 0`), base (`e09b227`) against the change:

- **Bar 1:** none of the 15 SIGKILL variants of TypeScript 5 and 6 builds killed during their last project carries the marker.
- **Bar 2:** no TypeScript 7 variant changes its facts.
- Reported: how many of the 58 `head` cuts right after the last project's `Building project` line lose the marker, by version.
- Reported, the cost: clean TypeScript 5 and 6 variants that lose the marker, by version.

On the recorded eval suites (every `done` evidence text and stop transcript in `jev-evals`):

- **Bar 3:** no recorded case moves to a wrong `met`. Expected: no facts change (`done-v2/h3-d-02` is the only recorded build-mode log; its two absolute `Building project` lines are each followed by a later status line and its last project ends in `is up to date because`). Any case whose facts change is recorded again and its answer reported.

Also:

- **Bar 4:** this repository's own typecheck (TypeScript 7.0.2, `tsc -b --verbose --force`, exit 0) keeps its facts and stays `met`.
- Reported: the 45 real captures from the TypeScript 7 work (6.0.3 and 7.0.2) and real-use `done` calls with visible `tsc -b` output (aggregate counts only): facts and verdicts that change.

Shipping is decided with `decide` (ship or hold) after the replay; its context names the cost count next to the closed variants. If the decision is hold, the 0.2.5 rule stays with its written limit.

A fix fitted to the shapes named here, not a clean test. Windows drive paths are covered by the rule's wording but no Windows log was seen.
