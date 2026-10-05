# done v2: a second real-log sample, scored on frozen code

Registered 2026-10-05 before any run or job log of this sample is fetched, labelled, parsed or sent to Jev; the commit that first contains this file is the registration. Done before it: reading the first study's documents and scripts, freezing the code (below), and one `gh search repos` call with five results printed (Dart, to see that the `pushed:` qualifier works). No run list, job or log of the new sample was requested.

## Why

All rule and parser work so far used the dev half of the [first sample](done-v2-real-logs.md), and its hold-out half was looked at and scored three times ([measurements-real-logs.md](../measurements-real-logs.md)). The [split bar](done-bar-split.md) said a pass needs a fresh sample, scored once, on code written before it existed. This is that sample. It is also a test of the code that exists: whatever it shows, nothing is fixed in the same task. `done` v2 stays "not measured" on the old bar whatever this produces.

## Frozen code

- Commit `6ff4d0aaa61f4b90dffcb4c71f150da93495a319` (tag `v0.2.1`, the 0.2.1 release).
- A scratch checkout was made with `git archive v0.2.1` (no later commit can leak in), `npm ci` was run, and `npm run build` there produced a `plugins/` tree identical to the committed one (`diff -rq`: no difference).
- Every step that imports `src/` (`prepare`, `assemble`, `analyze`, the redaction screen, the code-level check) and `eval record` run from that checkout, with the plugin CLI of that checkout. Nothing inside it is edited. New scripts of this study (fetch parameters, labeller share, scoring with the bootstrap) are copied into it as files that do not touch `src/`; `scripts/real-ci/lib.mjs` of the working tree is diffed against the frozen one and the diff is recorded (it must be empty).
- **Nothing is changed after scoring.** No parser, cap, question text, rule, classifier, labelling convention or script that decides a label or a verdict is edited after the first Jev answer is recorded for this sample. One recording, no `--fresh`, no re-record, no re-label. Cases dropped are listed with the reason; none is dropped or relabelled after Jev's answers are seen.

## Sampling frame (different from the first sample)

