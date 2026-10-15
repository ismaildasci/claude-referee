# done: a third real-log sample, scored once on frozen code and on two models

Registered 2026-10-15, before any run or job log of this sample is requested, labelled, parsed or sent to Jev; the commit that first contains this file is the registration. Done before it: reading the first two registrations and their scripts, and checking that `gh` and the `claude` CLI are logged in. No run list, job or log of this sample was requested.

## Why

The maintainer asked for results that can be stated without a caveat ("harika sonuçlar", no more "2 of 76"). Both earlier samples carry one: the [first](done-v2-real-logs.md) was used to write parsers, and the [second](done-v2-real-logs-2.md) was scored on the 0.2.1 code (wrong `met` 2 of 85) and then fed the fixes that followed, so the current code has been fitted to both. A fresh sample scored once is the only way to say how the current code reads logs it has not seen. It also scores the two Jev models side by side, because 1.14 has been the maintainer's local model since 2026-10-15 and the earlier comparison ([jev-1-14.md](jev-1-14.md)) used fitted suites. The maintainer approved the cost on 2026-10-15 ("Evet devam et"): the labelling runs on the Claude quota, about 18 USD in the second sample.

## Frozen code

- Commit `a8f3b83` of `main` (full hash recorded at the first commit of the results). It contains everything fixed after the second sample: the parsers and caps of 0.2.2 to 0.2.8, the PHP agent-format runners, `claimsTests`, the silent-run readings.
- A scratch checkout is made with `git archive a8f3b83` (no later commit can leak in), `npm ci` is run, and `npm run build` there must produce a `plugins/` tree identical to the committed one (`diff -rq`, recorded). Every step that imports `src/` (`prepare`, `assemble`, `analyze`, the redaction screen, the code-level check) and `eval record` run from that checkout, with its plugin CLI. Nothing inside it is edited. The scripts of this study are copies of the second study's with only the constants below changed; the diff against the working tree's `scripts/real-ci/lib.mjs` is recorded and must be empty.
- **Nothing is changed after scoring.** No parser, cap, question text, rule, classifier, labelling convention or script that decides a label or a verdict is edited after the first Jev answer of this sample is recorded. One recording per model, no `--fresh`, no re-record, no re-label. Cases dropped are listed with the reason; none is dropped or relabelled after Jev's answers are seen.

## Sampling frame (differences from the second sample)

- **Repositories.** Excluded: the 94 repositories of `docs/data/done-v2-real/split.json`, the 126 of `docs/data/done-v2-real-2/split.json` (repositories that lost every case in an earlier fetch are in neither list and may reappear; their runs differ) and `BurntSushi/ripgrep`.
- **Candidate query, per bucket:** `gh search repos --language L 'pushed:>2026-10-09' --sort stars --archived=false --limit 100`, in order, skipping excluded repositories and forks, repositories with no completed run in the window and repositories that yield no case. Up to 8 accepted per bucket for JavaScript, TypeScript, Python, Go, Rust, Java, Ruby, PHP, C#, C++, C, Swift, Kotlin, up to 6 for Dart, Elixir, Scala, Shell (the second sample's 17 buckets).
- **Runs:** created at or after 2026-10-10T00:00:00Z, after the second sample's fetch (2026-10-05), so none of its runs can appear. Per repository a `--status failure` list (limit 30) and a `--status success` list (limit 30), each ordered by `sha256(run id)`, inspected alternating failed and succeeded starting with failed, at most 6 runs and 6 jobs per run (jobs ordered by `sha256(job id)`).
- **Cases per repository:** at most 3, at most 2 from failed steps; the failed-only top-up pass of the second sample's Amendment 1 is part of the plan from the start (repositories with fewer than 2 failed cases, at most 6 more failure runs, failed jobs only, up to 5 cases in all, never a succeeded case). The failed share is reported as it falls; there is no further pass.
- Classifier, step purposes, step split, evidence text and redaction are unchanged (same bytes of `scripts/real-ci/lib.mjs`). The gh version, the exact queries, the repository lists with licence and stars and the dropped counters are recorded under `docs/data/done-v2-real-3/`.

## Labels, bars, scoring

