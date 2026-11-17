# Silent lint reading: pnpm's script head

Written 2026-11-17, the day of the change. The measurements and the Jev `decide` ran before the code; this record was written after it. Found while reading the local `done` receipts and stored evidence since 2026-10-25 (aggregates only).

## Why (local data, aggregates only)

- [silent-success-reading.md](silent-success-reading.md) reads a log that is one script echo pair (`> pkg@ver lint`, then `> eslint ...` or `> oxlint ...`) followed only by exit lines of 0 as a clean run of that linter. Its head pattern accepted npm's form only; [run-silent-lint-echo.md](run-silent-lint-echo.md) named pnpm as not read.
- pnpm prints the folder after the script name. Captured from pnpm 10.25.0 in a scratch package: `> web@1.0.0 lint /abs/folder`, for a package with no name `> @ lint /abs/folder`, with no version `> web@ lint /abs/folder`. The folder may contain spaces.
- 756 `done` calls have stored evidence (2026-11-03 to 2026-11-17). 103 of them are a silent eslint run behind a pnpm head (head, command, exit line of 0 and nothing else), from 4 sessions in 2 project folders:
  - 18 under `done --run lint`: 12 with the default criterion `lint is clean` were `unsure` at 0.69, each an exit-3 refusal of a clean lint; 6 were `met`.
  - 85 piped: 3 `unsure` (0.50 to 0.56), 2 `missing` (0.41, 0.48), 80 `met` on the exit code alone (most with an exit-status criterion).

## The rule

The head line may end in a folder: after the script name, optional text that starts with `/`, `~` or a drive letter. The package name or version on either side of `@` may be empty. Nothing else changes: the same code still requires exactly one head, an `eslint` or `oxlint` command with no hiding flag or shell operator, and nothing but exit lines of 0 after it.

## Bars

- **P1 (tests):** the five pnpm head shapes read as a clean eslint run; text after the script name that is not a folder is not a head; a hiding flag, a shell operator, extra output, a printed diagnostic, a non-zero exit and a second script are not read behind a pnpm head; under `--run` the pnpm shape is `met` at a stubbed answer and an extra line keeps it on the exit code.
- **P2 (replay, counts only):** every stored log through the code before and after: only silent eslint or oxlint shapes behind a pnpm head change, all from `exit_code` to `parsed`.
- **P3:** `eval score --suite all --fail-on violated` output byte-identical. `ci:local` green.
- **P4 (live probe, reported):** an invented pnpm package with a fake `eslint` that prints nothing and exits 0, `done --run lint`, temporary data directory, three fresh asks per model, before (the live install) and after. Wrong `met` check: the same package with a fake `eslint` that prints one warning stays not `met`.

## Cost, stated up front

One pattern in `src/engine/runners/silent.ts` and two tests. The trust is the silent reading's own limit: a linter that matched no file and printed nothing reads as clean. Fitted to one machine's logs. yarn and bun print other heads and are still not read.

## Decision

Jev `decide` over three options (accept the head only when a folder follows; accept any text after the script name; no code), with each option's cost in the context: `pnpm_folder_tail` 1.00, `any_text_tail` 0.00, `no_code` 0.00 (clear, both orders agree, receipt `rmwkobfwm9yy9`). The option costs were written by the assistant. The context said 17 calls from 5 sessions were not `met`; the count by session was wrong (4 sessions hold all 103 logs), the 17 is right.

## Result (2026-11-17)

- **P1:** `test/silent-success.test.ts` (1 new test) and `test/run-silent-lint-echo.test.ts` (1 new test); both fail on the code before the change.
- **P2:** 756 stored logs. 103 change from `exit_code` to `parsed` with one `eslint` runner, all with a pnpm head and three non-blank lines (85 piped, 18 under `--run`); no other log changes because of this rule. 2 more piped logs have the same shape behind a `$ ...` line the agent typed and stay on the exit code, as before.
- **P3:** byte-identical; no eval case changes because of this rule.
- **P4 (invented package, pnpm 10.25.0, `done --run lint`, `lint is clean`, three fresh asks):**

| | jev-1.13.0 | jev-1.14.0 |
|---|---|---|
| silent eslint, before | `met` 0.86, 0.86, 0.86 (exit code only) | `met` 0.72, 0.71, 0.71 (exit code only) |
| silent eslint, after | `met` 0.95, 0.94, 0.94 (parsed) | `met` 0.98, 0.97, 0.98 (parsed) |
| one printed warning, before | `missing` 0.19 to 0.23 | `missing` 0.15 to 0.17 |
| one printed warning, after | `missing` 0.19 to 0.22 | `missing` 0.15 to 0.17 |

  The invented run sat just above the 0.70 bar before the change; the 12 real `--run` calls sat just below it (0.69).
- **Real calls re-asked** (the 6 distinct stored requests that were not `met` and that this rule changes, one fresh ask before and after): jev-1.14.0 3 `missing`, 2 `unsure` and 1 `met` before, 6 `met` after; jev-1.13.0 4 `unsure` and 2 `met` before, 6 `met` after.

## Not done

- yarn (`$ eslint .` under `yarn run v1`) and bun heads.
- A piped log with the agent's own `$ pnpm run lint` line in front stays on the exit code (silent-success-reading.md's B2 bar).
