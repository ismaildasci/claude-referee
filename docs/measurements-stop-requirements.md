# Stop gate requirements question without edit contents

Registration: [stop-requirements-question.md](decisions/stop-requirements-question.md) (commit 0b68c6a, before any request or fresh session). Harness: `scripts/stop-req/`. Recorded answers, split, frozen choice, per-split results and the fresh-session ledger: `jev-evals/stop-req/` (answers and hashes only; the raw transcripts are not in the repository). Synthetic sessions with hidden-verifier labels: nothing here is evidence about real projects.

## Verdict

**The requirements question does not separate on the state the gate already sends; the signal of the [contents study](measurements-stop-state.md) needed the code.** On the fresh sessions, scored once, the frozen primary candidate (`R0-W2`, shipped fields only) has AUC 0.626 (task-clustered 95% interval 0.432 to 0.791, exact permutation p 0.107) against 0.543 for the shipped gate on the same sessions. The enriched candidate (`R1-W2`, adds parsed check counts) is no better (0.581, p 0.212). The existing hold-out, scored once by these variants, gives AUC 0.453 and 0.433, below chance. Nothing is built and nothing shipped changes.

| Adoption rule (primary `R0-W2`, fresh set, threshold 0.555) | Result | Met |
|---|---|---|
| P1: lower bound of the task-clustered 95% AUC interval above 0.5 | 0.432 | no |
| P2: one-sided exact permutation p at most 0.05 | 0.107 | no |
| P3: recall at least 0.7 and false-block rate at most 0.5 | recall 10/11 = 0.909 (0.587 to 0.998), false blocks 29/38 = 0.763 (0.598 to 0.886) | no (false blocks) |
| P4: AUC above A's and false-block rate below the keyword note's reading B | 0.626 against 0.543; 0.763 against 37/38 = 0.974 | yes |

The registered verdict for "P1 or P2 fails" is therefore the one above. The secondary candidate fails P1 (0.395), P2 at 0.025 (p 0.212) and P3 (recall 9/11, false blocks 28/38 = 0.737). The paired AUC difference against the shipped gate is 0.083 (task bootstrap -0.226 to 0.372) for the primary, so even "better than A" is not established.

## Dev run (92 sessions, 7 wrong dones; hard tasks 32 sessions, 7 wrong, 25 true, 15 tasks)

12 configurations, two requests each (the score is the mean of the two), all answered, no errors. Selection metric: AUC over the dev hard sessions. Exact permutation p of the hard AUC, the two repetitions' AUCs as the noise check, and the overall dev AUC (which mixes in task type) are shown.

| Configuration | AUC hard | p | rep 1 / rep 2 | AUC all dev |
|---|---|---|---|---|
| R0-W1 (met, shipped state) | 0.303 | 0.943 | 0.300 / 0.326 | 0.351 |
| **R0-W2** (gap, shipped state) | **0.531** | 0.407 | 0.509 / 0.531 | 0.566 |
| R0-W3 (unverified) | 0.366 | 0.858 | 0.369 / 0.406 | 0.412 |
| R0-W4 (trap) | 0.526 | 0.424 | 0.531 / 0.514 | 0.718 |
| R1-W1 (+ check results) | 0.349 | 0.887 | 0.400 / 0.320 | 0.414 |
| **R1-W2** | **0.571** | 0.292 | 0.560 / 0.563 | 0.593 |
| R2-W1 (+ edit stats) | 0.254 | 0.977 | 0.271 / 0.263 | 0.313 |
| R2-W2 | 0.534 | 0.399 | 0.546 / 0.534 | 0.576 |
| R3-W1 (+ both) | 0.269 | 0.970 | 0.283 / 0.271 | 0.337 |
| R3-W2 | 0.526 | 0.425 | 0.560 / 0.491 | 0.583 |
| R3-W3 | 0.391 | 0.807 | 0.386 / 0.383 | 0.465 |
| R3-W4 | 0.540 | 0.382 | 0.540 / 0.540 | 0.713 |
| A (shipped gate, reused from the contents study) | 0.303 | 0.946 | | 0.295 |

