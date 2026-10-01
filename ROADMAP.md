# Roadmap

claude-referee compares what Claude Code says with the evidence, keeps a receipt of every decision and publishes its own error rate. It grows one measured step at a time: a feature moves into a release only with tests, and a check that changes Claude's behaviour only with a measurement. Each item below says what "done" means for it. Dates aren't promised; the order is. Until 1.0 every minor version is a theme and every patch is a fix.

Items marked **help wanted** are good places to start, and most need no TypeSafe key. See [CONTRIBUTING.md](CONTRIBUTING.md).

What it is not: a model router, a context compactor or a general code reviewer. It doesn't replace Claude Code's `/verify` (which runs your app) or `/goal` (a Stop hook that reads only the conversation); it reads the evidence itself and records the decision. What was dropped or postponed, and why, is in [docs/decisions/dropped.md](docs/decisions/dropped.md).

## v0.1: the commands and the session note (released)

- `done`, `decide`, `judge` and `verify`, each with `--describe`, `--dry-run` and `--fail-on`
- `decide` asks every choice in your order and in reverse
- Redaction before every request; input that looks like a credential stops the request
- Local receipts and a 30-day answer cache; `receipts --tokens` and `receipts export`
- `doctor`, with `--online` to check the key
- The session note, only in projects with `.claude/referee.json`
- The `generic` pack and the `jev` skill

## v0.1.x: hardening and live numbers

Released by 0.1.3: `done` v2 (runner output parsed in code), `verify` v2, the done-gate in `shadow` mode, the pack linter, `eval record` and `eval score`, `npm run ci:local`, and the live API checks and close-call option-order measurement ([results](docs/measurements.md)).

Released in 0.1.4:

- A request aborted after the API's headers arrived no longer kills the process with an uncaught error (SDK 0.6.0 bug; covered by a test that runs in CI on Node 22 and 24).
- The TypeSafe key goes only to `https://api.typesafe.ai`; another `TYPESAFE_BASE_URL` needs `REFEREE_BASE_URL_KEY`.
- `done` answers `missing` without asking Jev when the evidence has a non-zero exit code.
- The PHPUnit `Tests:` line is no longer read as a jest summary; `judge` and `decide` no longer let float arithmetic move a value that sits exactly on a band.
- CI scans the whole git history with a pinned gitleaks.
- A weekly job compares TypeSafe's `models.md`, `api.md` and `llms.txt` with recorded hashes (the rate limits changed once without an announcement we could find).

Still open:

