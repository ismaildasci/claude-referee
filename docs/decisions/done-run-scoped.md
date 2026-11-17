# `done --run "<tool> <paths>"`: a check on a few files, run by the CLI

Registered 2026-11-17, before the code. Found by measuring how `done` calls get their evidence in the local Claude Code transcripts since 2026-10-25 (aggregates only). The ship check is a Jev `decide`, and an independent review reads the code before it is pushed.

## Why (local data, aggregates only)

648 `done` calls with a verdict, from 95 agent transcripts in 9 project folders (this repository left out):

- The first call of a verification is `met` in 111 of 224 cases with piped or file evidence (50%), in 108 of 125 with `--run` and own criteria (86%) and in 48 of 72 with `--run` and the default criterion (67%). 196 of the 648 calls are retries on the way to a `met`.
- Of the 113 piped first-call refusals, 60 had only an exit code as evidence, 38 had a criterion the facts did not show, 7 were real failures and 8 had a cap or another reason.
- The exit-code-only group is mostly a linter run on a few files (`eslint <files>`), which prints nothing when clean. Piped, the evidence is one line, `exit code: 0`, and nothing says which tool ran. `--run lint` runs the whole project and cannot express it. 253 of the 648 calls come from subagents and workflow agents, which verify one package or a few files each.

Probe before any code (hand-built facts, three asks per model, `jev-1.13.0` and `jev-1.14.0`):

- Today's facts for such a call (exit code only): a real refused criterion scores 0.15 to 0.42.
- The facts a scoped run would give (tool and paths as the command that ran, a silent clean eslint, exit code 0): the same criterion 0.91 to 0.98; three other real criteria 0.90 to 0.99.
- Negative controls: a file that was not linted 0.01 to 0.02; "the whole project lints clean" 0.11 to 0.22; a run with 2 warnings under "no warnings" 0.01 to 0.02.
- One control failed: a vitest run of two files under "the whole test suite passes" scored 0.60 to 0.78 (at or above the 0.70 bar on four of six asks), and "lint is clean" over a two-file eslint run 0.94 to 0.98. Hence the scope cap below.

## The rule

`--run` also takes one quoted string of the form `<tool> <path>...`:

- **Tools:** `eslint`, `oxlint`, `vitest` (`vitest run <paths>`; the word `run` may be given or left out).
- **Allowed only when** a script in the nearest `package.json` already uses that tool as a command word, and the tool's binary is in `node_modules/.bin` of the manifest folder or of a folder above it, up to the project root. Nothing is taken from `PATH`.
- **Arguments are paths only.** Each one must exist, lie inside the project root after symlinks are resolved, and not start with `-`. At most 50. No flags, no environment assignments.
- **No shell reads the paths.** They are passed single-quoted to the same runner `--run` uses; a path that contains shell characters is one argument.
- **Scope cap:** the run covered only the given paths, so `met` is capped at `unsure` (reason `scoped_run`) unless the criterion names one of the paths, by its full text or its last segment. Without `--criteria` the criterion names them: `<tool> finds no problems in <paths>` for a linter, `the tests in <paths> pass` for vitest.
- **A silent linter:** when the scoped `eslint` or `oxlint` exits 0 and prints nothing, that is one runner fact (`<tool> printed no diagnostics and exited 0`), as for the npm echo form. The CLI ran the tool and captured all of its output, so the cut-off log that keeps silent readings off piped evidence cannot happen.
- Everything else is `done --run`: exit 3 unless `met`, the timeout, no stdin, no key variables, the `ran` fact (tool and paths, 80 characters), receipts keep `run: true` and never the command.

## What it does not add

`--run test` already runs the project's test files, and a lint script already loads the project's lint config, so a user who allows `claude-referee` already allows the project's own check code to run. The scoped form runs the same tools the manifest's scripts run, on a subset of paths. A project whose scripts do not use a tool cannot run it this way.

## Bars

- **S1 (resolution, tests):** the three tools resolve with paths; refused with `bad_input` and nothing run: a flag, an environment assignment, a path that does not exist, a path outside the root (also through `..` and through a symlink), a tool no script uses, a tool with no binary in `node_modules/.bin`, more than 50 paths, an unknown tool, a newline in the string.
- **S2 (no shell, test):** an existing file whose name contains `$(touch pwned)` or `; touch pwned` is passed as one argument; no `pwned` file appears.
- **S3 (scope cap, tests):** a generic criterion is capped at `unsure` with reason `scoped_run`; a criterion that names a path or its last segment is not; the default criterion names the paths and is not capped.
- **S4 (facts, tests):** a silent scoped eslint with exit 0 is a clean `eslint` runner; printed warnings are parsed as warnings; a non-zero exit is `missing` without a request.
- **S5 (no change elsewhere):** every stored `done` log and every eval case replayed through the code before and after: 0 requests change. `eval score --suite all --fail-on violated` byte-identical. `ci:local` green.
- **S6 (live probe, reported):** an invented package with a fake silent `eslint`, a fake `eslint` that prints a warning and a fake `vitest`; three fresh asks per model: a criterion naming a path is `met` for the clean runs and not `met` for the warning run; a generic criterion is `unsure` by the cap.
- **S7 (independent review):** a read-only reviewer with no part in the design reads the diff for ways to run something else, to escape the root, or to get a wrong `met`; its confirmed findings are fixed before the push and listed here.

## Registered measurement (after real use)

Baseline, from the transcripts above: first-call `met` 50% piped (111 of 224), 86% `--run` with own criteria (108 of 125), 67% `--run` default (48 of 72); 60 piped first-call refusals with only an exit code. After at least 7 days of real use and at least 100 new first calls: the same counts, plus how many calls used the scoped form and their first-call `met` share. The result is reported whatever it shows; with fewer than 20 scoped calls the answer is "not adopted yet", not a verdict on the form.

## Cost, stated up front

About 120 source lines, a test file and this record. A new way for `done --run` to start a process, which is the kind of code a mistake in costs most; hence S1, S2 and S7. The paths typed (80 characters at most, as part of the command fact) leave the machine ([privacy.md](../privacy.md)). Agents have to learn the form: the exit-code-only refusal text and the skill name it; the session briefing has no room and is unchanged. Not on Windows, like `--run`. Other tools (jest, tsc, PHP and Go tools) are not included: no stored call needed them.

## Decision

Jev `decide` over four options (scoped run with the cap; scoped run without it; change only the refusal text and briefing; no code), with each option's cost and the failed control in the context: `scoped_run_with_cap` 0.98, `scoped_run_no_cap` 0.01, `teach_only` 0.01, `no_code` 0.00 (clear, both orders agree, receipt `rmwkqnyxgdfev`). The option costs were written by the assistant.
