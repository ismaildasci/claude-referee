# i18n pack: pre-registered evaluation

Written and committed before any request was recorded for the `judge-i18n` suite. The commit that adds this file is the evidence of the order.

## What is measured

The `i18n` pack's `string.translatable` question: for one candidate string (plus a context line naming file, line and where it sits), is it shown to end users, so that it should be translated? Verdicts use the pack bands: `yes` at 0.90 or more, `no` at 0.10 or less, `review` between.

Only the judge is measured here. The candidate extractor (the `extract` command) is deterministic code with its own unit tests; this evaluation does not say how many UI strings it finds or misses in a real repository.

## Cases

`jev-evals/judge-i18n/cases.jsonl`: 135 invented items in the format `extract` emits, covering React/JSX, Vue, plain HTML and string literals in UI calls, object keys and assignments. Fields: `framework`, `category`, `near_miss`. Near-misses on the `no` side include log and error messages written as sentences, test titles, SQL, shell commands, ids that sit in `aria-label`, `alt` and `title`, header and mime names, feature flags and locale codes; on the `yes` side one-word buttons, strings with placeholders, and `document.title` text.

- dev: 40 items (20 yes, 20 no)
- hold-out: 95 items (49 yes, 46 no)

## Labelling and its limit

One model session wrote and labelled every case. The task asked for a second labeller agent to agree on each label; no way to start one existed in this session, so that step was not done and the labels are single-labeller. A second labeller should relabel the cases blind before the numbers are quoted outside this repository. Labels a second labeller is most likely to dispute: one-word buttons (OK, Edit, Next) are labelled `yes`; `Saved!` and `Inbox (${n})` are labelled `yes`; the `toast.dismiss("all")` argument is labelled `no`.

### Amendment, 2026-10-06, written before the hold-out was recorded

