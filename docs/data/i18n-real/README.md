# i18n real-code hold-out data

Registered in [docs/decisions/i18n-pack-eval.md](../../decisions/i18n-pack-eval.md) (amendment of 2026-10-06). Suite, labels and Jev answers: `jev-evals/judge-i18n-real/`. Scripts: `scripts/i18n-real/`.

| File | What |
|---|---|
| `search-react.json`, `search-vue.json`, `search-html.json` | Raw GitHub code-search lists (query, fetch time, repositories in first-seen order) |
| `metadata.json` | Fork, archived, licence, stars, last push for every listed repository |
| `meta-filter.json` | Metadata filter result per list: counts by reason and the passing repositories in order |
| `content-filter.json` | Every repository the content filter looked at, in order: commit, English locale files, removed calls in files `extract` reads, skips by reason |
| `repos.json` | The repositories taken, with commit, licence and URL |
| `sites/*.jsonl` | Every removed translation call: file, line, position type, key, English value, whether `extract` reads the file |
| `recall.json` | Extractor recall under the registered and the post-hoc amended found rule, pooled, per repository and per position, with exact intervals; how often a registered match was containment rather than equality |
| `items.jsonl` | The seeded judge sample (168 items): origin Y or O, `contains_removed_value` by the amended rule, kind, text, context |
| `leakage.json` | Shape of Y against O items before blind labelling (placeholders, braces, translation calls in context, kinds) |
| `score.json` | The registered bar and the breakdowns after recording, from `scripts/i18n-real/score.mjs` |

The English strings in `sites/` and in the suite come from the repositories in `repos.json`, at the commits named there, under their licences (Apache-2.0 and MIT); copyright stays with their authors.
