# `done --run`: a silent type check that ends the output is a fact

Registered 2026-10-20, before the code. Follows [script-tool-list.md](script-tool-list.md), whose live probe found the drop below; the advisor tool proposed the `--run`-only scope. The ship check is a Jev `decide`.

## Why (local data, aggregates only)

- 29 of the 107 locally stored evidence logs end with an echoed `vue-tsc` or `tsc` command (`$ vue-tsc --noEmit`, `> tsc --noEmit`) followed only by exit lines. Both tools print nothing when they pass, so the echo is all there is. For a log that some other runner parsed, nothing about that type check reaches Jev: echoed commands are sent only for exit-code-only evidence ([command-echo-facts.md](command-echo-facts.md)), and [silent-success-reading.md](silent-success-reading.md) reads only a log that is one silent eslint or oxlint run.
- Under `done --run` the command name is sent as a fact ([done-ran-fact.md](done-ran-fact.md)). Live probe, invented fixture of the owner's `composer test` shape (agent summaries, oxlint warning lines, a silent `vue-tsc` last), temporary data directory, three fresh asks each: `composer test (pint, rector, phpstan, vue-tsc) exits with code 0` is `missing` on main (0.27 to 0.42 on `jev-1.14.0`, 0.33 to 0.40 on `jev-1.13.0`, `criterion_not_covered`), while the live install, which sends no command name, answers `met` (0.80 to 0.90; 0.72 to 0.80). `vue-tsc reports no errors` is `missing` 0.02 on both builds. Jev knows `composer test` ran and sees no fact for the type check the criterion names.
- Piped evidence cannot be read this way safely: a log cut right after the echo (`| head`) with `exit code: 0` appended has the same shape, the cut-off case [pest-failure-lines.md](pest-failure-lines.md) closed for Pest. Under `done --run` the CLI captures all of the output and the check's own exit status, so the shape can only come from a type check that printed nothing and a run that exited 0.

## The rule

Only under `done --run`, and only when the check exited 0: when the last non-blank line of the output that is not an exit line is an echoed command (`$ ` or `> `) whose first word is `tsc` or `vue-tsc`, with no shell operator or redirect (`| & ; < > $ ( )` or a backtick) and none of the flags that hide or tolerate output that [command-echo-facts.md](command-echo-facts.md) excludes, the facts get one more runner: that tool name, zero counts, no names, the summary `<tool> printed no diagnostics and exited 0` (the wording [silent-success-reading.md](silent-success-reading.md) measured), no test results. It covers the type check kind, so `criterion_not_covered` stops naming it, and it is not a linter, so the lint caps are unchanged. Piped evidence, other tools and every other shape are unchanged. The tool name is the only new text that leaves the machine, less than an echoed command line.

## Bars

- **R1 (tests):** under `--run` with exit 0 the combined shape gains the fact; the same text piped does not; a shell operator, a hiding flag, any output after the echo, an echo that is not last, another tool (`$ eslint .`) and a non-zero exit do not; `lint is clean` over the combined log stays `unsure` with `warning_in_log`; a test criterion stays `no_tests_run`.
- **R2 (replay, counts only):** the 107 stored logs piped: no change. The same logs as `--run` with exit 0 (stubbed answer 0.98): the facts change only for logs that end with the tail.
- **R3:** `eval score --suite all --fail-on violated` output byte-identical (the recorded suites are piped); `ci:local` green.
- **R4 (live probe, reported):** the invented fixture under `done --run test`, three fresh asks per model: the list form, `vue-tsc reports no errors`, `the typecheck passes`, against the numbers above; `lint is clean` stays not `met`.

## Cost, stated up front

About 20 lines in `src/cli/commands/done.ts`, one runner kind entry. A script that ends in a silent type check and tolerates its failure without showing it in the echo (a manifest-level `|| true` that the runner does not print) reads as a pass; the exit status is then 0 too, the same trust as every exit-code reading. Fitted to one project's log shape; the tool allowlist grows only from real output.

## Decision

Jev `decide` over three options (the fact under `--run` only; the same fact for piped evidence too; no code): first ask `run_tail_fact` 0.85, `no_code` 0.11, `tail_fact_piped_too` 0.03 (clear but below the 0.90 bar, both orders agree, receipt `rmvgo6rbbtrhu`); after one added fact on what the two leaders cost and how each is undone, 0.82, 0.15, 0.02 (weak, both orders agree, receipt `rmvgo6ycgtp1v`). Below the bar, so the reversible option was taken, as the project rule says and the weak verdict's next step suggests. The option costs were written by the assistant.

## Result (2026-10-20)

Written after the code.

- **R1:** `test/run-silent-typecheck-tail.test.ts` (3 tests; the first fails without the change). The combined shape under `--run` gains a `vue-tsc` runner and `vue-tsc reports no errors` reaches `met` at a stubbed 0.98; piped it does not; `lint is clean` stays `warning_in_log`, `all tests pass` stays `no_tests_run`; `|| true`, a redirect, `; echo`, a pipe, an env prefix, `--quiet`, `eslint`, output after the echo, an echo that is not last and a non-zero exit are not read. `vue-tsc` is added to the runner kinds (type check), and the kinds test counts the tail's tool names as emitted names.
- **R2:** 108 stored logs (one more than in the registration). Piped: 0 changed. As `--run` with exit 0: the facts of 29 changed, all logs that end with the tail; 0 verdicts changed at a stubbed 0.98 (caps only; Jev's answer is R4).
- **R3:** `eval score --suite all --fail-on violated` output byte-identical before and after the build; `ci:local` green before the push.
- **R4 (live probe, invented fixture, `done --run test`, temporary data directory, three fresh asks each):**

| criterion | jev-1.13.0 | jev-1.14.0 | before (main) |
| --- | --- | --- | --- |
| `composer test (pint, rector, phpstan, vue-tsc) exits with code 0` | `met` 0.94 to 0.95 | `met` 0.98 | `missing` 0.33 to 0.40; 0.27 to 0.42 |
| `vue-tsc reports no errors` | `met` 0.95 | `met` 0.98 | `missing` 0.02 (one ask each) |
| `the typecheck passes` | `met` 0.77 to 0.80 | `met` 0.73 to 0.76 | `met` 0.82 (1.14, one ask) |
| `lint is clean` | `unsure` 0.84 to 0.85, `warning_in_log` | `unsure` 0.78 to 0.81, `warning_in_log` | not asked |

- **R4, second pass (same day, after the push, advisor's request):** the shape that is only a silent type check also changes (trust `exit_code` to `parsed`, the echoed command replaced by the command name and the `tsc` fact). `done --run typecheck` in this repository (`> tsc -p tsconfig.json`, then the exit code), default criterion `the typecheck passes`, three fresh asks each: the bundle before this change `met` 0.88 to 0.90 (1.13) and 0.90 to 0.91 (1.14) at `exit_code` trust; after it `met` 0.93 to 0.96 and 0.97 to 0.98 at `parsed` trust. `the typecheck passes` on the fixture, three more asks on the bundle before: 0.77 to 0.80 (1.13), 0.70 to 0.83 (1.14); after, three more: 0.76 to 0.81 and 0.68 to 0.86 (one `unsure` 0.68). Same spread before and after; on 1.14 that wording sits near the 0.70 bar either way.

Limits: one invented fixture of one project's shape and one silent `tsc` repository, a probe and not a test on unseen logs; real `--run` calls on that project will show it after the live update.
