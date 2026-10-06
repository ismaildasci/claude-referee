# i18n pack: a second real-code sample, a reworded question and HTML (registration)

Written and committed before any repository of this sample is cloned and before any wording is tried. Taken from the maintainer's ordered list on 2026-10-06 (after the [first real-code hold-out](i18n-pack-eval.md#public-repo-hold-out-planned-first-then-run-on-2026-10-06)).

## Why

On the first real-code hold-out the judge decided only 32 of 157 candidates and never answered `no`; the median answer on items labelled `no` was 0.77. Reading that hold-out's items suggests a cause: the question asks whether a string is "shown to end users in the interface, so that it should be translated", and many real technical candidates are shown but have nothing to translate (an expression with a unit such as `{formatBytes(x)}/s`, a version string, a brand name). **That reading comes from the first hold-out, so any rewording is fitted to it**; this sample is what tests the rewording. It also fills the HTML gap of the first sample.

## Repositories (rule fixed now)

- **React and Vue: the same committed lists, continued.** `docs/data/i18n-real/search-react.json` and `search-vue.json` with `metadata.json` and the metadata filter as registered; the content filter (an English JSON locale, at least 40 removable calls in files `extract` reads) runs in list order **after the last repository the first sample looked at**, and the next **four** that pass are taken per framework. The four repositories of the first sample, and the ones it rejected, are never used in any role.
- **HTML: a lower star floor.** In `search-html.json`, 221 repositories, 49 have an allowed licence and 48 of those were stopped by the 25-star floor (the last-push check comes after it); plain-HTML projects that translate are small. For HTML the floor is **5 stars**, the licence rule is unchanged, and the content filter needs **20** removable `data-i18n` keys. Up to four are taken in list order; `babutree/TTS-API` (no English JSON locale) is not looked at again. If none passes, the record says so and HTML stays open.
- Clones at the default branch, commit recorded; the strip and match rules are those of the first sample (`scripts/i18n-real/lib.mjs`), and `extract` is the fixed one (e08ace1). Both the registered and the amended found rule are reported for recall.

## Split (rule fixed now)

By repository, before any candidate text is read: within each framework, repositories ordered by `sha256("i18n-real-2-split-v1:" + repo)` ascending; positions 0, 2 are **dev**, 1, 3 are **hold-out** (with an odd count dev gets the extra one). Hold-out candidate text is not opened by the author until the single scoring; only the blind labellers see it.

## Sample and labels (cap fixed now)

Per repository, seeded as before (`sha256("i18n-real-2-v1:" + id)`): up to **10 origin Y** and **20 origin O** candidates (O weighted, because the `no` band is what is studied). At most 12 repositories, so **at most 360 labelled items** in all, about twice the first sample; more needs the maintainer's say. Labels as before: two fresh blind labeller subagents per batch, each in its own directory, only key, text and context, the pack's question and criteria verbatim; dev is labelled first, the hold-out only after the wording is frozen. Scored labels: Y is `yes` unless both labellers say `no` (then dropped); O carries the agreed label, disagreements dropped. The leakage check of the first sample is repeated per batch.

## Rewording (rules fixed now)

- **What may change**: only the `string.translatable` question text, its note and its two criteria, in a candidate pack loaded through `REFEREE_PACKS_DIR` (the bundled `i18n@0.1.0` stays untouched and keeps its hashes). The bands (yes at 0.90, no at 0.10), the model and `extract` do not change.
- **At most six candidate wordings**, each recorded on the new dev items and on the synthetic `judge-i18n` dev split (40 items). The old wording is recorded on the new dev items too, as the baseline.
- **Choice on dev**: among candidates with no wrong `yes` and no wrong `no` on both dev sets, the one with the most correct `no` on the new dev items, then the most definite answers, then the shorter text. If none qualifies, no wording is taken and the hold-out measures the old wording only.
- **Freeze**: the chosen wording, its pack files and their SHA-256 are committed before any hold-out request.

## Hold-out (rules fixed now)

