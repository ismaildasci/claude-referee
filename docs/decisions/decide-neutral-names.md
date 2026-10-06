# decide: author option names against neutral names (registration)

Written and committed before the new run below and before any comparison of neutral-name answers with the labels. Taken from the maintainer's ordered list on 2026-10-06 (the third candidate of [next-work-2026-10-06.md](next-work-2026-10-06.md)).

## Why

The order study re-asked 183 decisions with neutral names `o1..on` and the leader changed in 22 of them; on its close-call set S1, 14 of 39 against 1 of 39 for a plain re-ask ([measurements](../measurements-decide-order-scale.md#bias-and-confounds)). It could not say in which direction a name pushes. `decide` sends the names the caller writes; string options get `o1..on`, numbered by their position in the caller's list and kept with the option in every order (`src/cli/commands/decide.ts:50`). The study's neutral arm used the same convention (`o_i` is the i-th authored option and travels with it), so it is what `decide` sends for string options.

## Already seen, never computed

Seen: under author names the leader matched the author's label in 16 of 39 `decide-best` cases (two orders plus the balanced orders on ties; [record](decide-eval-metric.md)); the S1 leader changes above. Never computed: the neutral-name leader against the labels. The `decide-best` set was left out of the order study as a duplicate of S1, so its labels and the neutral recordings have not been put side by side.

## Data

- The 39 `decide-best` decisions, which are S1 (`decide-close`) with one best option per case written by the repository author on 2026-10-02 before any answer was recorded. Options in the authored order.
- Four runs of all 24 option orders per decision, `jev-1.13.0`, pack `generic`, through `scripts/decide-scale/run.mjs`: author names `main` and `rep` (both recorded), neutral names `rename` (recorded) and a new fresh neutral run, stage `rename-rep` (`--stage rename-rep`, close only, 936 requests, cache skipped), run after this file is committed.

## Policy and metric

- **Primary policy**: the shipped `adaptive` rule (written and reversed order; on a two-order tie with 3 to 6 options, the balanced `latin_rev` set with the mean-only verdict), replayed from the 24-order recordings exactly as `scripts/decide-scale/adaptive.mjs` does. **Secondary**: the leader of the mean over all 24 orders.
- **Metric**: per decision and run, 1 when the leader equals the label, else 0. Per naming, the mean of its two runs (0, 0.5 or 1 per decision). Paired difference per decision, neutral minus author. Reported: the four raw counts out of 39, the run-averaged counts, the decisions where the difference is not zero by sign, and an exact two-sided sign test on them.
- **Floor**: within each naming, the number of decisions whose label match differs between its two runs.
- **Self-check before the neutral column is read**: the new script must reproduce the author-name `adaptive` leaders of `results-adaptive.json` for S1, and its author-name agreement is compared with the 16 of 39 of `decide-best/recorded.jsonl` (a separate recording, so a small difference is expected and reported). If the leaders do not match, the script is fixed first.

## Decision rule (fixed now)

- **Neutral names agree more** when the run-averaged neutral count exceeds the author count by 4 or more decisions and the sign test gives p of 0.05 or less. Only this outcome is actionable, and the action is a separate registration for a change in what `decide` sends (for example, sending `o1..on` and mapping back), not a change in this task.
- **Author names agree more** under the mirror rule is reported, but it is not evidence that author names give better decisions: the same person chose the names and labelled the best option, so a name can carry the label's cue.
- Otherwise **neither**. With 14 leader changes on S1 the test can only detect a lopsided split, so "neither" is the likely outcome; it is reported as such, not as "names do not matter".

## Limits, stated now

39 decisions, invented close calls in which several options are defensible by construction; labels by one author, who also wrote the options and names; one model version; the four runs share decisions, so they are not 156 independent observations.

## Result, 2026-10-06: neither

Order, checkable in the repository: this file and the `rename-rep` stage 3d9479a (pushed), the fresh neutral run abccb58 (936 requests, 0 cached, `jev-1.13.0`, 0.021 USD, receipts in `receipts-rename-rep.json`), then the analysis, `scripts/decide-scale/naming.mjs` (`jev-evals/decide-scale/results-naming.json`).

**Self-check, run before the neutral column was read.** `results-adaptive.json` does not store leaders per decision, so the check was done against `adaptive.mjs` itself: a throwaway copy printed its S1 leaders, and the new script gave the same leader and the same trigger on 39 of 39 decisions of the `main` run; its first 8 triggered decisions equal the study's `gate2_candidates`. Author names, `main` run: 17 of 39 match the label, against 16 of 39 in the separate `decide-best` recording.

| Policy | `main` | `rep` | `rename` | `rename-rep` | Author (mean) | Neutral (mean) | Neutral better / author better | Sign test p | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| shipped `adaptive` (primary) | 17 | 16 | 17 | 18 | 16.5 | 17.5 | 7 / 6 | 1.0 | neither |
| mean of 24 orders (secondary) | 18 | 18 | 17 | 18 | 18 | 17.5 | 5 / 6 | 1.0 | neither |

- Floor: the two runs of one naming differ in label match on 1 decision (both namings, primary policy).
- The name still moves the leader: under the primary policy the leader differs between `main` and `rename` in 15 of 39 decisions, against 1 between the two author-name runs and 3 between the two neutral runs. Those changes go both ways with respect to the label, so they leave agreement where it was.
- Verdicts: 28 weak and 11 tie (`main`), 32 and 7 (`rep`), 28 and 11 (`rename`), 29 and 10 (`rename-rep`); the balanced orders fired on 14, 14, 12 and 12 decisions.

What it means: on these 39 close calls, option names decide which defensible option leads in about four decisions in ten, but neither naming tracks the author's labelled best option better than the other. Nothing changes in `decide`. The name effect is real and has no measured direction here; a caller who wants no meaning in the names can pass string options, which `decide` names `o1..on`; that removes the cue, not the name effect itself.
