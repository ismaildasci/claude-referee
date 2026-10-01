# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `receipts --stops`: a weak label hint for an unlabelled `would_block` stop, read from the user's next prompt in the session transcript. Only `right` is ever suggested, with reason `reported_broken` (the prompt says it does not work, fails, errors, English or Turkish; negated, hypothetical, question and instruction clauses such as "no crash", "add a failing test" or "do not run the tests" are ignored, so a missed report is preferred over a wrong hint) or `repeated_request` (it largely repeats the prompt of the turn that stopped). Approval, thanks and silence suggest nothing (decided with Jev, p 0.95, both orders). The hint is computed on read, stored nowhere, never printed with the message text, never counted in stats and never overrides a human label.
- `receipts --stops` returns `threshold_suggestion`: available only with at least 10 human labels of each class on `would_block` stops. It uses exact Clopper-Pearson 95% intervals (no dependency) and suggests the smallest `claims_done` at or above the current threshold whose kept labelled stops have a precision lower bound of 0.8 or more, or null; it never suggests lowering it and writes nothing.
- `hooks.stopGate: "soft"`: like `shadow`, and when Jev would block the Stop hook also prints one `systemMessage` warning (shown to the user, no block, no context for Claude). Stops are recorded with `mode: "soft"`.
- Receipt integrity: each receipt carries `prev`, the sha256 of the previous line of its project's chain, and `receipts verify [--project-only]` reports breaks (`mismatch`, `fork` from two runs appending at once, `unreadable`); receipts written before this are counted as `unchained`. `receipts overrule <id>` records a human veto in `overruled.jsonl` and deletes the cached answers that receipt used, so the next run asks Jev again. Receipts now list the `cache_keys` they used. The chain detects edits and deletions in the middle of the history; it does not stop someone who rewrites it from the start or truncates its end.

## [0.1.6] - 2026-10-01

### Changed

- `done` never says `met` when the log itself says no tests ran (`no tests to run`, `no tests found`, `0 tests executed`, `Tests run: 0`, `nothing to run`), even with an exit code of 0: `unsure` with `reason: "no_tests_run"`.

### Added

- `jev-evals/claims-tr`: 44 invented Turkish claim and source pairs (registered in `docs/decisions/claims-tr.md`); no wrong `supported`, 13 of 17 true claims confirmed.
- `claims` is the new name of `verify`, so it isn't confused with Claude Code's own `/verify`; `verify` stays an alias until 1.0 and behaves the same. Receipts still record the command as `verify`.
- `jev-evals/done-v2-h4`: a fourth hold-out for `done` v2 (46 cases, registered in `docs/decisions/done-v2-holdout4.md`); it failed its registered check, and the suite's allowance is the 1 remaining observed wrong `met`.

## [0.1.5] - 2026-10-01

### Fixed

- Labelling a stop (`receipts --stops --label`) rewrote the whole `stops.jsonl`, so a stop recorded by another session at that moment could be lost. Labels are now appended to `labels.jsonl` and merged on read; labels written inline by earlier versions are still read. The size-based pruning of old stops now skips the rewrite when the file changed under it.
- A project's `stop.gate` threshold for `claims_verified` or `blocked` could only be raised, which made the done-gate fire more, the opposite of "a project can only make a check stricter". Those two now accept only a lower value. Shadow mode only; `decideStop` now has direct tests for every threshold edge.

### Changed

