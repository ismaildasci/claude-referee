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
- **`done` v2.** Test and lint output is parsed in code into passed, failed and the failing lines, and only that reaches Jev. Done when, on at least 40 new hold-out cases: no wrong "met", "missing" found at least 90% of the time, and fewer input tokens than v1. **help wanted:** parsers for pytest, `go test`, PHPUnit, RSpec, `dotnet test`, Mocha, ESLint and Ruff.
- **`verify` v2.** Quotes and numbers in a claim are matched against the source in code first; a quote that isn't there is reported as fabricated without asking Jev. What's left gets one question per claim: supports, contradicts or says nothing, plus a check for prompt injection in the source. Done when supported claims are 100% right on hold-out, at least 67% of true claims are confirmed, and it takes fewer Jev requests per claim than v1.
- **The done-gate.** A Stop hook, off by default, that looks at a stop only when Claude edited files and no check passed afterwards. It asks Jev whether Claude claimed success it didn't verify.
  - `shadow` only logs; `receipts --stops --label` lets you mark each decision right or wrong.
  - `active` blocks the stop with a note of at most 300 characters naming the check to run; at most three blocks per session, 60 seconds apart.
  - It notes, without blocking, assertions removed from tests and new `.skip`, `.only` or ignore markers, as counts and file paths only.
  - `active` is recommended only after at least 50 labelled stops with precision of 0.8 or better, no more than 5% false blocks and a p95 of 3 seconds or less. It must also let through no more false "done" claims than Claude Code's built-in `/goal`, at a lower total cost.
- **A pre-registered A/B.** 12 to 20 cases plus 3 to 5 controls, a pilot to choose the number of runs, and results with confidence intervals in `bench/RESULTS.md`. The plan goes into `bench/PREREG.md` before the first run, and the result is published whichever way it goes.
- **The cache guard.** Before a `/model` switch that would re-cache a warm conversation for $0.25 or more, it asks. It never blocks on its own, only warns in `-p` mode, and needs Claude Code 2.1.251 or later. Project files can only lower the threshold.
- **The pack linter.** `lint-pack` flags compound yes/no questions, choices without an "other" option, contradictory criteria, category names with no definition, and questions that ask Jev to count or compare dates. With `--recorded`, it also flags questions that score high on every input.
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