- **Repositories.** Excluded: the 94 repositories of `docs/data/done-v2-real/split.json` and `BurntSushi/ripgrep`. Limit, stated now: the first fetch also accepted 4 repositories that later lost every case; they are not in committed data, so they are not excluded and may reappear. Runs are different anyway (below).
- **Candidate query, per bucket:** `gh search repos --language L 'pushed:>2026-10-03' --sort stars --archived=false --limit 100`, taken in order, skipping the excluded and forks, repositories with no completed run in the window, and repositories that yield no case. Up to 8 accepted per bucket for the 13 buckets of the first study (JavaScript, TypeScript, Python, Go, Rust, Java, Ruby, PHP, C#, C++, C, Swift, Kotlin), up to 6 for four added buckets (Dart, Elixir, Scala, Shell). The first sample had no case of those four. The reason to add them: the unchanged classifier already names `dart test`, `flutter test`, `mix test`, `sbt compile` and `shellcheck`, and none of them has a parser, so they extend the measured tail rather than the parsed head. Target: at least 100 distinct repositories if the gh rate limit allows; fewer is reported as a deviation, not a reason to change a rule.
- **Runs:** created at or after 2026-10-04T00:00:00Z (`gh run list --created ">=2026-10-04"`), after the day the first sample's window ended (2026-10-02 fetch, runs of the 80 days before), so none of its runs can appear. Per repository a `--status failure` list (limit 30) and a `--status success` list (limit 30); each is ordered by `sha256(run id)`; runs are inspected alternating failed and succeeded, starting with failed, at most 6 runs and 6 jobs per run (jobs ordered by `sha256(job id)`).
- **Cases per repository: at most 3, at most 2 from failed steps.** A (workflow, step name) pair gives one case per repository. This is the cap that stops one repository from dominating (the first sample allowed 5).
- **Step purposes, classifier, step split, evidence text, redaction:** unchanged from the first registration (`scripts/real-ci/lib.mjs`, same bytes). Skipped, cancelled and `uses:` steps excluded; jobs with a segment mismatch dropped and counted.
- **Failed share.** Target at least 25% of kept cases from failed steps (first sample 13.1%), pursued by the failed-first run order and the dedicated failure list above. If it is lower the number is reported; no further pass is added.
- **Recorded:** gh version, the exact query strings, the repository lists per bucket with SPDX licence and star count, and the dropped counters, in `docs/data/done-v2-real-2/`.

## Unit, labels, labellers

- Unit: one case = one test, lint or build step of one real GitHub Actions job. A step that failed (conclusion `failure` or a non-zero `Process completed with exit code`) is expected `missing` and decided in code (Jev is not asked); a succeeded step is expected `met` only if the evidence shows that the checks actually ran and each passed (not zero tests, not all skipped, not a silent no-op), else `missing`, by the convention of the first registration, applied word for word by `scripts/real-ci/label.mjs`.
- Labeller 1 (a `claude -p` process, no tools, no repository access, shown only criterion and evidence as `done` would pass it) labels every succeeded-step case. **Labeller 2, a second blind process, labels a random 40%** (lowest `sha256(id + "label2")`; the first study used 30%). Any disagreement is dropped and counted; `ambiguous` by either is dropped and counted; raw agreement and Cohen's kappa are reported. The code rule of the first study is kept: a `met` label on output that is only the command echo plus the exit line is treated as `ambiguous` and dropped (`silentOutput`). Nothing is dropped or relabelled after Jev's answers are seen. Labelling finishes before the first Jev request. The labelling cost (tokens or USD reported by the `claude` CLI) is recorded.
- The labellers are language models of the same family as the author; agreement measures consistency, not correctness. No human labels.

## Evidence classes and the bars (reused from the split bar, fixed now)

Class by the repository's own code on the clipped text Jev would see (`parseEvidence(doneEvidence(evidence)).trust`): **R** `parsed`, **E** `exit_code`, **U** `unparsed`. The exit line is always appended in this study, so U is empty by construction; the row is printed and must read 0. Code-decided cases (non-zero exit code) are counted apart and are in no denominator below.

1. **Wrong `met` = 0 in every class (R, E, U) and pooled**, over expected-`missing` sent cases. Report n and the exact one-sided 95% upper bound (Clopper-Pearson, `1 - 0.05^(1/n)` for 0 of n). Any wrong `met` in any class fails the bar.
2. **`met` recall among R >= 0.9, evaluated only if at least 30 sent R cases are expected `met`**; with fewer, "not evaluable (n = k)" with point value and exact interval and no verdict.
3. **E:** report `met` recall and wrong `met`; no recall bar. **U:** none expected. **Parsed coverage** (share of sent cases in R; also by criterion and by language) is reported, no bar.
4. **`missing` recall** over all sent cases (expected `missing` with verdict `missing`; `unsure` is not a hit) is reported with point value and interval. The split bar states a 0.9 threshold for it; that threshold is carried here and a verdict line is printed against it, as the stricter reading.
5. **Intervals.** Every ratio gets the exact two-sided 95% Clopper-Pearson interval over cases, and in addition a repository-clustered one: a **repository-level bootstrap** (B = 2000, resampling repositories with replacement among those that have at least one case in the denominator, percentile 2.5 and 97.5, deterministic PRNG seeded from `sha256("done-v2-real-2-boot")`). For wrong `met` the bootstrap interval is degenerate at 0 events, so in addition a **repository-clustered exact bound**: the unit is the repository, a repository counts as wrong if any of its expected-`missing` sent cases got `met`, and the Clopper-Pearson one-sided bound is taken over repositories with at least one such case. Clustering by evidence text as in the split bar (rule 5) is checked by counting duplicate evidence hashes; in the first sample it was a no-op.
6. Also reported, no bars: verdict mix by class, `met` recall of E, the offline "met reachable if Jev answered p = 1" numbers, the registered code-level check of the first study (every succeeded case whose native text has no recognised runner and no exit line, fed to `doneRequest` with p = 1.0, must give `unsure`; any other result is a defect), and the first-sample numbers side by side (dev, hold-out and all, taken from the published tables; they are descriptive and carry the fitting caveats of the earlier documents).

## What would count as a negative result

A result is **negative** (the code fails on unseen data) if any one of: a wrong `met` in any class; `met` recall among R below 0.9 with at least 30 evaluable cases; `missing` recall below 0.9. It is **not evaluable** for a bar whose registered minimum n is not reached, and that is said, not hidden. A pass of every evaluable bar on this one sample would still say nothing about tools absent from it, and would not move `done` v2 off "not measured" on the old bar. The wrong-`met` cases, if any, are analysed (what the log shows, why the code missed it) and not fixed in this task; the tools without a parser in this sample are listed as backlog.

## Scoring

Parser coverage and the code-level check are computed offline first. The local suite `done-v2-real-2` (`split: "holdout"`, criterion per case, outside the repository, text included) is recorded once with `eval record` using the key from the keychain (never printed) and scored with the scripts; if a wrong `met` occurs, the local suite's `max_wrong_positive` is set to the observed count by the earlier convention and the result is reported as a failure of bar 1. No suite file with text is added to `jev-evals/`, so no repository gate moves.

## What is committed

The decision of the first registration is reused, not re-asked: **no log text is committed, for any repository** (Jev `decide`, 0.54 / 0.44 / 0.01 then 0.64 / 0.34 / 0.01, receipts `rmuqaymlia1f7` and `rmuqayxupkfma`, under the 0.90 bar, so the conservative option). The repository holds per case: repository, run and job identifiers, step number, SHA-256 of the evidence, labels, parsed facts and the recorded Jev answer. The suite is not rerunnable from the repository; the numbers are rerunnable from the table by the scoring script. This is said in the result.

## Limits, stated now

- Public GitHub Actions only, popular and recently pushed repositories, plain `run:` steps; the step-mapping rule drops composite and grouped jobs. A two-day run window is short; it favours repositories with many runs.
- Same classifier, same labelling model family, one Jev model version, one recording, no human labels.
- A bar that is met on n of a few dozen negatives is weak evidence; the bounds are reported, not assumed.
- Failed steps are decided in code and prove nothing about reading; they raise the failed share, not the test of Jev.
