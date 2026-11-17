# `done --run "<tool> <paths>"`: a check on a few files, run by the CLI

Registered 2026-11-17, before the code. Found by measuring how `done` calls get their evidence in the local Claude Code transcripts since 2026-10-25 (aggregates only). The ship check is a Jev `decide`, and an independent review reads the code before it is pushed.

## Why (local data, aggregates only)

Counted with `scripts/first-call.mjs --since 2026-10-25T17:30:00Z --exclude claude-referee` on 2026-11-17 (863 transcripts of main agents, subagents and workflow agents; this repository left out; counts only): 618 `done` calls printed a verdict, 416 of them the first call of a verification, and 191 were retries on the way to a `met`.

- The first call is `met` in 109 of 222 cases with piped or file evidence (49%), in 106 of 123 with `--run` and own criteria (86%) and in 47 of 71 with `--run` and the default criterion (66%).
- Of the 113 piped first-call refusals, 61 had only an exit code as evidence.
- The exit-code-only group is mostly a linter run on a few files (`eslint <files>`), which prints nothing when clean. Piped, the evidence is one line, `exit code: 0`, and nothing says which tool ran. `--run lint` runs the whole project and cannot express it. About 40% of the calls come from subagents and workflow agents, which verify one package or a few files each.

The first version of this record, and the context Jev decided on, used a first count by a throwaway script that also took verdict words of other commands in the same shell call: 648 calls, 111 of 224, 108 of 125, 48 of 72, 196 retries, 60 exit-code-only. The numbers above are the script's and are the baseline.

Probe before any code (hand-built facts, three asks per model, `jev-1.13.0` and `jev-1.14.0`):

- Today's facts for such a call (exit code only): a real refused criterion scores 0.15 to 0.42.
- The facts a scoped run would give (tool and paths as the command that ran, a silent clean eslint, exit code 0): the same criterion 0.91 to 0.98; three other real criteria 0.90 to 0.99.
- Negative controls: a file that was not linted 0.01 to 0.02; "the whole project lints clean" 0.11 to 0.22; a run with 2 warnings under "no warnings" 0.01 to 0.02.
- One control failed: a vitest run of two files under "the whole test suite passes" scored 0.60 to 0.78 (at or above the 0.70 bar on four of six asks), and "lint is clean" over a two-file eslint run 0.94 to 0.98. Hence the scope cap below.

## The rule

As registered, the rule named three tools and matched the scope by substring. The independent review (S7) changed it before anything shipped; this is the rule as built, and the result section lists what moved.

`--run` also takes one quoted string of the form `<tool> <path>...`:

- **Tools:** `eslint` and `vitest` (`vitest run <paths>`; the word `run` may be given or left out).
- **Allowed only when** a script in the nearest `package.json` already runs that tool (as the command of a shell segment, bare, by path, or behind `npx`, `bunx`, `pnpx` or `pnpm exec`), and the tool's binary is in `node_modules/.bin` of the manifest folder or of a folder above it, up to the project root. Nothing is taken from `PATH`.
- **Not when a script passes the tool a flag that changes its config** (`-c`, `--config`, `--rulesdir`, `--parser`, `--plugin`, `--rule`, `--env`, `--root`, `--project` and the like): a run on paths would drop it and could be silent where the project's own check fails. With `--ext` in a script, files are accepted and folders are not, because `--ext` decides which files of a folder are linted.
- **Arguments are paths only.** Each one must exist, lie inside the project root after symlinks are resolved, and not start with `-`. At most 50. No flags, no environment assignments, no spaces inside a path.
- **No shell reads the paths.** They are passed as absolute paths, single-quoted, to the same runner `--run` uses; a path that contains shell characters is one argument.
- **Scope cap:** the run covered only the given paths, so `met` is capped at `unsure` (reason `scoped_run`) unless the criterion names the scope with a path-like word (one with a `/` or a `.`): a path as typed, the tail of a covered path on a folder boundary (`a.js`, `src/a.js`), or a path under a covered folder (`tests/a.test.js` for `tests`). A bare word never counts: `tests` does not name the folder `tests/`, so "all tests pass" stays capped. Without `--criteria` the criterion names the paths the command fact shows, folders with a trailing slash (`eslint finds no problems in src/a.js, tests/`; `the tests in src/a.test.js pass`), and that criterion is never capped for scope.
- **A path is not a claim about tests.** The words that name the scope are left out when the criterion is checked for a test claim, so `eslint finds no problems in src/a.test.js` is a lint criterion; `the tests in src/a.test.js pass` over a lint run is still capped as no tests run.
- **A silent eslint:** when the scoped `eslint` exits 0 and its output is empty (nothing at all, before any cleaning), that is one runner fact (`eslint printed no diagnostics and exited 0`). The CLI ran the tool and captured all of its output, so the cut-off log that keeps silent readings off piped evidence cannot happen.
- Everything else is `done --run`: exit 3 unless `met`, the timeout, no stdin, no key variables, the `ran` fact (tool and paths, 80 characters), receipts keep `run: true` and never the command.

