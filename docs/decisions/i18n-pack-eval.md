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
