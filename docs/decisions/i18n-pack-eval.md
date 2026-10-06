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

## Public-repo hold-out (planned first, then run on 2026-10-06)

Pick several public repositories that use React, Vue and plain HTML and that already keep strings in a translation file, chosen before looking at results. Strip the translation calls from a copy, run `extract`, and treat the original `t("...")` sites as the labelled `yes` set; label a random sample of the remaining candidates by hand with two labellers. Report extractor recall against the removed calls, and judge accuracy on the sample. Run on 2026-10-06 with the protocol below.

### Amendment, 2026-10-06: protocol of the public-repo hold-out, fixed before any repository is downloaded

The plan above names the idea; this fixes the details. The commit that adds this section is the registration. Done before it: three GitHub search probes to see that the queries return applications (lists of repository names only; nothing cloned, extracted or sent to Jev), checking that the frozen pack files still have the hashes above (they do), and running `extract` on a hand-written fixture to see how it emits the three placeholder forms below (it keeps `{name}`, `{{ name }}` and `${name}` in the candidate text as written).

#### What is measured

1. **Extractor recall on real code**: of the translation calls removed from a copy (below), the share that `extract` lists as a candidate.
2. **Judge errors on real candidates**: the same question, bands and model as the synthetic hold-out (`i18n@0.1.0`, `string.translatable`, the two SHA-256 hashes above, `jev-1.13.0`), on a sample of the candidates `extract` lists.

#### Repositories (rule fixed now)

- **Three frameworks, two repositories each**: React with an i18next-style `t("key")`, Vue with vue-i18n (`$t("key")`, `t("key")`), plain HTML with `data-i18n="key"` attributes.
- **Search lists**: `gh search code "useTranslation" --extension tsx`, `gh search code '$t(' --extension vue`, `gh search code "data-i18n" --extension html`; up to 300 results each, repositories in first-seen order. The raw lists are committed with their fetch time.
- **Metadata filter**: not a fork, not archived, licence MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC or 0BSD (so short strings can be committed with attribution), at least 25 stars, pushed since 2023-10-06.
- **Content filter**, on a shallow clone of the default branch (commit SHA recorded): an English locale in JSON (`en.json`, `en-US.json`, `en_US.json` or `en/*.json`, a folder merged by file name as namespace) and at least 40 removable calls in files `extract` reads.
- The first two repositories in list order that pass both filters are taken; later ones are not looked at. If fewer than two pass among a list's results, fewer are used and that is reported.

#### Removing the translation calls (in a copy)

A call is replaced only when its first argument is a single string literal that resolves to a string in the English locale and the call sits on one line; the line count of every file stays the same.

Key resolution, in this order: an explicit `ns:key`; else the namespace named by `useTranslation(...)` (or `useI18n`/`withTranslation`) in the same file, with its `keyPrefix`; else the default namespace (`translation`, or the only file when the locale is a single file); else every namespace, accepted only when exactly one resolves. Nested keys resolve by dots. Function names: `t`, `i18n.t`, `i18next.t` (React); `$t`, `t`, `this.$t`, `i18n.global.t` (Vue). Replacement by position, so the copy reads like code written without i18n:

- JSX child `{t("k")}` becomes the value as JSX text; an i18next placeholder `{{name}}` becomes `{name}`.
- JSX attribute `attr={t("k")}` becomes `attr="value"`.
- Vue template `{{ $t("k") }}` becomes the value as text, a placeholder `{name}` becomes `{{ name }}`; a bound attribute `:attr="$t('k')"` becomes `attr="value"`; any other call inside a binding becomes a string literal in place.
- Any other expression position becomes a string literal; with placeholders, a template literal with `${name}`.
- HTML: an element whose `data-i18n` is a plain key and whose content has no child element gets the value as its content and loses the attribute; `[attr]key` sets that attribute instead.

Skipped, counted by reason: dynamic key, key not in the English locale (including plural-only keys), a key that resolves in more than one namespace, multi-line call, a value containing a newline, a value that cannot be written at that position (a quote in an attribute, `<` or braces in text after the placeholder rule), `<Trans>` and similar components. Every replaced site is recorded: repository, file, line, position type, value.

#### Recall