- **Dev recorded** on 2026-10-06 with `eval record --suite judge-i18n --split dev --pack i18n` (40 requests, receipt `rmuwd71k1p62l`): wrong `yes` 0, wrong `no` 0, verdicts 12 `yes`, 15 `review`, 13 `no`, coverage 0.62, recall 0.60. The question was not reworded. (`eval record` ignored `--split` until 41d5209, so dev could not be recorded alone before that fix.)
- **Frozen wording** for the hold-out: pack `i18n@0.1.0`, question `string.translatable`, eval question hash `2c1c03232c15`; SHA-256 of `plugins/claude-referee/packs/i18n/questions/judge.json` `7c78a5706152c164411d1040931e3bcd00858a7b4980a43f057bc75bbe2e38f7` and of `thresholds.json` `cc7711cff39fcabed9480f0e5bf0e8e703287180b65cbec2ecc9d0efbf45fef8`; `lint-pack` clean.
- **Second labeller.** A separate Claude subagent labelled all 135 cases `yes` or `no`, blind: it got only `text` and `context`, the same item and context Jev gets, in a random order under random keys (no case ids, labels, near-miss flags, categories or Jev answers), was told to read no other file, and wrote a short reason per item. The key-to-id map stayed outside its reach. Its labels are in `jev-evals/judge-i18n/labels-second.jsonl`, committed before the hold-out is recorded. It is a second model session, not a second person.
- **Two discarded tries.** The first second-labeller run also got `framework` and `category`; a script then showed that `category` alone gives the label for every case (all 26 categories hold only `yes` or only `no` items). The second run got `id`, `text` and `context`, but the ids are ordered by label inside each split (`i-d01` to `i-d20` and `i-h01` to `i-h49` are the `yes` cases), and that run's labels were exactly those ranges. Both agreed 135 of 135 with the first labels, and neither is independent, so both were thrown away unused. Each try was a fresh subagent that never saw the earlier ones.
- **Second-label result, before the hold-out was recorded** (agreement by script): 135 of 135 agree, dev 40 of 40 and hold-out 95 of 95, Cohen's kappa 1.0; the labeller marked 3 items low confidence (`i-d24` "main-nav" as an `aria-label`, `i-h26` a meta description, `i-h70` the variant name "primary") and still matched the first labels on them. So the agreed-only hold-out is the whole hold-out, and the bar on it equals the registered bar. Two sessions of one model family, one of which wrote the cases, agreeing on everything says the cases are unambiguous to that family; it says nothing about how people would label them, and the cases may be easier than real code.
- **`suite.json` names its pack** (`"pack": "i18n"`, possible since 66b3da7), so `eval score --suite all` scores this suite with the pack it was recorded on. Question, bands and cases are unchanged.
- **How the second labels are used, fixed before they were read:** the original labels stay the scored labels and the bar above is unchanged. Agreement (raw share and Cohen's kappa, computed by a script) is reported per split, disagreements are listed by id, and the bar's two counts are also reported on the hold-out cases where both labellers agree. No label is changed and no case is dropped because of the second labels.

## Procedure

1. The question text and bands are frozen before the hold-out is recorded. Dev answers may be used to reword the question; the final wording and its hash are written down before the hold-out.
2. Dev is recorded first (`eval record`, model `jev-1.13.0`, one request per case), then hold-out once. No re-recording, no `--fresh` on the hold-out.
3. Hold-out cases are not edited, relabelled or dropped after recording. If the bar fails, the result is reported as failed and the question is not tuned on the hold-out; any later change needs a new hold-out.

## Bar (hold-out)

- 0 wrong `yes`: no `no` item gets a `yes` verdict (`wrong_positive` is 0).
- 0 wrong `no`: no `yes` item gets a `no` verdict (`wrong_negative` is 0).
- `suite.json` enforces both (`max_wrong_positive` and `max_wrong_negative` are 0), so `eval score` reports `violated` on a miss.

Reported but not part of the bar: coverage (share of hold-out items with a definite verdict, `automation`), recall (`yes` items that got `yes`), precision, and the same per framework and per near-miss flag.

## What a pass would and would not mean

With 46 `no` items, zero wrong `yes` bounds the true rate to about 6% at 95% confidence (rule of three), and with 49 `yes` items zero wrong `no` bounds it to about 6%, both on invented items from a single writer. It says nothing about real repositories.

## Planned, not done: public-repo hold-out

Pick several public repositories that use React, Vue and plain HTML and that already keep strings in a translation file, chosen before looking at results. Strip the translation calls from a copy, run `extract`, and treat the original `t("...")` sites as the labelled `yes` set; label a random sample of the remaining candidates by hand with two labellers. Report extractor recall against the removed calls, and judge accuracy on the sample. Not started.

## Status

Recorded on 2026-10-06, `jev-1.13.0`, one request per case. (The build session could not run `eval record`: its sandbox refused every command containing the word eval.) Dev first (receipt `rmuwd71k1p62l`), then the amendment above was committed (8fe449d), then the hold-out once with `eval record --suite judge-i18n --split holdout` (95 requests, receipt `rmuwdlnekxqiv`, no `--fresh`). Order, checkable in the repository: dev `recorded_at` 2026-10-06T07:36:03Z, amendment commit 8fe449d at 07:47:08Z, first hold-out `recorded_at` 07:47:28Z. Nothing was reworded or relabelled.

**Hold-out: the bar passed.** 0 wrong `yes` among 46 `no` items and 0 wrong `no` among 49 `yes` items; verdicts 27 `yes`, 42 `review`, 26 `no`; recall 27 of 49, `no` found 26 of 46, a definite verdict on 53 of 95. The agreed-only subset is the whole hold-out (see the second-label result above), so its numbers are the same. Dev: 0 and 0; 12 `yes`, 15 `review`, 13 `no` of 40.

Reported, not part of the bar (hold-out): React 12 of 19 `yes` items found, 0 of 6 `no` items found; Vue 5 of 8 and 0 of 1; HTML 4 of 9 and 1 of 4; plain JS 1 of 5 and 3 of 3; TypeScript 5 of 8 and 22 of 32. Near-misses: 7 of 9 `yes` and 16 of 25 `no` found; the rest: 20 of 40 and 10 of 21. No answer came near the wrong band: the lowest on a `yes` item was 0.31 (the `no` band ends at 0.10) and the highest on a `no` item 0.51 (the `yes` band starts at 0.90); `review` answers ranged from 0.12 to 0.89. Counts come from a script over `recorded.jsonl` that reproduces the `eval score` totals.

What it means: on these invented items the 0.9 bands made no wrong call, and with 46 and 49 items that bounds each error rate to about 6% (rule of three); the cost is coverage, since 42 of 95 items land in `review`. It says nothing about real repositories, both labellers are one model family and one of them wrote the cases, and only one model version was asked. The public-repo hold-out above is still not started.
