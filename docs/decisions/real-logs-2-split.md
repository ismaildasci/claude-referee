# done v2: split of the second real-log sample, parsers from dev only

Registered 2026-10-06 before any parser is written; the commit that first contains this file is the registration. Done before it: reading the second study's documents, tables and backlog (all published), the first split's script, and computing the split below from repository names and language buckets only.

## Why

The [second real-log test](done-v2-real-logs-2.md) failed its registered bars; its result and parser backlog are published ([measurements](../measurements-real-logs-2.md)) and two parsers were already fitted to two of its cases ([parser fixes](parser-fixes-real-logs-2.md)). Its 126 repositories are therefore **dev data in the sense of the [first split](done-bar-split.md): the code has been fitted to them**. The backlog of that study (cmake, make, mix test, wrapper builds, phpstan, ctest, xcodebuild, rubocop) is the next parser work. To keep some measurement of that work, the sample is split now, by repository, before a parser exists.

## What the hold-out is, and is not

**The hold-out half is a second look at a sample whose aggregate bars were already seen. It is not an unseen test.** The pooled numbers, the tool-level backlog (all 126 repositories, hold-out included) and the ten parsed-recall misses were published before this split, and two parsers were fitted to a gson and a CotEditor case. What the split does protect: no parser of this task is written from a hold-out log, and the hold-out is scored once on the final code. A clean unseen test needs a **third sample**, fetched and split in advance (a later task). `done` v2 stays "not measured" on its original bar whatever this produces.

## Split rule (fixed now)

Same function as the first split (`splitRepos` in `scripts/done-bar/lib.mjs`), different seed: **`real-logs-2-split-v1`**. Within each primary-language bucket (the `language` field of the table: 17 buckets), repositories are ordered by `sha256(seed + ":" + repo)` (hex, ascending); positions 0, 2, 4, ... are **dev**, positions 1, 3, 5, ... are **hold-out** (dev gets the extra repository of an odd bucket). Every case inherits its repository's part. Ratio: about half and half; the fork was put to Jev in the [first split](done-bar-split.md) (half 0.50 both times, orders agreeing once, under the 0.90 bar, so the conservative half and half) and is carried over, not re-asked.

Result (`docs/data/done-v2-real-2/split.json`, script `scripts/real-ci/split2.mjs`, input: `repo` and `language` of `table.jsonl`): **64 dev and 62 hold-out repositories; 134 dev and 138 hold-out cases (272 kept, 231 sent to Jev)**. The id list of each half is in the file. **Hold-out id hash**, SHA-256 of the sorted hold-out case ids joined with `\n`, no trailing newline: `f071af82c5cc780a02e2bcd817ff0c2d9dff4c112a49daff92ac5215675feba9`.

## Parser rules (fixed now)

1. **Dev logs only.** A parser is written from dev log text. The text of a hold-out case is never read by the author or an agent, for any purpose, until after the single scoring. The local suite is filtered to dev ids before any text is opened. Parser backlogs are ranked from `backlog-dev.json` (dev cases only; committed with this file).
2. **At least 3 real dev examples per parser** (cases of that tool in dev, parsed or not, whatever their label), else the parser is skipped and the reason recorded: a skipped tool stays unparsed (class E). A wrapper build (`npm run build` and similar) gets a parser only if the dev logs show a stable success marker of the underlying tool; the wrapper name alone is never enough.
3. **Same contract as the existing parsers**: any error, failure, forged or indented line, truncation, incomplete run, missing success marker or exit code conflict cannot give `met`; build-only parsers set the `build_only` mark ([parser fixes](parser-fixes-real-logs-2.md)). Formats are checked against the tools' official documentation, cited in the decision record written with the parsers, not in code. Synthetic fixtures mirror real shapes (pass, fail, truncated, forged, warnings); no cross-tool claims.
4. **Replay.** Every recorded `done-v2*` suite and both real-log tables are replayed with the recorded answers on the old and the new code; only intended rows may change, and they are listed. For a hold-out row that changes unexpectedly the author looks at the parsed facts and the matched pattern only, not the text; if the cause is not derivable from those the parser is narrowed or removed (decided from dev logs and fixtures).
5. **Nothing after scoring.** The hold-out is recorded and scored once, on a code commit named before the first request. No parser, cap or rule is edited after the first hold-out answer is recorded; defects found are reported, not fixed in this task. The clip (first 2,000 and last 12,000 characters) is not changed in this task.
6. **Dev re-recording.** Changed dev cases may be re-recorded with the repository's `eval record` on copies of the local suites, as often as needed; the dev numbers after are labelled fitted.

## What is reported (no pass or fail verdict; second look)

Per half (dev, hold-out), before the parsers (code of main at 0.2.2 with the recorded answers) and after: **wrong `met`** (over expected-`missing` sent cases: k of n, exact one-sided 95% upper bound, repository-clustered bound with the repository as the unit), **`met` recall among parsed cases** (k of n, exact two-sided 95% Clopper-Pearson, and a repository-level bootstrap interval, B = 2000, resampling repositories, percentile 2.5 and 97.5, PRNG seeded from `sha256("real-logs-2-split-boot")`), **parsed coverage of sent cases** (same two intervals). Also verdict mix and the rows that changed. Small n is said, not hidden: hold-out wrong `met` is over a few dozen negatives.

Separately, on **dev rows only**: whether the done clip hides failures, by `chars_cut > 0` against correct and wrong verdicts (counts, no change to the clip).

## Order of work

mix test, then `cmake --build` and `make`, then wrapper builds (only if rule 2 allows), then phpstan, ctest, xcodebuild, rubocop. Dev-only backlog (cases / expected `met` / repositories among unparsed dev cases): `make` 5 / 5 / 3, `npm run build` wrappers 4+1 / 4+1, `mix test` 5 / 2 / 3, `rubocop` 3 / 2 / 2, `cmake --build` 6 / 1 / 5, `ctest` 4 / 0 / 2; `phpstan` has 2 dev cases and `xcodebuild` none, so by rule 2 they are skipped unless dev examples elsewhere arise (they do not: the sample is the only source).

## Limits, stated now

- The same labellers (two model processes, no human) and one Jev model version; labels of this sample are reused unchanged.
- Most backlog tools appear in few repositories, so a parser written from three dev cases may meet formats of the hold-out it has never seen: that is what the hold-out measures.
- Class membership is a property of the parsers at scoring time: new parsers move cases from E to R and change every rate, which is why before and after are shown per half.
- Repository-level clustering counts the repository as the unit; cases of one repository share workflows and output formats, so the effective n is smaller than the case count.
