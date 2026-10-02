Stream: baseline. For the integrator to merge; not applied in this branch.

## CHANGELOG.md, under [Unreleased], add a section

### Added

- `judge --baseline <file>` is a ratchet for adopting a rule on existing code: only findings not in the baseline count, so the verdict is `flagged` for a new yes only and `--fail-on flagged` fails on regressions. The result adds `new`, `baselined` and `gone`. `judge --baseline <file> --baseline-write` records the current yes answers (verdict `recorded`, with `recorded`, and over an existing file `added` and `dropped`). The file (`version` 1, the pack name, and per question a count per hash) holds SHA-256 prefixes of the question id plus whitespace-normalised text and nothing else; line moves and re-indentation stay known, an edited line is new, and duplicates match as a multiset. See [docs/judge-baseline.md](docs/judge-baseline.md) and [the design record](docs/decisions/judge-baseline.md).

## ROADMAP.md, v0.5

Replace the line starting with "- **`judge --baseline`**" by:

- **`judge --baseline`**, a ratchet that records existing violations once and reports only new ones (done in main: [docs/judge-baseline.md](docs/judge-baseline.md)).
