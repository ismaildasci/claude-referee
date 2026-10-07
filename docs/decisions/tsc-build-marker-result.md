# Result: a positive marker for `tsc -b`

Result of [tsc-build-marker.md](tsc-build-marker.md), 2026-10-07. The rule was built as registered, in `parseTsc` in `src/engine/runners/js.ts`, and nothing else changed. A review then reproduced failing and partial real builds that got the marker; the guards in [Review fixes](#review-fixes) tighten the rule's preconditions (no error line, not incomplete) and change no other facts. The numbers below are code-only replays: no Jev request was made for this record, so the re-recorded answer for the changed case and the new answer for this repository's typecheck are still to come, from a run with a key.

## What was built

`tscBuilt` runs only for a `tsc` run read from build-mode status lines that has no `Found N errors` line, no error line (`errors` is 0) and is not incomplete (not halted, and the existing cut checks in `tscCut` hold). It reads the last `Projects in this build:` list and gives the marker only when all of these hold:

- no line anywhere in the log has an `error TS…:` token (`/\berror\s+(?:TS|NG)\d+:/`), counted or not;
- the header carries tsc's clock (`[10:42:07] ` or `10:42:07 AM - `, the lead `tsc -b --verbose` always prints);
- after the list, every non-blank line is a status line naming a project with that clock, or an exit line as `done` reads it (`exit code: 0`);
- every listed project ends in a `Building project '...'` or `Project '...' is up to date because ...` status line.

Then:

- `passed` is the number of projects in that list;
- `summary_line` is the last build-mode status line after the list, with its `[clock]` or `clock - ` prefix removed (for example `Building project 'tsconfig.json'...`), clipped to 200 characters like every summary.

Anything else keeps today's facts. How the registered words were read:

- **"Ends in"**: for each listed project, the last status line that names it. TypeScript 5 and 6 print an absolute path in `Building project '/srv/app/pkg/tsconfig.json'...`, so a name matches a listed project when it is equal or ends in `/` plus that project, as the cut check already matches. A line is given to the listed project with the longest such match: a solution root listed as `tsconfig.json` would otherwise match every `.../tsconfig.json` line. A first version matched by suffix alone and gave the test fixture of a TypeScript 7 solution build (root listed, no status line for it) `passed: 3`; the tests now pin that this stays unchanged.
- **"Is up to date"**: only `is up to date because ...`. In TypeScript 5.9.3 (`typescript.js`, `verboseReportProjectStatus` and the `options.dry` branch), a project that is up to date reports `is up to date because newest input ...`; the bare `Project '...' is up to date` (diagnostic 6361) is printed only under `--dry`, and TypeScript 7.0.2 prints it the same way. The pending forms do not count (`is up to date with .d.ts files from its dependencies`, `is up to date but needs to update timestamps ...`): the parser already treats them as still waiting for work, and their run ends in `Updating output timestamps of project ...`, which is neither phrase.
- **"No error line"**: also no `error TS…:` token the error parser cannot read. `TSC_PLAIN` and `TSC_PRETTY` read the file path as `\S+?`, so `src/my file.ts(1,14): error TS2322: ...` counts no error; the marker is refused all the same. The error count is not changed.
- **"Not incomplete"**: a log with anything after its status lines but exit lines is not shown to be whole: a crash trace (`FATAL ERROR: Reached heap limit`, `<--- Last few GCs --->`, `panic:`, `Error: Debug Failure.`, a stack) follows the last status line when tsc dies, and output from another tool in the same evidence cannot be told from it. Status lines without tsc's clock are not read as a whole tsc run either; a test can print them.
- **Watch mode**: any `Found N errors` line keeps today's reading, so `tsc -b -w` stays `passed: 1` with the `Found 0 errors. Watching for file changes.` summary.

The top comment of `js.ts` says the same in one sentence. The `done` request carries the new `passed` and `summary_line` as it carries every runner's facts. A TypeScript 5 or 6 absolute path in the summary is redacted (home becomes `~`) like any other fact. `hasSkips` reads `summary_line` only for `OK, but ... skipped`, which a status line cannot match, so the marker adds no cap: a clean single-project log with a stub answer of 0.98 is `met`, as before.

## Review fixes

The review ran real TypeScript 5.9.3, 6.0.3 and 7.0.2 builds and replayed every `head` and `tail` cut of their logs. Its five findings, and what was done:

| finding | what changed | still open |
|---|---|---|
| A failing build whose error line has a space in its path got the marker. | The `error TS…:` token guard. | Nothing for this shape. |
| A TypeScript 5 or 6 build that crashed or was killed during its last project, whose log ends in `Building project '...'`, got the marker. | Out-of-memory crashes: the trailing-text guard (`FATAL ERROR`, the GC and native stack lines). | A SIGKILL leaves no trailing text. See Limits. |
| A `head` cut right after the last project's `Building project` line, before its errors, carried the marker. | Nothing; tsc's output alone cannot tell it from a clean build. | See Limits. |
| `--dry` on an up-to-date project got `passed: 1` with the dry-only line as summary. | The marker needs `is up to date because`. The facts stay as before (`incomplete: false`, no marker); the bare line is not added to the halted forms, since that would change today's facts. | Nothing for this shape. |
| Status lines printed inside test output made a `tsc` runner with `passed: 1`. | The clock guard on the header and status lines, and the trailing-text guard (the test runner's own lines follow). | A test that prints clock-stamped status lines and nothing after them. See Limits. |

The review's `probe.ts`, over its 105 real logs and 2,630 evidence variants (the full log with and without its exit line, and every `head` and `tail` cut with `exit code: 0`), flagged 396 variants against the first version and flags 105 now:

- 24 are whole, clean logs with exit 0 (no exit line, or a cut that keeps every line but a trailing blank). These markers are right.
- 58 are `head` cuts right after the last project's `Building project` line, before its errors or crash trace (TypeScript 5, 6 and 7).
- 15 are TypeScript 5 or 6 builds killed with SIGKILL during their last project (3 logs, 5 variants each). In the variant with the real `exit code: 137`, `done` answers `missing` in code; the facts still carry the marker.
- 6 are `--dry` runs on an up-to-date project cut before the dry-only line. What is left is byte for byte a non-dry up-to-date log, and the project is up to date.
- 2 are `head` cuts of a node:test log that printed clock-stamped status lines, cut before the test runner's lines.

The real pipelines of the review: `tail -n 300` of an out-of-memory TypeScript 5 build and the TypeScript 7 build with a spaced path and no exit line now keep today's facts. `head -n 7` of a failing TypeScript 7 build still carries the marker.

## Facts that change on the recorded eval suites

Facts were computed by the base code (`8d92b50`) and by the change for every evidence text and transcript in `jev-evals`: 464 `done` evidence texts (352 reach Jev; 112 are decided in code by a non-zero exit) and 48 stop transcripts (`stop-hard`, `stop-sessions`, `stop-study`, as `analyzeTranscript` plus the stop state and skip). The `done-v2` dev and hold-out files repeat that suite's `cases.jsonl`. The list is the same before and after the review fixes.

| case | before | after |
|---|---|---|
| `done-v2/h3-d-02` (dev, a four-project `tsc -b --verbose` with exit 0, expected `met`) | `tsc`, `passed: 0`, `errors: 0`, `summary_line: null` | `tsc`, `passed: 4`, `errors: 0`, `summary_line: "Project 'tsconfig.json' is up to date because it is a solution file with no files of its own"` |

That is the whole list: 1 case (2 entries, `cases.jsonl` and its copy `cases-dev.jsonl`). It is the only recorded evidence with build-mode status lines. No `conflict`, `trust` or `exit_code` changed anywhere. Stop states: 0 of 48 changed.

`eval score --suite all --fail-on violated` exits 1 at `done-v2/h3-d-02` ("the question text or input changed since it was recorded"); that is the only stale case. Each other suite scored on its own passes with its allowance unchanged (`decide-best`, which has no bar, is `scored`). `done-v2` scored from a scratch copy without `h3-d-02` passes: 106 cases, 0 wrong `met`, allowance 0. `done-v2/h3-d-02` has to be recorded again with a key (`eval record --suite done-v2`, one request) before CI's `eval score` passes. The registered bar (no recorded case moves to a wrong `met`) cannot be checked here. This case is labelled `met`, so if its new answer is `met`, that is a right `met`.

## This repository's typecheck

The evidence in the registration (TypeScript 7.0.2, `npx tsc -b tsconfig.json --verbose --force`, exit 0) was answered `missing`, p 0.1. Its facts change from `tsc` `passed: 0`, `summary_line: null` to `passed: 1`, `summary_line: "Building project 'tsconfig.json'..."`. It was not asked again here; the verdict with the new facts is still to be measured.

## Real captures

The 45 captures from the TypeScript 7 work (tsc 6.0.3 and 7.0.2: clean, errors, up to date, dry, watch, `--pretty` on and off, TTY), plus this repository's own clean run, were run through both versions.

- As captured, 1 changes: this repository's run, which ends in `exit code: 0`. 34 of the captures end in the capture script's own `exit 0` line, which `done` does not read as an exit line (it reads `exit code` and `exit status`), so the trailing-text guard refuses the marker for the 7 clean ones that changed in the first version; the other 11 (watch, TTY and `-p` runs) have no exit line.
- With `exit N` written as `exit code: N`, the form the protocol pipes, 8 change, as in the first version, all to `passed: 1` with the status line as summary: this repository's run and the single-project clean or up-to-date runs (6.0.3 first, second and forced pretty; 7.0.2 first, second, and forced with and without pretty). The other 38 keep their facts: runs with errors, dry runs and cut TTY runs (incomplete), watch runs, runs without `--verbose` (no status lines), and the multi-project runs. All 7 clean, complete multi-project captures (3 from 6.0.3, 4 from 7.0.2) keep their facts because their solution root is listed last and prints no status line (see Limits).

## Real-use replay

Aggregate counts only, over the transcripts on this machine (1,271 files that contain a build status line or a referee call): every Bash tool result with build-mode status lines, parsed by both versions, and every `done` call (same detector as the earlier usage study).

- `done` calls: 348. 2 show `tsc -b` output in their result. Both are this repository's own typecheck from this work session (single project, `--force`), recorded `missing`. The facts of 1 change (`passed` 0 to 1, `summary_line` null to the status line). The other keeps its facts: the same command also ran `git status`, and its output follows the status lines in the result. The transcript does not show whether those lines were in the evidence piped to `done`. No other `done` call shows `tsc -b` output, so no real-use verdict outside this work can move.
- Other tool results with build-mode status lines: 55. 54 are from this work session (the TypeScript 7 probes and this review's runs); 4 change (clean builds). 11 clean ones keep their facts: 10 got the marker from the first version, 9 of them for other output after their status lines and 1 for more than one guard; the 11th has a listed project that does not end built or up to date, and the first version gave it no marker either. The 1 result from another session changed in the first version and keeps its facts now: another command's output follows its status lines in the same result.

## Limits

- **A TypeScript 5 or 6 build killed during its last project gets the marker** when the evidence has no exit line or one swallowed by a pipe (`| tail`, `| head`). TypeScript 5 and 6 print `Building project '/abs/...'...` before they compile (`createProgram2` in `typescript.js` 5.9.3), and a SIGKILL leaves no trailing text, so the log is byte for byte the log of a clean build. TypeScript 7 prints each project's block once that project is done, so a TypeScript 7 build killed mid-project has no status line for that project and gets no marker. With the real non-zero exit line in the evidence, `done` answers `missing` in code. Closing this needs a narrower rule ("a TypeScript 5 or 6 `Building project` line ends a project only when a later status line follows it"), registered and replayed on its own; see the addendum to the registration.
- **A `head` cut right after the last project's `Building project` line**, before its errors, still reads as a clean build in every version, since a clean build ends the same way and `head` exits 0. Pipe the whole output, not a `head` or `tail` of it.
- **Other output after the status lines refuses the marker**, so `tsc -b --verbose && npm test` piped as one evidence keeps today's facts for `tsc` (the test runner's own facts are read as before). So does an exit line in a form `done` does not read (`exit 0`).
- **A test that prints clock-stamped status lines** and nothing after them (or is cut there) is read as a clean `tsc -b` run; such a log is the same as a real one.
- **A solution root with no status line gets no marker.** `tsc -b` on a solution `tsconfig.json` (`files: []` and `references`) lists the root last and prints no status line for it. The cut check already lets that root go without a status line; the registered rule does not, so such a clean build still reaches Jev as `passed: 0`, `summary_line: null`. All 7 clean, complete multi-project captures have this shape. Making the rule follow the cut check (the last listed project may have no status) would widen it and needs its own registration and replay.
- A project that ends in `Updating output timestamps of project ...` (its dependencies changed only their `.d.ts`) gets no marker, so a clean build in which that happens keeps today's facts.
- Like any parsed runner with `passed` above 0, a clean `tsc -b` next to a failing runner in one log would set `conflict` (capped at `unsure`) where it did not before. With the trailing-text guard, that needs the failing runner's output before the `tsc -b` header. No recorded case or replayed log has this shape.

A fix fitted to the cases named in the registration and the review, not a clean test.

## Re-recording and the decision

`done-v2/h3-d-02` was re-recorded in place on 2026-10-07 (1 request, receipt `rmuye6w4d5n8s`): Jev answered 0.90 on the new facts, so the case is a correct `met` (it was answered 0.21 and 0.11 before). `eval score --suite all --fail-on violated` passes; every done suite keeps 0 wrong `met`. This repository's own clean typecheck (TypeScript 7.0.2, `tsc -b --verbose --force`, exit 0) is now `met` at p 0.90 (receipt `rmuye6x2gypnb`); before it was `missing` at p 0.1. Shipped after `decide`: `ship` 0.96, `hold` 0.04, both orders agreeing (receipt `rmuye79omyg66`), with the residual limit above.
