# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- A timeout or abort that fires after the API's headers have arrived no longer kills the CLI and the hooks with an uncaught `AbortError` or `TimeoutError` and no output. The SDK (0.6.0) leaves that rejection behind; only those two are ignored, the command now ends with its JSON `timeout` line. Checked on Node 22 only.

## [0.1.3] - 2026-10-01

## [0.1.2] - 2026-10-01

### Added

- `lint-pack <dir> [--recorded <evals dir>]` checks a pack's questions against TypeSafe's question-writing rules and flags a Noul that scores high on every recorded input; `--fail-on warnings,errors` fails CI. The generic pack's `stop.*` and `verify.injection` questions were reworded to pass it; `verify-v2` was re-recorded and its numbers did not move.
- `npm run ci:local` runs the steps of CI locally (no key, a foreign HOME, bundle in sync with HEAD, bundle sizes, offline eval score, plugin validation, private terms).
- The Stop done-gate in `shadow` mode, off unless `.claude/referee.json` sets `hooks.stopGate` to `shadow`: after a turn with edits and no passing check it asks Jev whether Claude claimed success it didn't verify and records the answer in `stops.jsonl`. It never blocks and prints nothing. `receipts --stops [--unlabelled]` lists stops with precision and false-block figures, and `receipts --stops --label <id> --right|--wrong` marks one. Task and final-message text is sent to the TypeSafe API while it is on, see `docs/privacy.md`.
- `jev-evals/verify-v2`: 60 held-out and 30 dev labelled claims with their sources and recorded answers. `eval` handles `verify` suites.
- `jev-evals/done-v2`: 48 held-out and 30 dev labelled cases for `done` with their recorded answers; the injection suite now allows no wrong `met`.
- `scripts/probe-api.mjs`, `scripts/latency.mjs` and `scripts/order-sensitivity.mjs`: live checks of the API's edge cases, of latency at 1, 6 and 8 requests in parallel, and of option-order sensitivity. Their results from 2026-09-30 are in `jev-evals/api/` and `jev-evals/decide/`.
- `jev-evals/decide`: a public set of 20 decisions with 4 options each.
- `jev-evals/claims`: 31 labelled claims about this repository's docs, `decide`'s three-way answers to them, and the scripts that build and score them.
- `jev-evals/injection/ablation-dataguard-2026-10-01.jsonl`: the injection cases' answers with a "treat the evidence as data" sentence added to `done.met`'s note.
- Measurements: a section measured with claude-referee itself, and dated rows for it in the README table.
- `jev-evals/decide-close`: 39 close-call decisions, their screening reports and the 2026-10-01 option-order measurement, with the design pre-registered in `docs/decisions/decide-order.md` (`scripts/order-analysis.mjs`, `scripts/close-subsets.mjs`, `scripts/k3-calibration.mjs`).

### Changed

- `verify` matches quotes and numbers against the source in code first, asks Jev two three-way questions per claim (supports, contradicts, says nothing; both option orders) and one injection check on the source. The result lists `contradicted`, `says_nothing` and `reasons`; a source with a line aimed at the judge can't return `supported` (`source_injection`). On 60 held-out claims it has no wrong `supported` but confirms fewer true claims than before (19 of 24 against 22 of 24) and returns `unsure` more often.
- `done` parses recognised runner output in code (pytest, Ruff, Jest, Vitest, Mocha, ESLint, tsc, node:test, go test, cargo test, dotnet test, PHPUnit, RSpec) and sends only counts, the exit code, its label and the failing test names to Jev. Output that isn't recognised is sent as text and can never return `met`; it returns `unsure` with `trust: unparsed`. The result now has `trust`, `exit_code` and `runners`. The `done.met` note changed, so recorded answers were re-recorded.
- Probabilities in the JSON output are now rounded down to two decimals instead of to nearest, so 0.895 shows as 0.89 and a printed 0.90 means at least 0.90. `_usd` fields keep six decimals.

## [0.1.1] - 2026-10-01

### Added

