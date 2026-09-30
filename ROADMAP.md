# Roadmap

claude-referee grows one measured step at a time. A feature moves up a release only when it has a test, and a check that affects Claude's behaviour only when it has a measurement. Dates aren't promised; the order is.

Items marked **help wanted** are good places to contribute. Most need no TypeSafe key. See [CONTRIBUTING.md](CONTRIBUTING.md).

## v0.1: the CLI and the briefing (released)

- `done`, `decide`, `judge` and `verify`, each with `--describe`, `--dry-run` and `--fail-on`
- `decide` asks every choice in the written and the reversed option order
- Redaction before every request; credential-shaped input stops the request
- Local receipts and a 30-day answer cache; `receipts --tokens` and `receipts export`
- `doctor`, with `--online` to check the key
- The SessionStart briefing, only in projects with `.claude/referee.json`
- The `generic` pack and the `jev` skill

## v0.2: evidence in code, and thresholds in the open

- **Recorded-answer evals.** `jev-evals/<suite>/cases.jsonl` with dev and hold-out splits, `eval record` to save Jev's answers once, and `eval score --sweep` to choose thresholds offline and deterministically. CI fails when a question changes without new recordings. **help wanted:** labelled, invented or public cases for `done`, `verify` and `judge`.
- **Runner and linter parsers.** Read test and lint output in code, so Jev only judges what code can't. **help wanted:** pytest, `go test`, PHPUnit, RSpec, `dotnet test`, Mocha, ESLint, Ruff.
- **The done-gate.** A Stop hook that notices "done" after an edit with no passing check. It starts in `shadow` mode, which only logs, and is recommended as `active` only after at least 50 labelled stops at a precision of 0.8 or better with no more than 5% false blocks.
- **A pre-registered A/B.** The protocol goes into `bench/PREREG.md` before the first run, and the result gets published whichever way it goes.
- **The cache guard.** Asks before a `/model` switch that would re-cache a warm conversation at a cost above a threshold.
- **The pack linter.** Catches compound questions, missing "other" options and contradictory criteria.
- **More redaction patterns.** **help wanted:** each with stop and keep fixtures.

## v0.3: see your own numbers

- **A local dashboard.** Receipts stored in SQLite and browsed in a local web page: requests, cache hits, tokens and cost per project, command and day, and the verdicts over time. Nothing is uploaded.
- **Receipt import** from the JSON lines files that v0.1 and v0.2 write, so no history is lost.

## Labs

Experiments ship in a separate, opt-in `claude-referee-labs` plugin and move into claude-referee only after they pass their own measurement:

- pruning long tool output
- a risk gate for Bash commands
- downward-only subagent routing
- a first-prompt file briefing
- skill suggestions
- test selection

## Ideas, not plans

- An MCP server, but only if it turns out cheaper than the CLI path.
- Packs for languages other than English, once there are cases to measure them on.
- Submitting to the community plugin marketplace.

Have an idea? Open an issue with the pack suggestion or parser request template.
