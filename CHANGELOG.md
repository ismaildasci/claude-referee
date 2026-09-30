# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[0.1.0]: https://github.com/ismaildasci/claude-referee/releases/tag/v0.1.0