`extract` runs on the copy with `--keep-duplicates`, default file rules (tests excluded). A replaced site in a file `extract` reads counts as **found** when a candidate on the same file and line has a text that, with every `{...}`, `{{...}}` and `${...}` token removed and whitespace collapsed, contains the site's value treated the same way, and that value is not empty after the removal (a site whose value is only a placeholder is skipped). Reported per repository, per position type and pooled, as k of n with an exact two-sided 95% Clopper-Pearson interval. Sites in files `extract` does not read are counted separately and are not in n.

#### Judge sample

Per repository, seeded by `sha256("i18n-real-v1:" + id)` ascending: up to 25 candidates that matched a replaced site (**origin Y**) and up to 25 that did not (**origin O**). At most 300 items, one Jev request each. Items are exactly what `extract` emits (text and context), with paths relative to the repository root.

#### Labels

- **Origin Y** items are `yes` by construction: the maintainers put the string in a translation file. A locale file can also hold strings the pack's criteria call technical (a date or number format, a locale code, a unit symbol), so: a Y item that both blind labellers call `no` is dropped from scoring and listed by id; a Y item with one `no` stays `yes` and is reported.
- **Origin O** items are labelled by two blind labeller subagents, each in its own session: all sampled items (Y and O mixed), shuffled under random keys, only `text` and `context`, the pack's question and criteria as the rubric, a label and a short reason per item, told to read no other file. The key-to-id map stays outside their reach. Before the file is handed over, a script checks for leakage: only the three fields, no id order, and the share of placeholder shapes (`{{`, `${`), of contexts that still show a translation call (`t(`, `$t(`, `data-i18n`) and of each `kind` in Y against O is reported. 300 items for each of two labellers is about twice the labelling of the synthetic suite (135 items, one second labeller).
- An O item's scored label is the label both labellers give; disagreements are dropped from scoring and listed by id. The labellers' answers on Y items are reported as agreement with the construction label and change nothing.
- The labellers are model sessions, not people, and one model family.

#### Order of commits

This amendment; then the raw search lists and the metadata filter's result, before anything is cloned; then the content filter's table and `repos.json`; then the strip, sample and score scripts with unit tests of their pure functions; then both blind label files; then `cases.jsonl` and `suite.json`; then `recorded.jsonl`, in the same commit as the allowance in `suite.json` if the bar fails. Commit times and receipt times give the order.

#### Recording

A new suite `jev-evals/judge-i18n-real` (all items in `holdout`; fields id, expected, repo, framework, origin, kind, text, context), committed before recording. Recorded once with `eval record` (no `--fresh`, no dev split, nothing reworded). The two pack hashes are checked again just before the first request.

#### Bar and what is said afterwards

- **Bar, the same as the synthetic hold-out**: 0 wrong `yes` among scored `no` items and 0 wrong `no` among scored `yes` items.
- If it holds, the recipe may say that on N real candidates from the named repositories the bands made no wrong call, with the rule-of-three bound. If it fails, the recipe gives the counts with exact intervals and the wrong items are listed; the question is not tuned on these items, and `suite.json` takes the observed counts as its allowance (a regression tripwire, as in the done-v2 hold-outs).
- Reported, not part of the bar: coverage (definite verdicts), recall of `yes`, per framework, per origin, per `kind`, per repository.

#### Limits, stated now

- Origin Y is easier to label than to judge: a string a maintainer chose to translate is UI text, but the copy shows it where the call was, so it is real code made to look un-translated, not code that never had i18n.
- O items in a repository that already translates are mostly technical; real code without i18n may have more UI strings among them.
- Six repositories, two per framework: per-framework numbers are small and are reported as counts, not rates.

#### Note, 2026-10-06, after the content filter and the recall count, before any label or Jev answer

