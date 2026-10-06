# i18n-real

Tools for the public-repo hold-out of the `i18n` pack, registered in `docs/decisions/i18n-pack-eval.md` (amendment and note of 2026-10-06). Node only, no dependencies beyond the repo's own `extract` code (imported from `src/`, so run from a checkout); needs an authenticated `gh` and `git`. Clones and stripped copies stay in a local directory and are never committed.

| Step | Command | Result |
| --- | --- | --- |
| 1 search | `node search.mjs --out DIR` | `search-<framework>.json` (raw code-search lists), `metadata.json`; clones nothing |
| 2 strip | `node strip.mjs --out DIR` | content filter in list order (`content-filter.json`), the repositories taken (`repos.json`), stripped copies under `copies/`, removed calls in `sites/<repo>.jsonl` |
| 3 sample | `node sample.mjs --out DIR` | `recall.json` (registered and amended found rule), `items.jsonl` (seeded sample, origin Y and O), `leakage.json`, `blind/labeller-{1,2}.jsonl` and their key maps in `keys/` |
| 4 assemble | `node assemble.mjs --out DIR --labels1 F --labels2 F --suite jev-evals/judge-i18n-real` | `cases.jsonl` with the registered scored labels, both label files by id, `dropped.json`, `agreement.json` |
| 5 record | `claude-referee eval record --suite judge-i18n-real` | Jev answers in `recorded.jsonl` (needs the TypeSafe key) |
| 6 score | `node score.mjs jev-evals/judge-i18n-real` | the bar and the breakdowns, from the suite alone |

`lib.mjs` holds the pure functions (metadata filter, locale namespaces, key resolution, call removal by position, the found rules, seeded order) and is tested in `test/i18n-real-lib.test.ts`. Give each blind file to its labeller in a directory of its own; the key maps and `items.jsonl` must stay out of the labellers' reach.
