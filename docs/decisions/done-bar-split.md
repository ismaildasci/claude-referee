# done v2: a split success bar by evidence class

Registered 2026-10-02 before any rescoring, split or classification script is run; the commit that first contains this file is the registration. Nothing below was computed yet.

## What this is, and what it is not

**This is a re-definition of the success bar, made after six failed registered checks** ([first](done-v2-holdout2.md) to [sixth](done-v2-holdout6.md) hold-out) and one registered real-log study that has no Jev answers yet ([done-v2-real-logs.md](done-v2-real-logs.md)). It does not replace the old bar. **`done` v2 stays "not measured" on the old bar** (wrong `met` 0, `missing` recall 0.9, `met` found in 60% of expected `met`) whatever this document produces.

**Rescoring old data under the new bar is post hoc.** The six hold-outs and the real-log sample were seen, and in part used to write parsers and caps; their numbers under the new bar are descriptive, labelled "not a pass". A pass of the new bar needs a sample that was split before any parser was written for it (rule 4) and is scored once. Neither this document nor the rescoring record is that.

Why a split: the old bar asks for `met` in 60% of expected-`met` cases of any tool, while `done` never says `met` for output it cannot read (`unparsed`), and the measured lint caps trade recall for wrong `met` on purpose ([exit-code-only-met.md](exit-code-only-met.md), [exit-code-only-lint-wide.md](exit-code-only-lint-wide.md): exit-code-only `met` had 7 wrong of 40; the wide cap lost 3 true `met`). One number for all evidence kinds hides that the kinds behave differently.

## Evidence classes

Assigned by the repository's own code, never by hand: `parseEvidence(doneEvidence(evidence)).trust`, where `doneEvidence` is the same clipping `done` and `eval` apply (ANSI stripped, first 2,000 and last 12,000 characters), so the class is that of the text Jev would see.

| Class | `trust` | Meaning |
| --- | --- | --- |
| **R** | `parsed` | at least one recognised runner parsed the output |
| **E** | `exit_code` | no runner recognised, an `exit code`/`exit status` line present |
| **U** | `unparsed` | neither; `met` is impossible by design (the cap in `doneRequest`) |

A case whose evidence has a non-zero exit code is decided in code (`missing`, Jev not asked). It keeps its class but is **code-decided**: counted apart and in no denominator below (it cannot be a wrong `met` by construction, so including it would only tighten the bound without testing anything). **Sent** = Jev is asked.

## The bar (fixed now)

Unit: a **cluster** (rule 5). Evidence, labels and verdicts are per case; every count and interval below is over clusters of sent cases. A cluster counts as a wrong `met` if any member is `met` while expected `missing`, and as a hit (`missing` found, `met` found) only if all members are; this is the strict direction both ways.

1. **Wrong `met` = 0 in every class (R, E, U) and pooled.** Over expected-`missing` sent clusters. Reported per class with n and the exact one-sided 95% upper bound (Clopper-Pearson; for 0 of n it is 1 - 0.05^(1/n)). Any wrong `met` in any class fails the bar. With small n the bound is wide and a 0 is weak evidence; the bound is reported, not a minimum n.
2. **`missing` recall >= 0.9 over all sent clusters** (R, E, U pooled): expected `missing` with verdict `missing`; `unsure` is not a hit. Point value and two-sided 95% interval; the bar is on the point value, as in the earlier registrations. Also reported with the code-decided cases added, as context.
3. **`met` recall by class.**
   - **R:** >= 0.9, **only when at least 30 sent clusters of class R are expected `met`**; with fewer, "not evaluable (n = k)" with point value and interval, no verdict.
   - **E:** report `met` recall and wrong `met`; **no recall bar**. The lint caps make the trade (recall for wrong `met`) on purpose.
   - **U:** `met` is never given, by design; no recall. Report **coverage** only: the share of sent clusters, and of expected-`met` clusters, that fall in U (what the user would have to fix by adding an exit code line or a parser).
