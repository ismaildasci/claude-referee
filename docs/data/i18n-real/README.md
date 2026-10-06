# i18n real-code hold-out data

Registered in [docs/decisions/i18n-pack-eval.md](../../decisions/i18n-pack-eval.md) (amendment of 2026-10-06). Scripts: `scripts/i18n-real/`.

| File | What |
|---|---|
| `search-react.json`, `search-vue.json`, `search-html.json` | Raw GitHub code-search lists (query, fetch time, repositories in first-seen order) |
| `metadata.json` | Fork, archived, licence, stars, last push for every listed repository |
| `meta-filter.json` | Metadata filter result per list: counts by reason and the passing repositories in order |
| `content-filter.json` | Every repository the content filter looked at, in order: commit, English locale files, removed calls in files `extract` reads, skips by reason |
| `repos.json` | The repositories taken, with commit, licence and URL |
| `sites/*.jsonl` | Every removed translation call: file, line, position type, key, English value, whether `extract` reads the file |

The English strings in `sites/` and in the suite come from the repositories in `repos.json`, at the commits named there, under their licences (Apache-2.0 and MIT); copyright stays with their authors.
