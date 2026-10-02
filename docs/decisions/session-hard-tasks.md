# Hard-task session study: pre-registration

Registered 2026-10-02, before any hard task was written and before any session of this study was run. The harness extension, the tasks and the results go in later commits, whichever way the numbers fall.

**Why this exists.** The [base-rate study](session-base-rate.md) found 1 wrong "done" in 100 asked stops. With one positive, the Stop gate's recall and precision on wrong "done" claims could not be measured: its recall interval ran from 0.025 to 1. This study changes only the task mix, so that wrong "done" claims are common enough to measure the gate on them: at least 15 are the target, which is the smallest count at which an all-caught result has a Clopper-Pearson lower bound near 0.8.

**What it can and cannot say.** The tasks are written by us, with traps that we think a model overlooks. The rate of wrong "done" is a property of this mix, not of real work, and says nothing about how often Claude is wrong on anyone's project. It can show how the gate behaves when wrong claims exist: how many are asked about at all, how many are caught, how many correct claims are blocked, and whether `claims_verified` separates the two groups.

## Hypotheses

Bars are fixed here. Nothing about them changes after the pilot or after the data is read.

- **H1, prevalence.** The wrong-done rate on this hard mix is at least 15%: wrong done sessions over usable sessions (definitions below) is at least 0.15. Reported with its exact Clopper-Pearson 95% interval. A count of wrong done sessions below 15 is reported as "below the power target"; H2 and H4 are then reported but not judged.
- **H2, recall.** The gate asks about and would-block at least 80% of wrong dones: `would_block` and wrong done, over all wrong done among usable sessions, is at least 0.80 (point estimate), with the exact Clopper-Pearson 95% interval. Two parts are always printed next to it: the share of wrong dones that were asked at all (a wrong "done" behind a passing visible test is skipped by design) and recall among asked wrong dones.
- **H3, false blocks.** The false-block rate on true dones is at most 5%: `would_block` over true done asked stops (the registered v0.5 bar, as in the base-rate study), with the exact interval. The rate over all true dones, skipped ones counted as not blocked, is printed too.
- **H4, separation.** `claims_verified` separates wrong from true dones. Over asked stops that claim success and have a recorded `claims_verified`, the score is `1 - claims_verified`, the statistic is the AUC for wrong done against true done (ties count half), and H4 holds when the AUC is at least 0.70 and the one-sided exact permutation p-value is at most 0.05. Reported with a percentile bootstrap 95% interval. Not judged when fewer than 10 asked wrong dones or fewer than 10 asked true dones exist.

Precision of `would_block` for wrong done (with its interval) is reported as well; it is not a hypothesis because the base-rate study already restated the v0.5 bar for it.

## Definitions

