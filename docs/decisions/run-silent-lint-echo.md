# `done --run`: the CLI's own command line no longer hides a silent lint run

Registered 2026-10-25, before the code. Found while re-reading the local `done` receipts and stored evidence since 2026-10-21 (aggregates only). The advisor tool proposed the scope (strip only the line the CLI wrote, only under `--run`). The ship check is a Jev `decide`.

## Why (local data, aggregates only)

- [silent-success-reading.md](silent-success-reading.md) reads a log that is one npm script echo pair (`> pkg@ver lint`, `> eslint ...` or `> oxlint ...`) and nothing but exit lines of 0 as a clean run of that linter. Any other non-blank line makes it not claimed.
- `done --run` writes the evidence as `$ <detected command>`, the output, then `exit code: N` (`src/cli/commands/done.ts`). That first line is an extra line, so the silent reading never applies to `done --run lint`, the form the session briefing recommends. On main, the same silent eslint text is `parsed` piped and `exit_code` with the `$ npm run lint` line in front (dry-run, 2026-10-25).
- 48 of the 195 stored `done --run` logs are this shape, all with the default criterion `lint is clean`, from 2026-10-21 to 2026-10-23:
  - 12 silent eslint runs: `unsure` 0.68 each. Under `--run` the default `--fail-on` is `missing,unsure`, so each was an exit-3 refusal of a clean lint.
  - 33 silent oxlint runs: `met` at 0.71 to 0.77 on the exit code alone, just above the 0.70 bar.
  - 3 eslint runs with printed warnings: parsed already, `missing` (right).

## The rule

Only under `done --run`, only when the check exited 0, and only when the log as a whole is not parsed: the text is parsed again without its first line when that line is exactly `$ <the command done ran>`, and that second reading is used if it is parsed. The facts sent are then the second reading's. Piped evidence is unchanged, so an agent's own echo line still makes a piped silent log not claimed, as silent-success-reading.md's B2 bar says. Every exclusion of the silent reading (flags that hide or redirect output, shell operators, a second script, extra output, a non-zero exit) is unchanged, because the same parser reads the rest of the text.

## Bars

- **R1 (tests):** under `--run` with exit 0, the silent eslint and oxlint shapes (also behind `cd <folder> && `) read as a clean run of that tool. The same text piped does not. A hiding flag, a second script, extra output and a non-zero exit do not. A first line that is not exactly the command done ran is kept. A log already parsed with the line in front keeps its facts.
- **R2 (replay, counts only):** every stored evidence log of a `done --run` call, with its own command and exit code: facts change only for silent eslint or oxlint shapes; piped replay: 0 changed.
- **R3:** `eval score --suite all --fail-on violated` output byte-identical (the recorded suites are piped). `ci:local` green.
- **R4 (live probe, reported):** an invented `done --run lint` fixture (fake `eslint` and `oxlint` that print nothing and exit 0), temporary data directory, three fresh asks per model on `lint is clean`: before (main) and after. Wrong `met` check: the same fixture with a printed warning line stays not `met`.

## Cost, stated up front

About 5 lines in `src/cli/commands/done.ts` plus a test. A second parse only for logs that are not parsed under `--run`. The trust is the silent reading's: a linter that matched no file and printed nothing would read as clean, the limit silent-success-reading.md already names. Under `--run` the CLI captured all of the output and the exit status, so the cut-off log that keeps silent readings off piped evidence cannot happen here. Fitted to one machine's logs (7 project folders, worktrees counted apart); npm's echo only (pnpm, yarn and bun print other heads and are not read, as before).

## Decision

Jev `decide` over three options (strip the CLI's line under `--run` only; let the silent parser accept a `$ ... npm run <script>` line piped too; no code), with each option's cost and how it is undone in the context: `run_echo_strip` 0.97, `no_code` 0.02, `piped_too` 0.01 (clear, both orders agree, receipt `rmvo1ivwxx1o7`). The option costs were written by the assistant.

## Result (2026-10-25)

Written after the code.

- **R1:** `test/run-silent-lint-echo.test.ts` (3 tests; the first fails without the change). Silent eslint and oxlint (also behind `cd api && `) read as clean under `--run`, `met` at a stubbed 0.98; the same text piped stays `exit_code`; `--quiet`, `-f json`, `--fix`, `|| true`, a second script, an extra line, exit 2, a printed warning and a first line that is not exactly the command are not read as silent; a parsed vitest log keeps its runners.
- **R2:** 347 stored logs. Piped: 0 changed. As `--run` with each log's own command and exit code (195 logs, stubbed answer 0.98): 45 changed, all `exit_code` to `parsed`, 33 `oxlint` and 12 `eslint`, the silent shapes counted above; the 3 eslint logs with printed warnings unchanged; 0 verdicts changed at the stub (Jev's answer is R4).
- **R3:** `eval score --suite all --fail-on violated` output byte-identical before and after the build.
- **R4 (live probe, invented fixtures with a fake `eslint` and `oxlint` on the npm path, `done --run lint`, temporary data directory, three fresh asks each, `lint is clean`):**

| fixture | jev-1.13.0 before | jev-1.13.0 after | jev-1.14.0 before | jev-1.14.0 after |
| --- | --- | --- | --- | --- |
| silent eslint | met 0.85-0.87 (exit code) | met 0.94-0.95 (parsed) | met 0.70-0.75 (exit code) | met 0.97 (parsed) |
| silent oxlint | met 0.86-0.87 (exit code) | met 0.94-0.95 (parsed) | met 0.74-0.80 (exit code) | met 0.97-0.98 (parsed) |
| eslint, 1 printed warning | missing 0.20-0.21 | missing 0.20-0.21 | missing 0.15-0.16 | missing 0.15-0.16 |

The real eslint runs were `unsure` 0.68 on 1.14 with the project's own longer echo, at the edge of the 0.70 bar that the invented `before` rows sit on. No wrong `met`: the warned fixture stays `missing` on both builds.