- Both wordings are recorded once on the same hold-out items (one request per item each; no `--fresh`), and the new wording once on the synthetic `judge-i18n` hold-out (95 items).
- **The new wording is adopted** (as `i18n@0.2.0`, question hash changed, recipe and measurements updated) only if, on the new hold-out, it has **no wrong `no`**, **no more wrong `yes` than the old wording**, and **more correct `no`** than the old wording, **and** on the synthetic hold-out it keeps the registered bar (0 wrong `yes`, 0 wrong `no`). Otherwise the old wording stays and the result is reported.
- Reported either way: both wordings' verdict mix, coverage, wrong answers with exact intervals, per framework and per origin; the old wording's numbers on this sample are a second real-code measurement of the shipped pack. Also the count of items that are a mustache holding a translation call (expected 0 with the fixed `extract`).

## Order of commits

This registration; the content filter result and the chosen repositories; the split; the dev items and both dev label files; candidate wordings with their dev scores; the frozen wording; the hold-out label files; the hold-out cases; the recordings and the result.

## Limits, stated now

The rewording is fitted to the first hold-out's failure and to this sample's dev half; labels by two sessions of one model family; one model version; a dozen repositories at most, chosen from GitHub code search; per-framework numbers are small and are given as counts.

## Setup and dev result, 2026-10-06 (before any hold-out request)

- **Repositories** (content filter, `docs/data/i18n-real-2/content-filter.json`): React `TO-Bus/to-bus-ca`, `caudal-labs/caudalflow`, `EmmaStoneX/NetPulse`, `wzdavid/openclaw-desktop`; Vue `WTWB-none/void`, `taovc/pr-cockpit`, `pa001024/riven-mirror`, `omvjro/DOL-pancake`; HTML `joeartsea/node-red-contrib-ftp`, the only one of seven looked at under the lower floor that has an English JSON locale and 20 keys. Split (`split.json`): dev `caudalflow`, `NetPulse`, `void`, `riven-mirror`, `node-red-contrib-ftp`; hold-out `to-bus-ca`, `openclaw-desktop`, `pr-cockpit`, `DOL-pancake`. So **the hold-out has no HTML repository**.
- **HTML**: `extract` found none of the 41 removed `data-i18n` keys, because Node-RED keeps its editor HTML inside `<script type="text/x-red">` templates and `extract` does not read text inside `<script>`. The HTML repository adds 2 O items to dev and nothing else.
- **Dev labels**: 122 items (40 Y, 82 O), two fresh blind subagents, agreement 121 of 122 (kappa 0.97); scored 121, **99 `yes` and 22 `no`** (`dev/`). Most O items in these repositories are untranslated UI strings (59 of 82 labelled `yes` by one labeller), so dev has few technical items.
- **Wordings**: five drafts were written; `i18n-w3` was dropped before any request because `lint-pack` flags its question as compound. Four candidates and the old wording were recorded on the 121 new dev items and the 40 synthetic dev items (`dev-recordings/`).

| Wording | New dev: wrong `yes` / wrong `no` | correct `no` of 22 | definite of 121 | median answer on `no` items | Synthetic dev: wrong / correct `no` of 20 / definite of 40 |
|---|---|---|---|---|---|
| `i18n@0.1.0` (old) | 0 / 0 | 3 | 26 | 0.54 | 0 / 13 / 26 |
| `i18n-w1` | 0 / 0 | 3 | 24 | 0.435 | 0 / 13 / 26 |
| `i18n-w2` | 0 / 0 | 1 | 36 | 0.375 | 0 / 7 / 20 |
| `i18n-w4` | 0 / 0 | 0 | 34 | 0.335 | 0 / 8 / 21 |
| `i18n-w5` | 0 / 0 | 1 | 22 | 0.39 | 0 / 12 / 24 |

- **Choice by the registered rule: `i18n-w1`** (every candidate qualifies; `i18n-w1` has the most correct `no`). It ties the old wording on correct `no` (3 and 3) and has two fewer definite answers, so on dev no candidate improves the `no` band: the rewordings lower the answers on technical strings but not to 0.10 or below. The hold-out runs as registered and decides.
- **Frozen**: `docs/data/i18n-real-2/wordings/i18n-w1`, SHA-256 of `questions/judge.json` `ca6b886f3cdaecbd921da34361693c6499f4071c2b973ef6af4b8b86dc937b7c`, of `thresholds.json` `cc7711cff39fcabed9480f0e5bf0e8e703287180b65cbec2ecc9d0efbf45fef8` (identical to the shipped pack's).