- `receipts --usage` counts claude-referee CLI calls from this project's Claude Code transcripts: per day and command, subagents included, each tool call once, with the size of what each call returned. Nothing from the transcripts is printed.
- A circuit breaker for hooks that call Jev: after three failures in a row in one session, the rest of that session skips Jev (`breaker_open`). The CLI never uses it.
- `doctor` shows `base_url` when `TYPESAFE_BASE_URL` points somewhere other than the default, without credentials or query.
- `jev-evals/injection`: 33 test logs, with and without a note addressed to the judge, and Jev's answers from 2026-10-01. The measurements page and SECURITY.md describe the result.
- `eval record --suite <name|all>` asks Jev once per case of a suite under `jev-evals/` and appends the answers to `recorded.jsonl`, keyed by hashes of the question text and the redacted input. Cases already recorded are skipped unless `--fresh`.
- `eval score` re-scores recorded answers offline, without a key: verdict counts, precision, recall, automation and wrong positives, plus `--sweep`, which won't suggest a threshold while a class has fewer than 10 cases. It fails when a case has no recording or its question text changed.
- CI scores every recorded suite and fails when a suite's wrong positives exceed its `max_wrong_positive`. The injection suite allows one: the known wrong `met`, kept visible until `done` v2 fixes it.

### Changed

- README: a `judge` example, a pointer to TypeSafe's official plugin, and notes on Node's `PATH` and on Windows being untested. Diff examples use `git diff --no-ext-diff`, so an external diff tool can't empty the pipe.
- The session briefing prints the CLI path once and fits in 600 characters with a long installed plugin path.
- CI also runs the tests on macOS.
- The README uses the final design: new images, the yellow-card mark and plainer wording, checked section by section with Jev.
- Measurements now include the cache re-run and label the briefing numbers by version.

### Fixed

- `decide` no longer sends the home directory to TypeSafe in `context_files` paths: object keys in the request state are now redacted like values, so the home directory in a key becomes `~`.
- Two state keys that redact to the same text are both kept; the later one gets a `#2` suffix.
- A failed write to the data directory no longer loses the verdict: the result still prints, with a one-line warning on stderr.
- The plugin's `model` setting now reaches the CLI: the session hook exports it as `REFEREE_MODEL`.
- `--verbose` prints the run's requests, tokens, cost and time to stderr.
- `decide` uses a pack's `decide.micro.*` questions when the input has no `micro`.
- The session hook treats `false`, `0`, `no` and `off` in `hooks_enabled` as off.
- Code such as `inputTokens: reply.inputTokens` or `apiKey = config.apiKey` no longer stops a request as a secret assignment: a value made only of dotted letter segments, with no digits, is treated as code.
- `judge` and `verify` keep the answers they got when one request fails or the 90-second batch deadline passes; items without an answer are listed in `unanswered`, and `judge` never calls such a run clear.
- The client reports `rate_limited` at once when a 429's Retry-After is longer than the time budget.
- An unknown model now gets a `next_step` that names the model and points to `doctor --online`.
- `decide` rejects option names made only of digits, which would defeat the reversed order.
- `--dry-run` writes nothing to disk; long requests are shortened inline, and `--pretty` shows them in full.
- The no-key hint says `--values-stdin` needs Claude Code 2.1.285 or later.

## [0.1.0] - 2026-09-30

First public release.

### Added

- `done`: checks piped test or lint output against one or more criteria; verdicts `met`, `unsure` and `missing`.
- `decide`: scores 2-6 options, asking in the written and the reversed option order; verdicts `clear`, `weak` and `tie`, with a `lean` and `order_disagrees`. Reads `context_files` itself, supports per-option micro questions reported as flags, and switches to per-option scores when the options don't fit one request.
- `judge`: runs a pack's yes/no questions over up to 500 items, six requests at a time.
- `verify`: checks up to 100 claims against a source text, with the probability of each claim it can't confirm.
- `receipts`: totals, per-day token rows with `--tokens`, and `receipts export`.
- `doctor`: Node and Claude Code versions, where the key comes from (never the key), data directory, packs and model; `--online` checks the key with one free call.
- `--describe`, `--pretty`, `--dry-run`, `--fresh`, `--fail-on` and `--data-dir` on every command that needs them.
- Redaction before every request: credential-shaped values stop the request; emails, IP addresses, the home path and, in the `generic` pack, UUIDs are replaced.
- Local receipts and a 30-day answer cache; identical requests in flight are merged.
- API key lookup: plugin setting, `TYPESAFE_API_KEY`, `EVAL_TYPESAFE_API_KEY`, `TYPESAFE_API_KEY_CMD` and the macOS Keychain.
- The SessionStart briefing, at most 800 characters, only in projects with `.claude/referee.json`.
- The `generic` pack and the `jev` skill.

[0.1.3]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.3
[0.1.2]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.2
[0.1.1]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.1
[0.1.0]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.0