- Publishing to npm (after 2026-10-03 14:22 UTC, with a one-time code from the maintainer's authenticator), then trusted publishing with a manually triggered workflow behind a protected environment. No workflow publishes on a tag by itself.
- Whether `decide` should send both orders in one request. A pilot on the 39 close-call decisions on 2026-10-01 passed its registered rules (leaders within re-ask noise, 33% fewer input tokens) but showed no latency gain, and the saving is about $0.000015 per decision, so no code change is planned until a fresh hold-out says otherwise. Raw data and scripts: [jev-evals/experiments](jev-evals/experiments/README.md).

## v0.2: evidence in code, and thresholds in the open

- **Recorded-answer evals for every command.** Cases live in `jev-evals/<suite>/cases.jsonl` with separate dev and hold-out splits; `eval record` saves Jev's answers once and `eval score` gives the same result every time. `eval` handles `done`, `verify` and `judge` suites and `eval record` has `--max-requests` and `--max-usd` caps. Still to do: `decide` suites and `--ablation`. **help wanted:** labelled cases, invented or public.
- **`done` v2, the rest.** A second hold-out of 45 cases was run and failed its registered check with one wrong `met` (a linter warning under "lint is clean"; [result](docs/measurements.md#done-v2-on-a-second-hold-out)). Two parsers (Python `unittest`, `cargo clippy` with warning counts) were added after it, and a third hold-out (46 cases) then failed on all three counts ([result](docs/measurements.md#done-v2-on-a-third-hold-out)). Afterwards skipped, risky or incomplete tests were capped at `unsure` in code and six parsers were added (`node --test` TAP, `eslint` summary with warnings, `tsc -b`, `golangci-lint`, `vite build`, `cargo build/check`). A fourth hold-out then failed too ([result](docs/measurements.md#done-v2-on-a-fourth-hold-out)); `met` is now also capped at `unsure` when the log says no tests ran. Four invented hold-outs have not passed, and every one finds new tools without a parser. `done` v2 stays "not measured". Whether an exit code alone may give `met` is closed ([record](docs/decisions/exit-code-only-met.md)): yes, except that a lint or clean criterion with a warning or notice in the log is capped at `unsure` (Jev p 0.91, both orders; fitted to one case, so not a clean test). Also: parsers checked against real runs of each tool (no wrong `met`, `missing` recall of 0.9 or better, less input than v1). **help wanted:** real output samples from pytest, `go test`, PHPUnit, RSpec, `dotnet test`, Mocha, ESLint, Ruff, Vitest, Jest, Cargo and tsc, in the formats your CI prints.
- **Injection defence.** `done` sends only parsed facts when a runner is recognised and can never return `met` for unparsed text, and the injection suite plus the adversarial groups of four invented hold-outs (a note to the reviewer at the start, middle or end of a log; an authority claim as the only evidence; a test named "all tests passed"; forged summaries) produced no wrong `met` from an injected line, so a detector question for `done` is not planned. `claims` already has one. The surfaces still open are the Stop done-gate (task and final message are free text) and `judge` items.
- **`claims`.** `verify` v2 is now also `claims` (`verify` stays as an alias until 1.0, so it isn't confused with Claude Code's `/verify`; done in main). Open: whether the number and backtick checks or the injection gate can be loosened without a wrong `supported`; each needs a registered design first. A Turkish claim set (44 cases) held: no wrong `supported`, 0.76 of true claims confirmed against 0.79 in English ([result](docs/measurements.md#claims-on-turkish-sources)).
- **More redaction patterns.** **help wanted:** each with stop and keep fixtures.
- **`decide` policy.** One decision record in `docs/decisions/` that settles two requests, one request with two questions, or balanced rotations for three or more options.

Exit criteria: the `done` v2 and `claims` acceptance numbers hold on new hold-out cases and dated rows are added to [docs/measurements.md](docs/measurements.md).

## v0.3: the done-gate, measured on real stops

- **`soft` mode** that leaves a note in the transcript without an error, next to `off`, `shadow` and `active` (done in main: a `systemMessage` warning only).
- **Labelling.** `receipts --stops` already lists stops and `--label <id> --right|--wrong` marks them. A weak `right` hint from the user's next message (reported breakage or a repeated request; approval or silence suggests nothing, so it can't fake a `wrong`) and a `claims_done` threshold suggestion with exact Clopper-Pearson intervals, produced only with at least 10 human labels per class, are done in main; the suggestion can only raise the threshold.
- **A base-rate study.** Shadow mode on two real projects for two weeks, one of them public. Kill criterion: if fewer than 2 of at least 100 stops are really a wrong "done", `active` is not recommended and the gate stays in `soft`.
- **Recorded-session evals** with `claude plugin eval`, using recorded "false done" and "true done" transcripts.
- **A recipe for the project `verify` skill.** Since Claude Code 2.1.286 Claude runs a project or user skill named `verify` before committing; the recipe is one line telling it to pipe the test output to `claude-referee done`. The plugin doesn't write that file itself. Done in main: [docs/verify-skill.md](docs/verify-skill.md) and [docs/recipes/verify/SKILL.md](docs/recipes/verify/SKILL.md); the 2.1.286 behaviour is verified against the Claude Code changelog, and the doc notes that a project `verify` skill replaces the bundled `/verify` and that the run is prompt guidance, not a gate, and that test output is sent to the API. The recipe uses the exit-code form and covers the no-verdict case (npx 404 before the npm publish).
- **Blind spots found by replaying real turns** (an outside team replayed 73 turns and most blocked sentences were true): negative sentences ("I haven't committed") are not claims; results from subagents and results repeated from an earlier turn are marked; a truncated tool output never counts as proof.
- **Stats that count failures.** `receipts --stops` reports `error_rate` and `p95_all_ms` next to the answered-calls figures (done); the gate numbers use them.

## v0.4: measure and show

- **A pre-registered A/B.** Four arms: no gate, a 20-line hook that runs the project's tests, Claude Code's `/goal`, and claude-referee. 12 to 20 cases plus 3 to 5 controls, a pilot to choose the number of runs, results with confidence intervals in `bench/RESULTS.md`, the plan in `bench/PREREG.md` before the first run, and the result published whichever way it goes. Costs come from transcripts, grouped by request id, with 1-hour and 5-minute cache writes priced separately and failed runs included.
- **A local dashboard** (`npx claude-referee ui`): 127.0.0.1 only, a random token, Origin and Host checks; the labelling queue first, then overview, privacy counters and export. JSON lines stay the source of truth; SQLite is only an index and needs Node 22.13 or later.
- **Receipt integrity.** Each receipt carries the hash of the one before it and `receipts verify` checks the chain; `receipts overrule <id>` lets a human void a decision so the cache never reuses it (both done in main). The cache key already includes the evidence, so an answer whose evidence changed is never reused and no separate stale mark is planned.

## v0.5: widen

- **`active` done-gate**, recommended only after at least 50 labelled stops with precision of 0.8 or better, at most 5% false blocks, a p95 of 3 seconds or less over every Jev attempt including failed ones (`p95_all_ms`), an error rate that is reported next to it, and the A/B.
- **A CI recipe and a GitHub Action** that run `done` on the test log of agent-opened PRs and `claims` on changed docs, and upload receipts as an artifact.
- **Release-note claims**, only if `claims` precision held on hold-out.
- **`judge --baseline`**, a ratchet that records existing violations once and reports only new ones.
- **The community plugin marketplace**, after the A/B.
- **Packs for runners and languages**, each parser a good first issue.

## 1.0

JSON output carries a `schema_version` and the output and pack formats are frozen; no known wrong `met` on the public injection set and on hold-out; the A/B is published; macOS and Linux verified and Windows either verified or stated as unsupported; the vulnerability process is defined in [SECURITY.md](SECURITY.md), the history is clean in gitleaks and npm provenance is on.

## Intentionally not planned

Routing, output pruning, a file briefing on the first prompt, skill suggestions, a Bash risk gate, a model-switch cache guard, an MCP server (after 1.0 at the earliest) and PR review are out, with one line of reasoning each in [docs/decisions/dropped.md](docs/decisions/dropped.md). Also left out: an `--engine v1` flag with `decide-compare` (v1 never existed in this repository), a migration from the earlier private kit's data directory, and the `TYPESAFE_KIT_HOOKS` environment variable (it belongs to that kit).

Have an idea? Open an issue with the pack suggestion or parser request template.
