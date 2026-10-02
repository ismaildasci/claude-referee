# Pending for the integrator: stream ab

Not applied to CHANGELOG.md or ROADMAP.md in this branch. Nothing under `plugins/claude-referee/dist` or `npm/` changed (no `src/` change).

## CHANGELOG, [Unreleased]

Added:

- `bench/`: the pre-registration (`bench/PREREG.md`) and harness for the v0.4 A/B (no gate, a 20-line test hook, `/goal`, claude-referee in `soft` mode): frozen cases and controls with a pinned hash, arm configurations, a seeded Williams-square plan, a pilot sizing rule, the registered analysis and a resumable runner. Nothing has been run beyond a 4-session dry run (0.19 USD).
- A transcript cost accountant (`bench/cost.mjs`) that groups usage by request id and prices 1-hour and 5-minute cache writes separately from the official price table; in the dry run it matched the CLI's own total to 0.000001 USD, except for a `/goal` session where the evaluator's requests are not in the transcript (23.5% gap).

## ROADMAP, v0.4 "A pre-registered A/B"

Replace the bullet with wording like:

- **A pre-registered A/B.** The plan is registered in [bench/PREREG.md](bench/PREREG.md) and the harness is in `bench/` (four arms: no gate, a 20-line hook that runs the project's tests, Claude Code's `/goal`, and claude-referee in `soft` mode; 16 cases plus 4 controls from the session-study task design; a pilot on the no-gate arm that sets the repetitions or stops the study; costs from transcripts grouped by request id with 1-hour and 5-minute cache writes priced separately and failed runs included). Not run yet: the pilot and the full run need the maintainer's go and the Jev key. An `active`-equivalent arm is not possible because `active` is not built. The result goes in `bench/RESULTS.md` whichever way it falls, and "not evaluable" is a registered outcome: the base-rate study saw 1 wrong "done" in 100 asked stops, and the study cannot show a difference unless the no-gate arm has at least 5.

## Notes for the integrator

- `check-no-private.sh` could not be run in this worktree: `.private-terms` is gitignored and copying it from the main checkout was denied by the auto-mode classifier. Run it from the main checkout after merging.
- The Jev forks (primary-outcome reading, cost denominator, hook guard) were taken conservatively without receipts because running the CLI from the main checkout was denied; PREREG section 14 lists them and says they can go to Jev before the pilot and be recorded as an amendment.
- `bench/cases.json` is a frozen copy of 20 `scripts/session-study` tasks; do not regenerate it after registration (its SHA-256 is quoted in PREREG and checked by `test/bench-stats-plan.test.ts`).
- `bench/stats.mjs` imports `src/engine/stopgate/interval.ts` directly (Node 22.18 or later type stripping, like the tests and `scripts/session-study/cli.mjs`); it is not part of the bundle.
