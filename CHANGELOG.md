# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `receipts --usage`, the same as `--tokens`.

### Changed

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