## What it does not add

`--run test` already runs the project's test files, and a lint script already loads the project's lint config, so a user who allows `claude-referee` already allows the project's own check code to run. The scoped form runs the same tools the manifest's scripts run, on a subset of paths. A project whose scripts do not use a tool cannot run it this way.

## Bars

- **S1 (resolution, tests):** the tools resolve with paths; refused with `bad_input` and nothing run: a flag, an environment assignment, a path that does not exist, a path outside the root (also through `..` and through a symlink), a tool no script uses, a tool with no binary in `node_modules/.bin`, more than 50 paths, an unknown tool, a newline in the string.
- **S2 (no shell, test):** an existing file whose name contains `$(touch pwned)` or `; touch pwned` is passed as one argument; no `pwned` file appears.
- **S3 (scope cap, tests):** a generic criterion is capped at `unsure` with reason `scoped_run`; a criterion that names a path or its last segment is not; the default criterion names the paths and is not capped.
- **S4 (facts, tests):** a silent scoped eslint with exit 0 is a clean `eslint` runner; printed warnings are parsed as warnings; a non-zero exit is `missing` without a request.
- **S5 (no change elsewhere):** every stored `done` log and every eval case replayed through the code before and after: 0 requests change. `eval score --suite all --fail-on violated` byte-identical. `ci:local` green.
- **S6 (live probe, reported):** an invented package with a fake silent `eslint`, a fake `eslint` that prints a warning and a fake `vitest`; three fresh asks per model: a criterion naming a path is `met` for the clean runs and not `met` for the warning run; a generic criterion is `unsure` by the cap.
- **S7 (independent review):** a read-only reviewer with no part in the design reads the diff for ways to run something else, to escape the root, or to get a wrong `met`; its confirmed findings are fixed before the push and listed here.

## Registered measurement (after real use)

Baseline: the counts above (first call `met` 109 of 222 piped, 106 of 123 `--run` with own criteria, 47 of 71 `--run` default; 61 piped first-call refusals with only an exit code; 191 retries in 618 calls). After at least 7 days of real use and at least 100 new first calls: the same script again, which also counts the scoped form (`run_scoped`) and its first-call `met` share. The result is reported whatever it shows; with fewer than 20 scoped calls the answer is "not adopted yet", not a verdict on the form.

## Cost, stated up front

About 160 source lines, a test file and this record (120 were estimated). A new way for `done --run` to start a process, which is the kind of code a mistake in costs most; hence S1, S2 and S7. The paths typed (80 characters at most, as part of the command fact) leave the machine ([privacy.md](../privacy.md)). Agents have to learn the form: the exit-code-only refusal text and the skill name it; the session briefing has no room and is unchanged. Not on Windows, like `--run`. Other tools (jest, tsc, oxlint, PHP and Go tools) are not included: no stored call needed them, and a clean oxlint run prints a summary the parser leaves unread by an earlier decision.

## Decision

Jev `decide` over four options (scoped run with the cap; scoped run without it; change only the refusal text and briefing; no code), with each option's cost and the failed control in the context: `scoped_run_with_cap` 0.98, `scoped_run_no_cap` 0.01, `teach_only` 0.01, `no_code` 0.00 (clear, both orders agree, receipt `rmwkqnyxgdfev`). The option costs were written by the assistant.

**Bundle size.** The form took `dist/cli.mjs` from 446,690 to 454,149 bytes, over the 450,000-byte CI tripwire. Start-up did not change (medians of 40 runs, twice each: 163 and 172 ms before, 167 and 164 ms after). Jev `decide` between raising the tripwire, trimming to fit and dropping the form: a tie (0.48, 0.50, 0.00; receipt `rmwkrm0a6uvum`), then, with the measured fact that a trim would have to take 1,650 bytes or more out of the checking code, `raise_tripwire` 0.80 (weak, receipt `rmwkrmlqjrx64`). Below the bar twice, so the maintainer was asked and chose 500,000.

## Result (2026-11-17)

- **S1, S2, S3, S4:** `test/done-run-scoped.test.ts`, 11 tests. Refusals are asserted by their message, so a case cannot pass for another rule's reason. Paths named `a$(touch${IFS}pwned1).js`, `b;touch${IFS}pwned2;.js`, one with a quote and backticks and one with `&&` reach the tool as four arguments and create nothing.
- **S5:** 756 stored logs and 393 eval `done` cases replayed before and after: 0 requests change. `eval score --suite all --fail-on violated` byte-identical. Full suite 1252 of 1252.
- **S6 (real eslint 10.15.0 and vitest 5.1.0 in an invented package, three fresh asks per model, after the review fixes):**