- `done` never says `met` when tests were skipped, risky or incomplete (a skipped or ignored count above 0, or PHPUnit's "OK, but incomplete, skipped, or risky tests!"): the verdict is `unsure` with `reason: "skipped_tests"`, whatever Jev answers. The skipped count stays in the facts.

### Added

- Parsers for `node --test` TAP output, the `eslint` summary line (warnings are a separate fact), `tsc -b`, `golangci-lint`, `vite build` and `cargo build`/`check` (warnings are a separate fact). Fewer runs depend on an exit code alone. PHPUnit's `Risky:` and `Incomplete:` counts now count as not fully passed (in `skipped`). The 10 cases of `done-v2-h3` and one of `done-v2-h2` that these changed moved to `done-v2` as dev.
- `jev-evals/done-v2-h3`: a third hold-out for `done` v2 (46 cases, registered in `docs/decisions/done-v2-holdout3.md`). It failed its registered check (2 wrong `met`); the suite's allowance is those 2 observed cases.
- Parsers for Python `unittest` and `cargo clippy`. Clippy output reports its warnings as a separate `warnings` fact, so a criterion like "lint is clean" no longer rests on an exit code alone.
- `jev-evals/done-v2-h2`: a second hold-out for `done` v2 (45 cases, registered in `docs/decisions/done-v2-holdout2.md`). It failed its registered check with one wrong `met`; the suite's allowance is that one case. `eval` now applies the non-zero exit-code rule like `done` does.
- `scripts/hook-latency.mjs` and a CI step: a hook process must stay within 40 ms of a bare `node` at p95 (measured locally: +27.5 ms and +24.5 ms).
- `receipts --stops` also reports `errors`, `error_rate` and `p95_all_ms`: Jev errors and breaker skips are counted, and the p95 covers failed calls too, so a slow failure can no longer make the gate's latency figure look better.

## [0.1.4] - 2026-10-01

Correction: the done-gate in `shadow` mode, `lint-pack` and `verify` v2 shipped in 0.1.3 (`git log v0.1.2..v0.1.3`), although the sections below list them under 0.1.2; the released sections were left as they are.

### Fixed

- A timeout or abort that fires after the API's headers have arrived no longer kills the CLI and the hooks with an uncaught `AbortError` or `TimeoutError` and no output. The SDK (0.6.0) leaves that rejection behind; only those two are ignored, the command now ends with its JSON `timeout` line. Covered by a test that runs in CI on Node 22 and 24.
- A PHPUnit `Tests: 45, Assertions: 90` line was read as a jest summary, which put a phantom `jest 0/0/0/0` runner next to `phpunit` in the facts sent to Jev. The jest parser now needs a `passed`, `failed`, `skipped`, `todo` or `total` count on its `Tests:` line. 4 `done-v2` cases whose evidence changed were re-recorded; no wrong `met`, and the held-out counts did not move (15 of 18 `met`, 27 of 30 `missing`).
- A probability exactly on a band is no longer pushed over it by float arithmetic: `judge` now counts 0.10 as `no` at the 0.9 band (`1 - 0.9` is 0.0999...8 in JavaScript), and `decide` counts a margin of exactly 0.1 as `weak` instead of a tie.
- The TypeSafe key is sent only to `https://api.typesafe.ai`. A `TYPESAFE_BASE_URL` pointing elsewhere (for example set by a project's `.claude/settings.json` `env`) used to receive it; now it needs its own `REFEREE_BASE_URL_KEY`, and without one no request is made and `doctor` says why. The three live-check scripts follow the same rule.

### Changed

- `done` with a non-zero exit code in the evidence (an `exit code: N` line) answers `missing` with `reason: "exit_code_nonzero"` and does not ask Jev, even after a clean runner summary; `--dry-run` still shows the request. A criterion that is about the failure itself can't be judged this way.

### Added

- `eval` handles `judge` suites (`suite.json` with `"command": "judge"` and a `question`; cases with `text` and an expected `yes`, `no` or `review`), and `eval record` takes `--max-requests` and `--max-usd`: it stops before the first request when more cases are still to record, or the estimated input cost is higher.
- `jev-evals/judge-risky` and `jev-evals/judge-env`: 62 invented labelled cases each for `line.risky` and `failure.env`, with their recorded answers; both suites allow no wrong `yes` and pass.
- `scripts/docs-watch.mjs` and a weekly workflow compare TypeSafe's `models.md`, `api.md` and `llms.txt` with the hashes in `docs-watch.json` and fail when one changes, printing the limits row; TypeSafe's limits changed once without an announcement we could find.
- CI scans the whole git history with gitleaks 8.30.1 (pinned, checksum verified); `.gitleaks.toml` allows only the fake-credential fixtures in `test/redact.test.ts`, `test/key.test.ts` and `test/doctor.test.ts` and the case ids in `jev-evals/decide-close/subsets.json`. The history scan of 67 commits found nothing else.

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
