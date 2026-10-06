# i18n second real-code sample

Registered in [docs/decisions/i18n-real-2.md](../../decisions/i18n-real-2.md). Same tools as the first sample (`scripts/i18n-real/`, run with the second-sample flags), same search lists and metadata (`docs/data/i18n-real/`).

| File | What |
|---|---|
| `content-filter.json` | Every repository the content filter looked at, in list order, after the first sample's: commit, English locale files, removed calls in files `extract` reads, skips by reason |
| `repos.json` | The repositories taken, with commit, licence and URL |
| `sites/*.jsonl` | Every removed translation call: file, line, position type, key, English value, whether `extract` reads the file |

The English strings in `sites/` and in the suites come from the repositories in `repos.json`, at the commits named there, under their licences; copyright stays with their authors.
