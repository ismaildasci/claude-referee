# Roadmap

claude-referee grows one measured step at a time. A feature moves into a release only with tests, and a check that changes Claude's behaviour only with a measurement. Each item below says what "done" means for it. Dates aren't promised; the order is.

Items marked **help wanted** are good places to start, and most need no TypeSafe key. See [CONTRIBUTING.md](CONTRIBUTING.md).

## v0.1: the commands and the session note (released)

- `done`, `decide`, `judge` and `verify`, each with `--describe`, `--dry-run` and `--fail-on`
- `decide` asks every choice in your order and in reverse
- Redaction before every request; input that looks like a credential stops the request
- Local receipts and a 30-day answer cache; `receipts --tokens` and `receipts export`
- `doctor`, with `--online` to check the key
- The session note, only in projects with `.claude/referee.json`
- The `generic` pack and the `jev` skill

## v0.1.x: live numbers

- **Live API checks.** Done on 2026-09-30: the API's edge cases, latency at 1, 6 and 8 requests in parallel, and option-order sensitivity on a public set of 20 decisions. Results: [Measured with claude-referee itself](docs/measurements.md#measured-with-claude-referee-itself).
- **A close-call decision set.** Done on 2026-10-01 with a pre-registered design: [Option order on a close-call set](docs/measurements.md#option-order-on-a-close-call-set). Next, as a separate decision record: whether `decide` can send both orders in one request.

## v0.2: evidence in code, and thresholds in the open

- **Recorded-answer evals.** Cases live in `jev-evals/<suite>/cases.jsonl` with separate dev and hold-out splits. `eval record` saves Jev's answers once; `eval score --sweep` chooses thresholds offline and gives the same result every time. CI fails when a question changes without new recordings. **help wanted:** labelled cases, invented or public, for `done`, `verify` and `judge`.
- **`done` v2.** In `main`, not released. Test, lint and type-check output is parsed in code into counts, an exit code and the failing test names, and only that reaches Jev; unrecognised output can never return `met`. Measured on 48 held-out cases: no wrong `met`, `missing` found in 27 of 30, smaller than v1's input ([result](docs/measurements.md#done-v2-on-held-out-cases)). Still open: checking the parsers against real runs of each tool, and more cases. **help wanted:** real output samples from pytest, `go test`, PHPUnit, RSpec, `dotnet test`, Mocha, ESLint, Ruff, Vitest, Jest, Cargo and tsc, in the formats your CI prints.
- **`verify` v2.** In `main`, not released. Quotes and numbers in a claim are matched against the source in code first: a double-quoted text that isn't there is reported unsupported, and a backticked name or number that isn't there is reported unsure, both without asking Jev. What's left gets two three-way questions per claim (supports, contradicts or says nothing, in both option orders) and one check for an instruction aimed at the judge in the source. Measured on 60 held-out claims: no wrong `supported`, 19 of 24 true claims confirmed, but more `unsure` than v1 and no more true claims confirmed than v1 (22 of 24); one request per source, as in v1, with more questions in it ([result](docs/measurements.md#verify-v2-on-held-out-claims)). The registered "fewer requests than v1" criterion is not met. The bands were checked against the recorded answers and left alone: bands can't recover the 5 lost true claims, which stop at the code-side checks or the injection gate ([result](docs/measurements.md#verify-v2-on-held-out-claims)). Still open: whether the number and backtick checks or the injection gate can be loosened without a wrong `supported`; each needs a registered design first.
- **The done-gate.** A Stop hook, off by default, that looks at a stop only when Claude edited files and no check passed afterwards, and asks Jev whether Claude claimed success it didn't verify. `shadow` mode is in `main`, not released: it records the decision and never blocks; `receipts --stops` lists decisions, and `--label <id> --right|--wrong` marks them. Still open: `active` mode (a block of at most 300 characters naming the check, at most three per session, 60 seconds apart), test-integrity notes, evidence files from `areas[].evidence`, and the comparison with Claude Code's built-in `/goal`. `active` is recommended only after at least 50 labelled stops with precision of 0.8 or better, no more than 5% false blocks and a p95 of 3 seconds or less.
- **A pre-registered A/B.** 12 to 20 cases plus 3 to 5 controls, a pilot to choose the number of runs, and results with confidence intervals in `bench/RESULTS.md`. The plan goes into `bench/PREREG.md` before the first run, and the result is published whichever way it goes.
- **The cache guard.** Before a `/model` switch that would re-cache a warm conversation for $0.25 or more, it asks. It never blocks on its own, only warns in `-p` mode, and needs Claude Code 2.1.251 or later. Project files can only lower the threshold.
- **The pack linter.** `lint-pack <dir>` is in `main`, not released: it flags a missing model pin, questions without instructions, an and/or inside a Noul, true and false criteria that don't differ, a Choice without an other or none option or with an undefined category, more than 255 options, a Score with fewer than 2 or more than 10 levels or numbers only, and counting or date questions. `--recorded <evals dir>` flags a Noul whose 10th percentile is 0.5 or more over at least 10 recorded answers. Not built: the check that backticked state paths exist, since packs have no state schema. The generic pack lints clean.
- **An MCP server, as an experiment.** It ships only if it passes a gate set in advance: at most 150 tokens of fixed cost per session, a lower median total cost than the CLI on structured cases, and no drop in task success.
- **More redaction patterns.** **help wanted:** each with stop and keep fixtures.

## v0.3: see your own numbers

- **A local dashboard.** Receipts stored in SQLite and browsed in a local web page: requests, cache hits, tokens and cost per project, command and day, verdicts over time, and a screen to label done-gate decisions. Nothing is uploaded.
- **Receipt import** from the JSON lines files that v0.1 and v0.2 write, so no history is lost.

## Labs

Experiments ship in a separate, opt-in `claude-referee-labs` plugin and move into claude-referee only after they pass their own gate:

| Experiment | Gate |
|---|---|
| Pruning long tool output | Two weeks in shadow with at most 2-5% regret and at least 50% fewer tokens on pruned outputs, then an A/B |
| A risk gate for Bash commands | Asks on at most 5% of harmless commands, p95 of 1.5 seconds or less, and Jev never allows a command on its own; only fixed rules deny |
| Downward-only subagent routing | Lower total cost in an A/B, no drop in success; the main conversation's model is never touched |
| A file briefing on the first prompt | Fewer tool calls and lower total cost in an A/B; opt-in, since code excerpts leave the machine |
| Skill suggestions | Fewer wrong skill loads without more unneeded ones; p95 of 1 second or less |
| Test selection | At least 90% recall on past commits; never used as evidence for `done` |

## After measured results

- Submitting to the community plugin marketplace, once the first A/B results are published.

## Intentionally not planned

Three items of the original design are left out on purpose: an `--engine v1` flag with `decide-compare` (v1 never existed in this repository), a migration from the earlier private kit's data directory, and the `TYPESAFE_KIT_HOOKS` environment variable (it belongs to that kit).

Have an idea? Open an issue with the pack suggestion or parser request template.