Unchanged from the second registration, word for word: the unit and the labelling convention (`scripts/real-ci/label.mjs`), labeller 1 on every succeeded case and a blind labeller 2 on a random 40% (lowest `sha256(id + "label2")`), disagreements and `ambiguous` dropped and counted, the silent-output rule, agreement and kappa reported; evidence classes R, E, U; the four bars (wrong `met` = 0 in every class and pooled; `met` recall among R at least 0.9 if at least 30 sent R cases are expected `met`; E and coverage reported; `missing` recall against 0.9 as the stricter reading); exact and repository-bootstrap intervals (B = 2000, seed `sha256("done-v2-real-3-boot")`); the registered code-level check (every succeeded case with no recognised runner and no exit line, fed with p = 1.0, must give `unsure`).

**Two models, one recording each.** The labelled cases are sent once with `jev-1.13.0` (the package default and the primary result) and once with `jev-1.14.0`; each is scored on every bar separately and the two tables are printed side by side. Two models are two measurements, not a re-record of one. No model is chosen after seeing results; a difference is reported as a difference.

**Negative result:** as before (a wrong `met` in any class; `met` recall among R below 0.9 with at least 30 evaluable cases; `missing` recall below 0.9), per model. The wrong-`met` cases are analysed (what the log shows, why the code missed it) and not fixed in this task; tools without a parser are listed as backlog. A pass on this sample says nothing about tools absent from it and would not by itself move `done` off "not measured" on the old bar.

## What is committed

As before: **no log text for any repository** (the first registration's `decide`, receipts `rmuqaymlia1f7` and `rmuqayxupkfma`). The repository holds per case: repository, run and job identifiers, step number, SHA-256 of the evidence, labels, parsed facts and the recorded Jev answers of both models, the tables and this record. The suites with text stay local.

## Limits, stated now

- Public GitHub Actions, popular and recently pushed repositories, plain `run:` steps; composite and grouped jobs are dropped. A five-day run window is short and favours repositories with many runs.
- The labellers are language models of the same family as the author; agreement measures consistency, not correctness. No human labels.
- A bar met on a few dozen negatives is weak evidence; bounds are reported, not assumed.
- Failed steps are decided in code and prove nothing about reading.

## Amendment 1: fetch tool fault (2026-10-15, before any case was labelled or any answer from Jev)

- **What happened.** The first walk (three processes by language group, all 100 candidates of every bucket, 1508 repositories) ended with 0 cases. Cause: gh 2.102.0 refuses to print an API response that contains terminal escape sequences unless `--allow-escape-sequences` is passed. Job logs of `run:` steps carry colour codes in the script header, so the fetch script read each refusal as an unavailable log and marked 17,525 of 19,575 job logs gone (`log_expired` in the drop counts). The 2,050 logs that did arrive have no `run:` step (action-only jobs), so no case could come out of them. A direct request of one marked job with the flag returned its log. Why the second sample's fetch did not hit this is not investigated; the gh version of that fetch was not recorded.
- **What was seen before the fix.** Counts only: logs per kind, drop reasons, segments per log, and the step names of the first two logs with several steps (checkout and CodeQL actions) while locating the fault. No case, no evidence text, no label and no Jev answer exists, so the 0-case result says nothing about the logs' content and nothing is selected by it.
- **Fix.** The log request passes `--allow-escape-sequences`; that is the only change to `fetch3.mjs`. The records of the faulty walk (repository records, picks, pass records, gone markers) are moved aside; the saved candidate lists and the 2,050 valid logs stay (same bytes), and the walk restarts from the same lists in the same order. The frozen code, `lib.mjs`, exclusion list, run window start, caps, quotas, labelling, bars and scoring are unchanged.
- **Consequence.** The walk stops at 8 accepted repositories per bucket (6 for the extra ones) as registered; the first walk visited every candidate only because none could be accepted. Runs created after the first walk can now enter the window; the fetch date and run counts are reported with the results.

## Result

Negative on both models; recorded in [measurements-real-logs-sample-3.md](../measurements-real-logs-sample-3.md). No parser, cap, question text, rule or script that decides a label or verdict was changed after the first answer; the wrong `met` cases are analysed there, not fixed.
