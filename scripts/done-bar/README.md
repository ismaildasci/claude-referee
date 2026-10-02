# done-bar

Tools for the split success bar registered in `docs/decisions/done-bar-split.md`. Node only, offline, no key, no log text. Run from a checkout (the scripts import the repo's own `done` code and parsers).

| Command | Result |
| --- | --- |
| `node scripts/done-bar/rescore.mjs [EVALS_DIR] [OUT]` | replays the recorded suites `done-v2-h2` to `h6` (and `h6p` apart) by evidence class into `docs/data/done-bar-split/` (`cases.jsonl`, `summary.json`); stale recordings are excluded and counted |
| `node scripts/done-bar/split.mjs [TABLE] [OUT]` | seeded repository split of the real-log table into dev and hold-out (`split.json`), dev-only parser backlog (`backlog-dev.json`), class counts (`classes.json`) |
| `node scripts/done-bar/report.mjs` | markdown tables for `docs/measurements-done-bar-split.md` |

`lib.mjs` holds the pure functions (class, cluster key, per-class scoring, split, backlog); `replay.mjs` the replay. Tests: `test/done-bar.test.ts`.
