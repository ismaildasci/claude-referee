# i18n second real-code sample

Registered in [docs/decisions/i18n-real-2.md](../../decisions/i18n-real-2.md). Same tools as the first sample (`scripts/i18n-real/`, run with the second-sample flags), same search lists and metadata (`docs/data/i18n-real/`).

| File | What |
|---|---|
| `content-filter.json` | Every repository the content filter looked at, in list order, after the first sample's: commit, English locale files, removed calls in files `extract` reads, skips by reason |
| `repos.json` | The repositories taken, with commit, licence and URL |
| `sites/*.jsonl` | Every removed translation call: file, line, position type, key, English value, whether `extract` reads the file |
| `split.json` | The repository split (seed, rule, dev and hold-out lists, hash of the hold-out list) |
| `recall.json` | Extractor recall over all nine repositories, registered and amended found rule, per repository and position |
| `dev-items.jsonl`, `holdout-items.jsonl` | The seeded samples (origin Y or O, kind, text, context); `dev-leakage.json`, `holdout-leakage.json` their shape check before blind labelling |
| `dev/` | Dev cases with the scored labels, both blind label files, agreement and dropped items |
| `wordings/` | The candidate packs (`i18n-w1`, `i18n-w2`, `i18n-w4`, `i18n-w5`) with `SHA256SUMS`; load them with `REFEREE_PACKS_DIR=docs/data/i18n-real-2/wordings` |
| `dev-recordings/` | Jev answers of the old wording and every candidate on the new dev and the synthetic dev items, and `score.json`, the registered choice |
| `holdout-w1/`, `synthetic-w1/` | Suites for the frozen `i18n-w1` on the hold-out and on the synthetic hold-out, with their recordings; they need `REFEREE_PACKS_DIR` and are kept out of `jev-evals/` on purpose, so that `eval score --suite all` never meets an unbundled pack. The old wording's suite is `jev-evals/judge-i18n-real-2` |
| `holdout-compare.json` | Both wordings on the hold-out and the adoption checks, from `scripts/i18n-real/compare.mjs` |

The English strings in `sites/` and in the suites come from the repositories in `repos.json`, at the commits named there, under their licences; copyright stays with their authors.
