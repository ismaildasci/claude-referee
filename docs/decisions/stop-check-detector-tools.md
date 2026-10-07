# The Stop gate counts more real toolchain checks

Registered 2026-10-07, before any code change or replay.

## Why

A local analysis of real use on the maintainer's machine (other projects, aggregate counts only) found that the Stop gate's check detector (`checkKind` in `src/engine/stopgate/transcript.ts`) does not count several common checks: of 2,783 check-like Bash segments in other projects, 609 were not counted (117 of 318 since the global install). The largest groups: `php -l` 211, `prettier --check` 123, `phpstan` 94, `node --test` 70, `composer test` 39, `vue-tsc` 26, `php artisan test` 14, `pint --test` 2; in this repository `node --test` 382 and `npm run ci:local` 166. Separately, a stored check keeps only the first 200 characters of the whole command; in 15 of 37 counted checks in stop turns that prefix had no check segment left (a leading `cd dir &&` or a heredoc ate it), so Jev saw a command with no check in it.

The earlier decision [stop-check-detection.md](stop-check-detection.md) chose not to count Claude's own code runs as checks; this registration only adds named test, lint and type-check tools and project scripts, not ad hoc runs.

## Rules

1. Count as checks, with the same pass and fail reading as today: `node --test`; `php -l`; `php artisan test`; `phpstan` (direct, `vendor/bin/phpstan`, `phpstan analyse`); `composer <script>` when the script name matches the existing script pattern or `analyse`; `vue-tsc` (silent, like `tsc`); `prettier --check`; `pint --test`; `oxlint`; and package scripts named `ci`, `ci:*`, `verify` or `verify:*`. Flags between `run` and the script name (`npm run -s test`) are skipped.
2. A stored check keeps the matched check segment (each at most 200 characters, several joined) instead of the first 200 characters of the whole command; a leading `cd` segment and heredoc bodies are dropped.

## What will be reported, and the bar

- Replay on the recorded stop suites (`stop-sessions`, `stop-study`, `stop-hard`, `stop-req`): every change in skip reason, asked set and state sent to Jev. **Bar: no wrong "done" in those suites may move from asked to skipped.** A wrong "done" whose transcript shows one of the newly counted checks passing after the last edit would now be skipped by code without asking Jev; if any such case exists, the rule is not shipped as is.
- Replay on the real-use stops on this machine (aggregate counts only): how many asked stops move to `check_passed_after_edit`, and how many stored checks now name a check segment.
- If a recorded stop case's state changes, it is re-recorded in place and reported, as for the cargo build marker.

A change fitted to tools seen in real use, not a clean test. The Stop gate runs in `shadow` or `soft` mode only; `soft` users would see fewer warnings on turns where one of these checks passed after the last edit.