All definitions of [session-base-rate.md](session-base-rate.md#definitions) are reused unchanged: session, stop, asked stop, the success and negation word rule and the hand labelling of ambiguous messages (implemented in `scripts/session-study/lib.mjs` and not edited), hidden verifier (outside the task tree, exit 0 pass, 1 fail, anything else is an error and excluded and counted), wrong done, true done, honest failure, quiet pass, gate figures, labels. Two additions that only fix denominators:

- **Usable session.** Not `leaked`, `run_failed`, `error` or `unresolved` (a message with both success and negation words that has not been labelled by hand yet). The same filter as the base-rate analysis.
- **Ambiguous messages** are labelled by hand by reading only the task and the final message, before the verifier result and the gate's answer are looked at: the `review` command prints nothing else.

The gate is the one in the repository at the harness commit, in `shadow` mode, with the generic pack and the thresholds as shipped. The model version of every Jev record is kept and reported.

## Task design principles

Every task has a prompt that points to a README (or states the requirement itself), a reference solution, a hidden verifier that checks every requirement the prompt or README states, and, for every kind except the controls, a plausible wrong solution that a careful reader of a hasty implementation would write. A task is not allowed to hide a requirement from the README: the requirement is stated, clearly, once, in a list or a sentence that is easy to skim past. Principles:

1. **A hidden requirement stated clearly but easy to overlook**: a spec of 6 to 10 short clauses where one or two are unusual (an order, a boundary, a tie-break rule, a default that differs from the obvious one).
2. **Edge cases the visible tests do not cover**: a visible test exists, passes the plausible wrong solution, and fails on the starter and passes on the reference.
3. **Off-by-one, Unicode, timezone and rounding traps**: inclusive versus exclusive ends, combining characters and grapheme clusters, daylight-saving gaps, half-even versus half-up, floating point money.
4. **A natural test passes while a second requirement fails**: for example the result is right but the input is mutated, the order is stable only by accident, an error type is wrong, a second file was not updated.
5. **Multi-file change**: an API used from two or three modules, where the plausible change updates one of them.
6. **Visible tests absent** in most tasks, so Claude has to write its own checks. Those sessions are asked stops by construction in the gate's own terms, because the transcript analyser does not count a script run as a check. Tasks with visible tests are a minority and measure the coverage gap.
7. **A reference solution that is not trivial**: no task is a one-liner.

Every task is checked by `npm test` (a new test file next to the base-rate one): the starter fails the verifier, the reference passes, the wrong solution fails, and when visible tests exist they fail on the starter, pass on the reference and pass the wrong solution.

## Tasks

At least 30 tasks, written fresh and disjoint from the 24 of the base-rate study (and from the 13 derived `stop-study` cases, which come from them): ids start with `h-`, topics and function names are not reused, and a test checks ids, prompts and README titles against the earlier set. Planned: 32 tasks, 15 in Node, 14 in Python and 3 in shell (bash, run from a Node verifier). `go` is not installed on the study machine (`which go` finds nothing on 2026-10-02), so there are no Go tasks. Kinds, with the planned count: hidden requirement without visible tests (10), weak visible test (7), Unicode/timezone/rounding trap without visible tests (9), multi-file (6). The frozen list is ordered by id and the runner pins its SHA-256, as in the base-rate study.

## Sessions, models and budget

- One session is one headless `claude -p` run with the isolation of the base-rate study (scratch git repository per task, `.claude/referee.json` with `{"pack":"generic","hooks":{"stopGate":"shadow"}}`, `--setting-sources project,local`, a plugin copy with its own data directory, a verifier outside the tree, raw transcripts never committed). Differences: shell tasks add `Bash(bash *)` to the allowed tools; the per-session maximum is 0.25 USD instead of 0.40, because the first study's sessions cost 0.05 to 0.11 USD.
- **Planned sessions: 100 at most**, in this order, so that a stop at the cap still leaves a spread: (1) `sonnet` repetition 1 of all 32 tasks; (2) `haiku` repetition 1 of the tasks whose zero-based position in the id-sorted list is not a multiple of 3 (21 tasks); (3) `sonnet` repetition 2 of all 32; (4) `sonnet` repetition 3 in id order until 100 sessions exist (15 tasks). Haiku is 21% of the plan, under the quarter limit; every task gets 2 to 4 runs.
- **Pilot (stage 0): 6 sessions**, `sonnet` repetition 1 of the tasks at zero-based positions 0, 5, 10, 15, 20 and 25 of the id-sorted list. They are the first six sessions of round (1). The pilot's wrong-done rate (count over usable sessions) is reported, and so are the asked count and the cost. If the tasks are unchanged after the pilot, the six sessions stay in the data; if any task changes, the pilot sessions are reported on their own, the main run starts in a fresh data directory, and their spend still counts against the cap.
- **Cap: 8.00 USD of Claude spend in total across all sessions of this study**, pilot included, from `total_cost_usd` in the run results, kept in `ledger.jsonl`. The runner refuses to start a session whose worst case (0.25 USD) would pass the cap and never raises it. Jev calls are billed by TypeSafe and counted with `receipts --tokens`. At roughly 0.07 to 0.15 USD per session the cap may bind before 100 sessions; that is a stated outcome, not a failure.
- **Stop rule.** The main run stops at the first of: 100 asked stops (usable sessions, the base-rate rule), the cap, the end of the 100-session plan. A session that times out (300 s) or fails is recorded, counts toward the budget and is not retried silently.

## Pilot adjustments

The pilot exists to calibrate difficulty. After it, the **tasks** may change (a spec that was unfair or ambiguous, a verifier that checks something the spec does not say, a leak, a harness bug, a pilot with no wrong done that suggests more or sharper traps). The hypotheses, the bars, the definitions, the models, the cap, the plan order and the stop rule may not. Every adjustment is written in the Changelog section below, with the reason, before the main run starts. A task is never made easier or harder after the main run has started.

## Analysis (fixed before the data)

1. Counts per session class, overall, by model, by task kind and by language; per-task counts next to every interval, because repeated sessions of one task are not independent and the intervals treat them as if they were.
2. H1: usable sessions, wrong dones, rate, Clopper-Pearson interval. The rate over sessions that claim success (wrong over wrong plus true) is printed as a second view.
3. H2 and H3 as above, with coverage (wrong dones asked / all wrong dones), recall among asked, precision, skips by reason, and the false-block rate split by whether Claude ran its own code (the detector stratum of the base-rate study).
4. H4: AUC of `1 - claims_verified` for wrong against true, the exact permutation p-value (one-sided, the distribution of the Mann-Whitney statistic under all assignments of the observed scores, counted exactly with doubled mid-ranks so that ties are handled; no sampling), and a percentile bootstrap 95% interval, 10 000 resamples drawn separately within each class with a fixed seed (20261002, mulberry32).
5. Cost per session and in total, model ids, Jev model versions, `p95_all_ms` and the error rate.
6. Every number above is reported whichever way it goes, including the ones that sink a hypothesis. No post-hoc subgroup is used to rescue a hypothesis; subgroups are descriptive.
7. No tuning after the look: the gate's thresholds, the pack, the questions and the tasks stay as they were at the main run's start. Anything learned goes to the ROADMAP as an idea, not into the gate in the same change set as the result.

Limits stated before the run: tasks written by one author and one model family, most of them small; the traps are our guess at what is overlooked; the keyword rule for "claims success" is crude at its edges; one user-level configuration still loads into sessions; Claude's wrong-done rate depends on the model version of the day; intervals are too narrow because of the clustering.

## Changelog

Adjustments to the tasks between the pilot and the main run, and clarifications that change no bar. Empty at registration.

- **2026-10-02, before any session ran: plan order corrected, bars unchanged.** The registered order (all sonnet repetition 1, then all haiku, ...) would put haiku above a quarter of the sessions actually run if the cap stops the study early. The order that replaces item (1) to (4) of the plan: the 6 pilot sessions first; then the remaining sonnet sessions in the order sonnet repetition 1 of the other 26 tasks, repetition 2 of all 32, repetition 3 of 15 (id order), with the k-th haiku session (repetition 1, the 21 tasks registered above, id order) inserted straight after the sonnet session numbered 3k+3 in that sequence, k = 1 to 21. Every prefix of the plan then has at most 25% haiku, and the totals are the same: 79 sonnet and 21 haiku. A session id is `<task>__<model>__r<repetition>`, so the pilot sessions are the same sessions the main plan lists first.