- **Repositories.** The content filter took `hamster1963/nezha-dash-v2` and `Hccake/skill-deck` (React), `Hanziness/FocusTide` and `openbmc/webui-vue` (Vue); it passed over `JDArmy/RTASS` (11 removable calls) and `alfg/opendrinks` (no English JSON locale). The only HTML repository that passed the metadata filter, `babutree/TTS-API`, has no English JSON locale, so **there is no HTML repository**, as the rule allows. Four repositories, not six. Every stripped script file still parses with esbuild where the clone did (Vue templates were checked by eye only).
- **A defect in the registered found rule.** `extract` reports a text run at the line where the run starts; a removed call inside a run that spans several lines sits on a later line, so "same file and line" misses it, and the candidate (which holds the removed string) lands among origin O. Found after the registered recall was computed, by reading one O item. Registered rule: **1,725 of 2,463** removed calls found (0.700, exact 95% 0.682 to 0.718). An **amended rule, post hoc**: same file; candidate line from the site's line minus 20 up to the site's line; the registered containment rule; the candidate does not appear with the same file, line and text in an extraction of the unmodified clone; the nearest such candidate. The window of 20 was chosen after seeing gaps of 1 to 13 lines. Amended: **1,758 of 2,463** (0.714). Both are reported per repository and per position; the registered one is the registered number.
- **The sample is not redrawn.** Origins stay as drawn by the registered rule (95 Y, 73 O: FocusTide has 25 candidates in all, skill-deck 18 outside the Y pool). Each item carries `contains_removed_value` by the amended rule; 11 of the 73 O items hold a removed string. They keep origin O and get the blind labels, and per-origin numbers are given with and without them. The flag is not in the blind files.
- **Deviations from the order above.** `sample.mjs` ran once before it was committed, so the registered recall was seen before the script commit; the seeded sample is identical across both runs. The first recall intervals were wrong: the exact interval in `scripts/real-ci/lib.mjs` underflowed for large n (`(1 - p)^n` in plain floating point). Fixed in a181f8f by working in logs; every published scoring output of that file was re-run before and after and differs by at most 2.4e-14.
- **Leakage check** (`leakage.json`, before labelling): the blind files hold only key, text and context; no context shows a translation call. Y and O differ in shape, as real code does: text with a placeholder or template expression in 2% of Y and 30% of O, any brace in 11% and 47%; kinds are listed. Labellers see neither origin nor the flag.
- Reported only: among registered matches, the candidate text equals the value (after normalisation) except in 25 of 556 JSX text and 126 of 483 Vue text matches, where the value sits inside a longer run.

#### Labels, 2026-10-06, before the hold-out is recorded