4. **Data hygiene.** Any real-log sample is split into **dev** (used to rank and write parsers) and a **frozen hold-out** *before* any parser is written for it; the hold-out text is never read to write a parser, and the parser backlog is ranked from dev cases only. The split is by repository (cases of one repository share workflows, tools and output formats, so a case-level split leaks formats into the hold-out), deterministic, and the hash of the hold-out id list is recorded when the split is committed. A hold-out is scored once.
5. **Clusters.** The same step logged twice, with and without the exit code line, is one case for interval purposes. Cluster key: SHA-256 of the evidence after removing the lines the exit-code regex of `parseEvidence` matches and trimming; identical keys with the same expected label form a cluster. Real-log sample: the keys `(repo, job_id, step_number)` of all 229 cases are distinct, so clustering is a no-op there; it only matters for hand-written sets.
6. **Label rule.** Expected `met` only if the log shows that the checks actually ran and passed: not 0 tests, not all skipped, not a silent no-op; labels are read from the log by a labeller, not taken from the CI conclusion alone. **The labellers are language models, not humans**: for the hold-outs 2 to 6 the cases were written by agents and labelled by a second agent (hold-out 5: one author-labeller only); for the real-log sample two `claude -p` processes (the first on every case, the second on a random 30%, kappa 0.966), plus the code rule that drops a `met` label on silent output. Agreement measures consistency, not correctness. No human labelled anything unless a record says so.

## Split rule for the existing real-log sample (fixed now)

Seed string `done-bar-split-v1`. Within each primary-language bucket (the `language` field of the table), repositories are ordered by `sha256(seed + ":" + repo)` (hex, ascending); positions 0, 2, 4, ... are **dev**, positions 1, 3, 5, ... are **hold-out** (dev gets the extra repository of an odd bucket). Every case inherits its repository's part. The split file records the seed, the rule, per-repository assignment and the SHA-256 of the sorted hold-out case ids. Parsers are written from dev only.

**Fork: split ratio.** Put to `decide` (half and half; one third dev, two thirds hold-out; two thirds dev, one third hold-out; three options, each asked in both orders). First ask: half 0.50, hold-out-heavy 0.09, dev-heavy 0.40, verdict `tie`, orders agreeing (receipt `rmur7p0icd4p1`). Second ask after adding a neutral fact (29 of 44 backlog tools appear in at most two repositories; the pass check runs on a fresh sample): half 0.50, hold-out-heavy 0.05, dev-heavy 0.45, orders disagreeing (receipt `rmur7pe0knlvq`). Both under the p >= 0.90 bar, so the **conservative option is taken: half and half**, which is also the leader both times and the easiest to undo. The cost, stated now: about 22 of the 44 parsed expected-`met` cases fall in the hold-out, so bar 3 (R, >= 30) is **not evaluable** on the hold-out of this sample.

**Limit that no rule fixes.** The whole-sample parser backlog was published before this split ([measurements-real-logs.md](../measurements-real-logs.md)), and six parsed-tool misses were read in the text. So this hold-out is not clean with respect to the tool names in that backlog; it is frozen from now on, and a fresh sample split in advance is the clean test.

## What the rescoring will cover

The remaining cases of `done-v2-h2` to `done-v2-h6` (cases that moved to the dev split of `done-v2` after parsers were written are not in them; `done-v2` itself is dev and the first hold-out) with their recorded answers, `done-v2-h6p` (the parser regression group) reported separately, and the real-log sample, code-level parts only (classes, counts per class and suite, `met` reachable under the caps; no Jev answers exist for it). A recorded answer is used only if its question hash and state hash match what current code builds (as `eval score` requires); stale ones are listed and excluded, not reused. Suite allowances are not changed.

## Limits, stated now

- Labels come from the same model family as the author (rule 6); invented outputs in five of the six sets; one Jev model version.
- The old data was used to build the parsers and caps that decide the classes, so class membership is partly fitted to it.
- Class is a property of the parsers at the time of scoring; adding a parser moves cases from E or U to R and changes every rate.
- A pass would still not say anything about tools not in the sample, and `done` v2 stays "not measured" until a registered check on a fresh, pre-split sample passes.
