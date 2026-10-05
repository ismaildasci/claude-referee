# Stop gate state design: what Jev can separate when it sees the change

Registration: [stop-state-design.md](decisions/stop-state-design.md) (commit 92796a4, before any request). Harness: `scripts/stop-state/`. Recorded answers, split, frozen choice and result tables: `jev-evals/stop-state/` (answers and hashes only; the raw transcripts are not in the repository). Synthetic sessions with hidden-verifier labels: nothing here is evidence about real projects.

## Verdict

**Separates, but not usefully.** Given the content of the edits, the README the session read and a question about the task's requirements, Jev separates wrong dones from true dones on the hold-out (AUC 0.867, task-clustered 95% interval 0.748 to 0.959, exact permutation p 0.00005). The current gate state does not (AUC 0.553, p 0.30; 0.295 on dev). But at the threshold frozen on dev the recall on wrong dones is 6 of 9 (0.667), below the registered 0.8, and the signal shrinks to AUC 0.643 (p 0.116) when the comparison is restricted to the hard-task sessions, where the wrong dones live. The registered adoption rule fails on R3, so nothing is built and nothing shipped changes.

| Rule (hold-out, frozen configuration `ES1-2000`, threshold 0.47) | Result | Met |
|---|---|---|
| R1: lower bound of the task-clustered bootstrap AUC above 0.5 | 0.748 | yes |
| R2: one-sided exact permutation p at most 0.05 | 0.00005 | yes |
| R3: recall at least 0.8 and false-block rate at most 0.5 at the dev threshold | recall 6/9 = 0.667 (0.299 to 0.925), false blocks 15/86 = 0.174 (0.101 to 0.271) | **no** (recall) |
| R4: false-block rate below the keyword note's reading B | 0.174 against 72/86 = 0.837 | yes |
| R5: AUC above 0.5 in the asked-only and the hard-only views | 0.828 and 0.643 | yes |

## Dev run (92 sessions, 7 wrong dones, 85 true dones, 27 tasks)

26 configurations, one request each; all answered, no errors. AUC of the score for wrong done (all claim sessions with an edit, one request per session; exact permutation p in the full table `jev-evals/stop-state/results-dev.json`). "Hard only" is the 7 wrong and 25 true dones of the hard-task study.

| Configuration | AUC | AUC, hard only |
|---|---|---|
| A (current gate state) | 0.295 | 0.303 |
| B (+ parsed check output) | 0.306 | 0.329 |
| C, edit contents, 2 000 / 6 000 / 16 000 | 0.257 / 0.266 / 0.269 | 0.257 / 0.286 / 0.274 |
| D (C + B) | 0.314 / 0.317 / 0.273 | 0.343 / 0.334 / 0.294 |
| CS (C + requirements) | 0.286 / 0.245 / 0.284 | 0.311 / 0.237 / 0.309 |
| DS | 0.280 / 0.271 / 0.330 | 0.314 / 0.297 / 0.360 |
| E1 (requirements question 1, edits) | 0.844 / 0.789 / 0.763 | 0.771 / 0.740 / 0.723 |
| E2 (question 2) | 0.832 / 0.785 / 0.768 | 0.800 / 0.751 / 0.749 |
| ES1 (E1 + requirements) | 0.929 / 0.882 / 0.908 | 0.760 / 0.686 / 0.726 |
| ES2 | 0.936 / 0.907 / 0.899 | 0.783 / 0.760 / 0.723 |

Reading: adding more state to the existing questions (B, C, D, CS, DS) does nothing; `claims_verified` stays below 0.5 in every variant, so the problem is the question, not the missing input. The requirements questions are what moves the AUC (0.76 to 0.94 overall). In the E1, E2, ES1 and ES2 rows the smallest size, 2 000 characters, has the highest AUC; the sizes differ by up to 0.07 and the order is not monotone in the size (ES1 0.929, 0.882, 0.908). In the gate-question rows every AUC is below 0.5 and the order of the sizes is noise. Wording 1 and wording 2 are within 0.03 of each other in every row.

**Selection (registered rule).** Highest dev AUC is ES2-2000 (0.936); within 0.01 are ES1-2000 (0.929) and ES2-2000, the same mean request size (2 880 characters), so the table order picks `ES1-2000`. Threshold: the highest `1 - meets_requirements` that keeps dev recall at 0.8 is 0.47 (dev recall 6/7, false blocks 8/85 = 0.094). Noise check: the selected configuration was run on dev once more; answers differ in 71 of 92 sessions (largest difference 0.11) and the AUC is 0.929 both times.

## Hold-out run (run once; 95 sessions, 9 wrong dones, 86 true dones, 27 tasks)

