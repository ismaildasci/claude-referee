# A positive marker for `tsc -b`

Registered 2026-10-07, before any code change or replay.

## Why

`tsc -b` (build mode) prints nothing after its status lines when the build succeeds; there is no "Found 0 errors" line outside watch mode. Since 0.2.4 plus the TypeScript 7 fix (57d4929), the `tsc` parser reads both status shapes (`[10:42:07] Building project ...` and TypeScript 7's `05:16:25 PM - Building project ...`), but a clean run reaches Jev as `tsc` with `passed: 0`, `errors: 0` and `summary_line: null`. The generic question tells Jev that a missing summary does not show the criterion, so a clean build is answered `missing`. Measured on this repository's own typecheck on 2026-10-07 (TypeScript 7.0.2, `npx tsc -b tsconfig.json --verbose --force`, exit 0): `missing`, p 0.1 (receipt `rmuy6xtmwgoaz`). The one recorded case of this shape, `done-v2/h3-d-02` (dev split, a four-project build with exit 0, labelled `met`), is answered 0.21 and 0.11.

This follows the [cargo build marker](cargo-build-marker.md): the build tool's own completion line becomes the positive marker the facts carry.

## Rule

For a `tsc` run read from build-mode status lines, when the run is not incomplete (the existing cut checks hold), has no error line, and every project in the last `Projects in this build:` list ends in a `Building project` or `is up to date` status line:

- `summary_line` is the last status line, with its clock prefix removed (for example `Building project '/srv/app/tsconfig.json'...`);
- `passed` is the number of projects in that list (built or up to date).

Anything else keeps today's facts. Errors still count as errors, a cut log is still incomplete, and watch mode keeps its `Found N errors` reading.

## What will be reported, and the bar

- Facts change for `done-v2/h3-d-02` (and any other recorded case whose log matches); each such case is re-recorded in place and its new answer reported. **Bar: no recorded case moves to a wrong `met`**, and every suite allowance stays as it is.
- This repository's typecheck evidence above is asked again with the new facts and its verdict reported.
- Replay on real-use `done` calls with visible `tsc -b` output (aggregate counts only): verdicts that change.

A fix fitted to the cases named here, not a clean test.
