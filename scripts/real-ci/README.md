# real-ci

Tools for the real-log study registered in `docs/decisions/done-v2-real-logs.md`. Node only, no dependencies; needs an authenticated `gh` and a `claude` CLI for labelling. Raw logs and evidence text stay in a local cache directory and are never committed.

| Step | Command | Result |
| --- | --- | --- |
| 1 fetch | `node fetch.mjs --out DIR [--per-lang 8] [--topup]` | `DIR/cases-raw.jsonl` (only the repositories the registered selection accepts); resumable (repos, job logs cached), sleeps when the `gh` rate limit is low |
| 2 prepare | `node prepare.mjs DIR` | redaction screen, parsed facts, the unparsed-never-met check |
| 3 label | `node label.mjs DIR 1` then `node label.mjs DIR 2` | `labels1.jsonl` (all succeeded steps), `labels2.jsonl` (random 30%, blind) |
| 4 assemble | `node assemble.mjs DIR SUITE_ROOT` | drops ambiguous, disagreeing and silent-`met` cases (`met` on output that is only the command echo and exit 0); writes the local suite `SUITE_ROOT/done-v2-real` with text |
| 5 record | `claude-referee eval record --suite done-v2-real --evals-dir SUITE_ROOT` | Jev answers into `recorded.jsonl` (needs the TypeSafe key in the keychain) |
| 6 analyze | `node analyze.mjs DIR SUITE_ROOT OUT` | `table.jsonl` (no text), `backlog.json`, `parsed-runners.json` |
| 7 score | `node score.mjs OUT/table.jsonl` | the registered metrics, from the table alone |

`lib.mjs` holds the pure functions (transport stripping, step segments, classifier, evidence text, silent-output rule, negative kinds, exact intervals) and is tested in `test/real-ci-lib.test.ts`. Steps 2, 4 and 6 import the repo's own `done` code, so run them from a checkout.

Second sample (`docs/decisions/done-v2-real-logs-2.md`): `fetch2.mjs --out DIR --exclude docs/data/done-v2-real/split.json` replaces `fetch.mjs` (each `--langs` or `--topup` pass leaves a record in `DIR/passes`, and `stats.json` sums their `gh` calls; before 2026-10-07 it kept only the last pass's count, so `calls: 0` in `docs/data/done-v2-real-2/fetch.json` is the count of the last pass that wrote it, which made no `gh` call, not the total); `label.mjs DIR 2 --share 0.4 --cost`; `assemble.mjs DIR ROOT done-v2-real-2` and `analyze.mjs DIR ROOT OUT done-v2-real-2`; `score2.mjs TABLE` prints the per-class metrics with exact and repository-level intervals.

Third task (`docs/decisions/real-logs-2-split.md`): `split2.mjs` splits the second sample by repository (seed `real-logs-2-split-v1`); `halves2.mjs TABLE` scores a table per half (wrong `met`, `met` recall among parsed, coverage, exact and repository-bootstrap intervals).