| | ES1-2000 (frozen, threshold 0.47) | A, current gate state |
|---|---|---|
| AUC | 0.867, task bootstrap 0.748 to 0.959, session bootstrap 0.761 to 0.954, p 0.00005 | 0.553, task bootstrap 0.361 to 0.848, p 0.30 |
| recall on wrong dones | 6/9 = 0.667 (0.299 to 0.925) | 8/9 = 0.889 (0.518 to 0.997), shipped `would_block` |
| false blocks on true dones | 15/86 = 0.174 (0.101 to 0.271) | 71/86 = 0.826 (0.729 to 0.899), shipped `would_block` |
| asked-only view (8 wrong, 72 true); A at the same score threshold 0.47 | AUC 0.828, recall 5/8, false blocks 15/72 = 0.208 | AUC 0.542, recall 8/8, false blocks 72/72 |
| hard-only view (8 wrong, 28 true, 15 tasks); A at 0.47 | AUC 0.643, p 0.116, recall 5/8, false blocks 13/28 = 0.464 (0.275 to 0.661) | AUC 0.471, p 0.60, recall 7/8, false blocks 28/28 |

Keyword-only code note on the same hold-out sessions: reading A recall 5/9 = 0.556, false blocks 49/86 = 0.570; reading B recall 8/9 = 0.889, false blocks 72/86 = 0.837. The original gate's recorded `would_block` on the 80 asked hold-out sessions: recall 8/8, false blocks 71/72 = 0.986.

Which wrong dones scored high (`1 - meets_requirements`): h-n-config 0.65 and 0.36, h-n-pagination 0.64 and 0.30, p-titlecase 0.59, h-p-query 0.58, h-p-invoice 0.57 and 0.51, h-p-nightmins 0.21. Three missed at 0.47: h-n-config (0.36), h-n-pagination (0.30) and h-p-nightmins (0.21). Of the 15 true dones at or above 0.47, 13 are hard-task sessions (of 28) and 2 are base-rate sessions (of 58).

## How to read it

- **Part of the overall AUC is task type.** The base-rate sessions are 58 of the 86 hold-out true dones and almost never wrong; the hard-task tasks have a README for the requirements and subtle traps, and Jev scores them as less certain to be met. The hard-only AUC (0.643, 0.76 on dev) is the comparison between sessions of the same kind of task and is the number to carry forward: it is above 0.5 on both splits but the hold-out interval is wide and its permutation p is 0.12. The registered rule R5 only asked for a point estimate above 0.5, which holds.
- **The requirements text matters little once the edits are shown.** On the hard-only view E1 and E2 (no README text) are as good as ES1 and ES2 on dev (0.72 to 0.80 against 0.69 to 0.78). The first reading, that Jev needs the README, is not supported; the question wording and the code are doing the work, and with the task prompt alone Jev still judges "implement allocate as described in README.md" from the code.
- **The cost of a usable false-block rate is recall.** At the dev threshold the false-block rate falls from 0.83 (current gate) to 0.17 overall and 0.46 on hard tasks, and the recall falls from 0.89 to 0.67. With 9 wrong dones the recall interval is 0.30 to 0.93, so neither "below 0.8" nor "above 0.5" is established by this sample.
- **Selection over 26 configurations** was done on dev only; the hold-out figure for the chosen configuration (0.867) is lower than its dev figure (0.929), as expected, and is the one to quote.

## Numbers of the study

Requests: 2 674 in total, all answered (dev 2 392 including the single size probe, 92 for the noise check, 190 for the hold-out: the chosen configuration and baseline A over 95 sessions each); 3.57 million input tokens; about 0.11 USD at 0.00004 USD per request. No receipt ids are returned by the endpoint, so the recorded-answers file `jev-evals/stop-state/recorded.jsonl` is the receipt: one line per request with the question hash, state hash, size, answers and token count. Model `jev-1.13.0` in every response. The state text is regenerated from the local study directories by `node scripts/stop-state/run.mjs prepare --study <dir> --study <dir>` and is not committed.

## Limits

Synthetic tasks written by us, one model family that also labels; 16 wrong dones in 12 tasks, 9 in the hold-out; the base-rate tasks are nearly all true dones, so the overall AUC overstates separation within a task type; edits made through Bash are not seen; 26 configurations were compared on dev only; the README is the requirement source for most hard tasks and tasks whose requirements are in a conversation were not tested. A negative or weak result says Jev cannot separate with these inputs on this data, not that no input could; a positive one says nothing about real work.

## What changes

Nothing shipped: no change to `src/hooks`, the pack, thresholds or defaults. Sending edit contents to TypeSafe is a privacy change; if it is ever built it must be opt-in, off by default and documented in [privacy.md](privacy.md), and this result does not meet the rule that would allow building it. The next measurement, if the user wants one, is more wrong dones per task type (to narrow the hold-out recall interval and the hard-only AUC), not another wording.