Reading: no configuration separates on dev. The best dev AUC on hard tasks is 0.571, below the registered 0.6 mark, so the study records a dev failure and, as registered, runs the fresh set anyway. The "met" wordings (W1, the direct analogue of the contents study's best question) are below 0.5 in every state, the same inversion as the shipped `claims_verified` (the cause is not tested here; one reading is that, with only the message, the checks and file names, a thorough-sounding message is rated as having met the requirements whether or not it did). The gap wording (W2) and the trap wording (W4) sit near 0.5 on hard tasks. W4 reaches 0.72 on all dev sessions (R0 and R3) but 0.53 on the hard ones: it ranks the hard tasks above the base-rate tasks, a task-type effect that carries no information about whether a session is wrong. The enrichments add little: R1 adds 0.04 for W2, R2 adds 0.00, R3 does not help. The two repetitions differ by up to 0.07 AUC (R3-W2).

**Selection (registered rule).** Primary: `R0-W2` (best of the shipped-state family; `R0-W4` is within 0.01, equal request size, the table order picks `R0-W2`), threshold 0.555 (the highest score keeping dev-hard recall at 0.7: 5 of 7; dev-hard false blocks 21 of 25 = 0.84). Secondary: `R1-W2`, threshold 0.615 (recall 5 of 7, false blocks 16 of 25 = 0.64). Frozen in `jev-evals/stop-req/frozen.json` and committed (1f61897) before any fresh session ran.

## Fresh sessions (primary test; all hard tasks)

56 sessions ran (42 sonnet, 14 haiku, plan order and mix as registered; markers 11 and 12) and the cap stopped the run: 5.79 USD of the 6.00 USD cap (sonnet 4.11 USD, haiku 1.69 USD; `jev-evals/stop-req/fresh/ledger.jsonl`). One haiku session failed (`run_failed`) and is excluded. 25 final messages mixed success and negation words and were labelled by hand before any verifier result or Jev score was looked at, under the registered rule; every one of the 25 says the work is implemented or written and works, so all 25 counted as claims (this includes messages that disclose untested code, for example two that say tests could not be run). Population: 49 sessions that claim success with at least one edit, 11 wrong dones and 38 true dones in 31 tasks (sonnet 6 wrong of 37, haiku 5 wrong of 12); the other 6 usable sessions are 4 quiet passes (3 sonnet, 1 haiku), 1 honest failure and 1 claim session without an edit. Power rule met (at least 5 wrong, at least 15 true).

| Fresh set (11 wrong, 38 true, 31 tasks) | `R0-W2` primary (threshold 0.555) | `R1-W2` secondary (0.615) | A, shipped gate |
|---|---|---|---|
| AUC | 0.626, task bootstrap 0.432 to 0.791, session bootstrap 0.439 to 0.800, p 0.107 | 0.581, 0.395 to 0.750, p 0.212 | 0.543, 0.342 to 0.728, p 0.335 |
| recall on wrong dones | 10/11 = 0.909 (0.587 to 0.998) | 9/11 = 0.818 (0.482 to 0.977) | shipped `would_block` 10/11; at score 0.555 11/11 |
| false blocks on true dones | 29/38 = 0.763 (0.598 to 0.886) | 28/38 = 0.737 (0.569 to 0.866) | shipped `would_block` 35/38 = 0.921 (0.786 to 0.983) |
| paired AUC difference vs A | +0.083 (-0.226 to 0.372) | +0.038 (-0.245 to 0.314) | |
| by model | sonnet 0.645 (6 wrong, p 0.139), haiku 0.600 (5 wrong, p 0.306) | sonnet 0.573, haiku 0.600 | |
| within-task AUC (4 tasks with both classes) | 0.750 | 0.875 | |
| asked-only (11 wrong, 37 true) | AUC 0.638, p 0.087; recall 10/11, false blocks 28/37 = 0.757 | 0.596, p 0.173 | |

Keyword-only note on the same sessions: reading A recall 7/11 = 0.636, false blocks 17/38 = 0.447; reading B recall 11/11, false blocks 37/38 = 0.974.

Reading: the point AUC of 0.626 is above 0.5 and above the shipped gate's 0.543, and the result is not significant (p 0.107, interval from 0.43). It is compatible with no separation. At the frozen threshold the false-block rate is 0.76 to catch 10 of 11 wrong dones, close to the shipped gate's behaviour. The model split does not show a model confound as the source of the AUC (it is above 0.5 within both models, with 6 and 5 wrong dones). The within-task AUC rests on 4 tasks.

## Hold-out (secondary; seen once by the contents variants, never by these)

95 sessions, 9 wrong, 86 true in 27 tasks; hard tasks 36 sessions, 8 wrong, 28 true, 15 tasks. No verdict is drawn from it.

| | `R0-W2` (0.555) | `R1-W2` (0.615) | A, shipped gate (recorded) |
|---|---|---|---|
| AUC, all | 0.453, task bootstrap 0.284 to 0.672, p 0.675 | 0.433, 0.262 to 0.651, p 0.744 | 0.553, 0.367 to 0.848, p 0.304 |
| AUC, hard only | 0.400 (0.191 to 0.638), p 0.803 | 0.359 (0.144 to 0.578), p 0.885 | 0.471 (0.225 to 0.850), p 0.601 |
| recall at the threshold | 6/9 = 0.667 | 4/9 = 0.444 | shipped `would_block` 8/9 |
| false blocks | 63/86 = 0.733 | 56/86 = 0.651 | shipped 71/86 = 0.826 |

Both variants are below 0.5 on the hold-out, hard-only too. Together with dev (0.53, 0.57 on hard) and fresh (0.63, 0.58), the pooled picture is no reliable separation; the fresh point estimates above 0.5 are the only ones, and they come with intervals that include 0.5. The contents study's best configuration scored 0.867 on this same hold-out (0.643 hard only), so the same sessions that the question could separate with the code, it could not separate without it.

## How to read it

- **The signal needed the code.** The only thing that changed between the contents study's best question and these is the evidence: the code was replaced by the checks and file names. The direct analogue (W1) fell below 0.5 in every state on dev, like the shipped questions. A requirement can only be judged against evidence of what the work does, and the state the gate sends does not carry it; for most hard tasks it does not even carry the requirements (a pointer to a README).
- **Counts do not substitute for contents.** Parsed check results (R1) and per-file line counts (R2) did not move the AUC beyond noise on dev (largest gain 0.04 on hard, 0.00 for R2) and were no better on fresh or hold-out. The two enrichments tested here are not what is missing.
- **Part of any positive AUC is task difficulty.** W4 (the trap wording, asked mostly about the task text) scored 0.72 on all dev sessions and 0.53 on the hard ones. A wording that mostly recognises trappy tasks earns AUC against base-rate tasks without judging the work; the fresh set (all hard tasks) removes that source, and its estimates stay inside the interval around 0.5.
- **Haiku and sonnet.** The fresh set mixes both (12 of 49 sessions are haiku, 5 of them wrong); the AUC by model is above 0.5 in each but based on 5 to 6 wrong dones.

## Numbers of the study

Jev requests: 2 833 in total, all answered, no errors: dev 2 208 (12 configurations, two requests each over 92 sessions, plus one size probe of the largest state), fresh 245 (two candidates twice plus A once over 49 sessions), hold-out 380 (two candidates twice over 95 sessions); 2.36 million input tokens; about 0.11 USD at 0.00004 USD per request. A's dev and hold-out answers were reused from the contents study (no new request). Model `jev-1.13.0` in every response. No receipt ids are returned by the endpoint, so `jev-evals/stop-req/recorded.jsonl` is the receipt (question hash, state hash, size, answers, token count). Claude spend: 5.79 USD of the 6.00 USD cap for 56 fresh sessions. The state text is regenerated from the local study directories by `node scripts/stop-req/run.mjs prepare --study base=<dir> --study hard=<dir> --study fresh=<dir>`.

## Limits

Synthetic tasks written by us, one model family that also labels; the fresh sessions reuse the 32 tasks that dev and hold-out came from, so a task-difficulty prior is not excluded, and dev tasks reappear; 11 wrong dones in 31 tasks, so the fresh intervals are wide (a true AUC of 0.7 would often give a lower bound under 0.5 at this size, so "does not separate" here means "not shown to separate", and the hold-out and dev point estimates do not suggest a hidden effect); the dev threshold rests on 7 wrong dones; the runner and the labeller are one agent and the 25 hand labels all fell on one side (claim); edits through Bash are not seen; four wordings and four states were tried, not every possible wording; a negative result says Jev does not separate with these inputs on this data, not that no input could.

## What changes

Nothing shipped: no change to `src/hooks`, the pack, thresholds or defaults, and `docs/privacy.md` is unchanged. The registered adoption rule failed, so no proposal document is written. The contents study's remaining open item stands: the separation it found needs the code, which is a privacy change that would have to be opt-in.
