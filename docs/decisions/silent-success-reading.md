# A silent npm-echoed eslint or oxlint run with exit 0 is a clean run

Registered 2026-10-09, before any code change. Chosen with `decide` after a correction of the counts (the first ranking used a wrong number, see [vite-built-line.md](vite-built-line.md)): eslint and oxlint only, not `nest build` (o2 0.77, both orders agreeing, after a first ask that split 0.56 / 0.43 and one added fact; receipts `rmv10yyhopmqk`, `rmv10z9gtsgx5`). Below the 0.90 bar, so the cheaper and smaller option was taken, as the project rule says; `nest build` is a later table line if real output keeps showing it.

## Why

In 114 real gate-script outputs (aggregate), 34 of 38 lint logs are the npm script echo (`> pkg@ver lint`, `> eslint ...` or `> oxlint ...`), a blank line and `exit code: 0`, nothing else; 3 more have a printed oxlint warning and are not silent. eslint and oxlint print nothing on a clean run, so exit 0 with empty output means no problems. Today these are exit-code-only and a lint criterion such as "eslint reports 0 errors" is `missing` (p 0.27 to 0.48). 123 of 242 `missing` done runs in 4 days are exit-code-only. The project left clean runs on the exit-code reading to protect the registered wrong `met` bar of 0; this change keeps that bar with exclusions and a replay.

## The rule

A log is read as a clean run of `eslint` or `oxlint` (facts: errors 0, warnings 0, build-only, the echoed command as summary) only when all of these hold:
- exactly one npm script echo pair: a head line `> name@version script` immediately followed by a command line `> <command>`;
- the command's first word is `eslint` or `oxlint`, with none of the flags that hide, redirect or change output (`--quiet`, `-q`, `--silent`, `--format`, `-f`, `--output-file`, `-o`, `--fix`, `--fix-dry-run`, anything containing `no-error`) and none of `| & ; < > $ ( )` or a backtick (so no `|| true`, no second command);
- every other non-blank line is an exit line (`exit code: N` forms) and every exit code is 0, with at least one.
Anything else stays on today's reading. Allowlist by tool name, extended only from real output.

## Bars

- **B1 (reads):** the real eslint and oxlint silent shapes are parsed clean (invented from the real ones, no project text).
- **B2 (exclusions):** each of the listed flags, a shell metacharacter, a second echo pair, an extra output line, a non-zero exit, no exit line, and a printed warning line is not claimed (stays `exit_code` or `unparsed`).
- **B3 (recorded suites):** the parsed facts of the 357 recorded `done` cases are identical before and after.
- **B4 (real logs):** replayed on the 38 real lint outputs (aggregate): the silent ones become parsed, the 3 with printed warnings stay exit-code-only; no real build or test output changes.
- **B5 (Jev reads it):** a small recorded suite (`done-silent`, invented from the real shapes) with the clean forms expecting `met` and the excluded forms expecting not `met`: 0 wrong `met`; the number of clean forms answered `met` is reported.
- **B6 (gates):** `npm run check` and `ci:local` green.

## Limits

- Silence is taken as success only for the two allowlisted tools; a wrapper script that prints nothing and exits 0 for another reason is not recognised by the echo and stays excluded unless it echoes exactly one of these commands.
- `nest build` (18 of 38 real build logs) and `tsc` are not read yet.
- A gate script that appends its own summary line after the exit line (`eslint: 131 files, 0 errors, 0 warnings`, a custom format) adds an output line, so those logs are not claimed.

## Result (2026-10-09)

- **B1, B2:** `test/silent-success.test.ts`, four tests: the clean shapes (eslint with and without `--max-warnings 0`, oxlint, an `npm run lint exit code` line), 16 excluded commands (hiding, redirecting, tolerating or chaining), extra output, non-zero or missing exits, a second script, printed warnings, and a combined log with test output.
- **B3 met:** the parsed facts (trust, exit code, runners) of the 357 recorded `done` cases are identical before and after.
- **B4:** on the 38 real lint outputs, 11 more are parsed (oxlint 9, eslint 2); the 26 that remain exit-code-only are logs with an appended custom summary line, logs with printed warnings and logs with printed oxlint lines. No real build or test output changed. The 18 `nest build` logs are untouched (not allowlisted).
- **B5:** new suite `done-silent` (15 invented cases from the real shapes, dev split): **0 wrong `met`**, `met` on 5 of the 5 clean silent forms (eslint `0 errors`, `lint is clean`, `no warnings`; oxlint `no problems`, `exit status`), and not `met` on all 9 excluded or off-topic forms. The one expected-`met` miss is the custom summary line (by design). A first version of the fact used the echoed command as its summary line and got `met` on 3 of 5; saying that the tool printed no diagnostics and exited 0 got 5 of 5. The suite is a dev set that the wording was tuned on, so the 5 of 5 is not an unseen result.
- **Cost:** about 60 lines; `ci:local` scores the new suite offline with the others.

Not done: `nest build` (18 real logs), `tsc` (no real silent echo seen), the owner's custom summary line.
