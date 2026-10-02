# Pending lines from stream donebar

Not applied to CHANGELOG.md, ROADMAP.md or docs/measurements.md; the integrator merges them.

## CHANGELOG (Unreleased)

- Added: split `done` v2 success bar by evidence class (R parsed, E exit code only, U neither), registered in `docs/decisions/done-bar-split.md`; offline rescoring scripts `scripts/done-bar/` (class, cluster, split, report) with tests.
- Added: frozen repository-level dev and hold-out split of the real-log sample (`docs/data/done-v2-real/split.json`) and a parser backlog ranked from dev only (`backlog-dev.json`).

## ROADMAP row (`done` v2 on real CI logs, replace or add)

`done` v2 split bar | registered, rescored post hoc, not a pass | wrong `met` 0 of 57 in every class after caps (9 raw before caps), pooled `missing` recall 0.754 (0.889 with code-decided cases added, inflated by construction; bar 0.9), R `met` recall 23 of 30 (bar 0.9, evaluable at exactly the minimum n), E `met` recall 0.53 (no bar), U 19 of 137 sent clusters; real-log hold-out has 28 parsed expected-`met` (< 30, bar not evaluable) and no judge answers yet ([measurements](docs/measurements-done-bar-split.md)). Next: record real-log answers, then a fresh sample split before any parser is written.

## docs/measurements.md

Link only: [done v2 under the split bar](measurements-done-bar-split.md) (post hoc rescoring of hold-outs 2 to 6 and the real-log sample by evidence class; not a pass).