Two fresh `general-purpose` subagents, each given only its own blind file in an empty directory, labelled all 168 items (identical prompt: the pack's question and both criteria verbatim, plus one sentence not in the pack, that text inside `{...}`, `{{ ... }}` or `${...}` is filled in at run time and the words around it are judged). By script (`agreement.json`): agreement 155 of 168, Cohen's kappa 0.80; on origin O 62 of 73, kappa 0.69; on the 11 flagged O items 11 of 11. Labeller 1 said `yes` to all 95 Y items, labeller 2 to 93; no Y item got two `no`, so none is dropped; the two with one `no` are listed in `agreement.json`. Low confidence was marked on 41 and 40 items. The 11 O disagreements are dropped (`dropped.json`). Scored: **157 items, 120 `yes` and 37 `no`**. Both labellers are sessions of one model family; no person labelled.

#### Result, 2026-10-06: the bar failed

Recorded once (`eval record --suite judge-i18n-real --split holdout`, 157 requests, receipt `rmuwld601rdvc`, `jev-1.13.0`, question hash `2c1c03232c15`, both pack hashes as registered, no `--fresh`) after the cases commit 0ada90a was pushed. Scored by `scripts/i18n-real/score.mjs` (`docs/data/i18n-real/score.json`); `eval score` gives the same totals.

- **Bar: failed.** 5 wrong `yes` among 37 `no` items (exact one-sided 95% upper bound 0.26), 0 wrong `no` among 120 `yes` items (upper bound 0.025).
- **All five wrong `yes` are one shape**: a Vue text node that is only a mustache holding a translation call spread over several lines, such as `{{ $t('global.form.dateMustBeAfter', { date: fromDate, }) }}`, in `openbmc/webui-vue`. The strip step skipped those calls (multi-line) and `extract` listed them, although its recipe says a mustache other than a string literal is not a candidate and a wrapped string is left out: an extractor defect. Both labellers said `no` (already translated); Jev gave 0.91 to 0.92. Ten sampled items have this shape, all `no`, Jev 0.74 to 0.92. The labels are not changed and nothing is tuned on these items. *Corrected the same day, after reproducing it on a fixture:* the cause is braces inside the mustache's expression, not the line count; a one-line `{{ $t('e', { x: 1 }) }}` was listed too. Fixed in e08ace1. Replayed on the four copies, the fixed `extract` no longer lists exactly these ten sampled items plus two mustaches without a translation call (one scored `no`, Jev 0.84; one dropped for disagreement). That replay is fitted to this finding and is not a new test.
- **Coverage 0.204** (32 of 157 definite, exact 95% 0.144 to 0.275), against 0.56 on the invented hold-out. Verdicts: 32 `yes`, 125 `review`, **0 `no`**. `yes` found 27 of 120; precision of `yes` 27 of 32. Lowest answer on a `yes` item 0.33, highest on a `no` item 0.92; on the 27 `no` items without a translation call the highest is 0.89 and the median of all 37 is 0.77 (`yes` items: 0.845).
- Not registered, descriptive only: the rank separation (AUC) of Jev's answer between `yes` and `no` items is 0.60, and 0.71 without the ten items that hold a translation call.
- By origin: Y 22 of 95 `yes`, no wrong verdict; O 62 scored (25 `yes`, 37 `no`), 5 `yes` found, 0 `no` found, the 5 wrong `yes`. Without the 11 flagged O items (all 11 scored): the same 5 wrong `yes`, 0 wrong `no`, coverage 0.205. By framework: React 0 wrong of 86, coverage 0.15; Vue 5 wrong `yes` of 71, coverage 0.27. Per repository and per `kind` in `score.json`.
- `suite.json` takes 5 as `max_wrong_positive` (a tripwire, as in the done-v2 hold-outs); `max_wrong_negative` stays 0.

What it means: on candidates from four real repositories the bands still made no wrong `no` and no wrong `yes` on strings that are not already translated, but they decided only one item in five, and Jev never answered `no`: on real code it rates technical strings much higher than on the invented items (median 0.77, against 0.845 for UI strings). Technical-string rejection, the reason a `no` band exists, did not happen here. The extractor defect behind the five wrong `yes` is a separate fix, and any claim after it needs a new sample.

## Status

Recorded on 2026-10-06, `jev-1.13.0`, one request per case. (The build session could not run `eval record`: its sandbox refused every command containing the word eval.) Dev first (receipt `rmuwd71k1p62l`), then the amendment above was committed (8fe449d), then the hold-out once with `eval record --suite judge-i18n --split holdout` (95 requests, receipt `rmuwdlnekxqiv`, no `--fresh`). Order, checkable in the repository: dev `recorded_at` 2026-10-06T07:36:03Z, amendment commit 8fe449d at 07:47:08Z, first hold-out `recorded_at` 07:47:28Z. Nothing was reworded or relabelled.

**Hold-out: the bar passed.** 0 wrong `yes` among 46 `no` items and 0 wrong `no` among 49 `yes` items; verdicts 27 `yes`, 42 `review`, 26 `no`; recall 27 of 49, `no` found 26 of 46, a definite verdict on 53 of 95. The agreed-only subset is the whole hold-out (see the second-label result above), so its numbers are the same. Dev: 0 and 0; 12 `yes`, 15 `review`, 13 `no` of 40.

Reported, not part of the bar (hold-out): React 12 of 19 `yes` items found, 0 of 6 `no` items found; Vue 5 of 8 and 0 of 1; HTML 4 of 9 and 1 of 4; plain JS 1 of 5 and 3 of 3; TypeScript 5 of 8 and 22 of 32. Near-misses: 7 of 9 `yes` and 16 of 25 `no` found; the rest: 20 of 40 and 10 of 21. No answer came near the wrong band: the lowest on a `yes` item was 0.31 (the `no` band ends at 0.10) and the highest on a `no` item 0.51 (the `yes` band starts at 0.90); `review` answers ranged from 0.12 to 0.89. Counts come from a script over `recorded.jsonl` that reproduces the `eval score` totals.

What it means: on these invented items the 0.9 bands made no wrong call, and with 46 and 49 items that bounds each error rate to about 6% (rule of three); the cost is coverage, since 42 of 95 items land in `review`. It says nothing about real repositories, both labellers are one model family and one of them wrote the cases, and only one model version was asked. The public-repo hold-out above was run later the same day and failed its bar (see its result).
