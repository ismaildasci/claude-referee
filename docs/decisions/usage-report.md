# scripts/usage-report.mjs: the four usage measures, reproducible

Registered 2026-10-09, before any code change. Chosen with `decide` among three options (maintainer script o2 1.00, both orders agreeing; receipt `rmv131y002f0c`).

## Why

The development loop rests on four measures that were computed with throw-away scripts and then lost; twice a throw-away script mis-attributed receipts. The baselines live only in conversation.

## The measures (local data only, counts and shares, no text)

1. **Edit turns with a counted check:** stop records grouped by `turn`; turns with edits; those with a counted check. Baseline 28 of 52 (54%), before the briefing nudge went live.
2. **Re-ask after a non-clear decide:** per session, the next `decide` within 10 minutes of a `weak` or `tie` one, and how many are `clear`. Baseline 24 of 83.
3. **Exit-code-only `missing`:** `done` receipts, `missing` ones with `trust: exit_code`, and their `evidence_lines` (under 5, 5 or more, unknown for receipts before 0.2.7). Baseline 123 of 242.
4. **Labels:** receipt labels joined to the receipt's verdict, right and wrong per verdict (4 right, 0 wrong `met` so far).

`--days N` (default 7), `--since <ISO time>` for before and after comparisons, `--data-dir`. Output: one JSON line.

## Bars

- **B1:** invented receipts, stops and labels give exactly the expected counts for each measure, including the window and the 10-minute rule.
- **B2:** no text field is read or printed; ids and criteria never appear in the output.
- **B3:** the script runs on the real data directory and its totals agree with `receipts --evidence-stats` for the labels.
- **B4:** `npm run check` and `ci:local` green; a note in CONTRIBUTING.

## Limits

- It reads one data directory (all projects in it); it cannot tell this repository's own worktrees from other projects without the `worktree` field, which only receipts written by 0.2.6 and later have.
- The measures are observational; no control group.