| run and criterion | jev-1.13.0 | jev-1.14.0 |
|---|---|---|
| eslint on a clean file, default criterion | `met` 0.95 | `met` 0.98 |
| same run, `lint is clean` | `unsure`, capped (Jev 0.95) | `unsure`, capped (Jev 0.98) |
| eslint on a clean file and a file with a warning, default | `missing` 0.03 | `missing` 0.02 |
| eslint on a test file, default | `met` 0.95 to 0.96 | `met` 0.98 |
| eslint on the folder `lib`, default | `met` 0.89 to 0.91 | `met` 0.95 |
| eslint on the folder `tests`, default | `unsure` 0.59 to 0.68 | `unsure` 0.63 to 0.68 |
| eslint on the folder `tests`, `all tests pass` | `missing`, no tests run | `missing`, no tests run |
| vitest on one file, default | `met` 0.97 to 0.98 | `met` 0.99 |
| same run, `the whole test suite passes` | `unsure`, capped (Jev 0.91 to 0.92) | `unsure`, capped (Jev 0.92 to 0.97) |
| vitest on the folder `tests`, `all tests pass` | `unsure`, capped (Jev 0.97) | `unsure`, capped (Jev 0.99) |
| vitest on the folder `tests`, default | `met` 0.79 to 0.83 | `met` 0.91 to 0.93 |
| vitest on one file, criterion names another file | `missing` 0.02 | `missing` 0.02 |
| vitest on a file that is no test | `missing`, exit code 1 | `missing`, exit code 1 |

  Without the cap four of these rows would be a wrong `met`: Jev answers 0.91 to 0.99 for a whole-project criterion over a one-file or one-folder run.
- **S7 (independent review, same day, before any push).** A read-only reviewer with no part in the design, working with invented projects and a local stand-in for Jev. It found no way to run another command or to leave the root through the string, the paths or the folder names (folders named with quotes, `$(...)`, `;`, newlines and a leading `-`; symlinked files, folders, binaries and `node_modules`; `..`; a sibling folder sharing the root's prefix). Its confirmed findings, all fixed before the push and each now a test:
  1. **The scope cap was a substring test.** `vitest tests` with "all tests pass", `eslint lint` with "lint is clean", `eslint src/a.js` with a criterion about `src/data.js` and `eslint src/index.js` with one about `lib/index.js` were not capped. Now a path-like word must name the scope (the rule above).
  2. **A lint run on a test or spec path could never be `met`**: naming the path read as a claim about tests. The scope words are now left out of that check.
  3. **`eslint .` and other short paths capped their own default criterion**, and the advice repeated it. The default criterion is no longer capped for scope.
  4. **A clean oxlint run was not a fact**, because real oxlint prints a summary when clean. oxlint is out of this form.
  5. **The tool lookup read `Object.prototype`** (`constructor src/a.js` passed as a known tool). It is a `Map` now.
  6. **vitest's "No test files found, exiting with code 0" had no cap** (older than this change, likelier with it). It now counts as no tests run.
  7. **The default criterion named up to five full paths while the command fact is cut at 80 characters.** It now names only the paths that cut shows.
  8. **A scoped run dropped the script's own flags.** Config-changing flags now stop it, and `--ext` stops folders.
  9. **Tests asserted less than their names said** (the `..` case was refused for another reason; refusals were checked only by error code). Rewritten.
  10. Smaller: the "uses the tool" pattern accepted `echo eslint` and refused `eslint&&tsc` (now read per shell segment); silence was judged after cleaning escape codes (now the raw output must be empty).

## Limits

- **A lint run on a folder named `tests`** sits at the bar with its default criterion (0.59 to 0.68, also with other wordings): the folder's name reads as a claim about tests next to lint-only facts. A wrong `unsure`, not a wrong `met`; naming files works.
- **vitest 5 prints no file lines to a coding agent**, so a scoped vitest run carries the paths only in the command fact; see [passing-test-files.md](passing-test-files.md).
- A folder argument is checked itself; what the tool follows inside it (a symlink out of the project) is not.
- A path with a space cannot be given. More than 80 characters of paths are cut in the command fact, and a criterion naming a path beyond the cut reads as not shown.
- The reviewer did not run the real tools or the real Jev; S6 did, after its fixes. Linux was not run locally (CI runs it).
- Whether agents use the form is not measured; the registered count below will say.
