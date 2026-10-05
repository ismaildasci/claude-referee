# Stop gate state design: pre-registration

Registered 2026-10-05, before any Jev request of this study and before the harness exists. Results go in later commits of their own, whichever way they fall.

**Why this exists.** In the [base-rate](session-base-rate.md) and [hard-task](session-hard-tasks.md) studies the Stop gate with Jev blocked 150 of 152 asked true dones: `claims_verified` had AUC 0.398 for wrong against true done (hard study) and precision for wrong done was about 0.1. The state the gate sends is the task, the final message, a list of checks with only `cmd` and `status`, and the NAMES of edited files. It carries nothing about whether the change satisfies the task, so Jev can only read the message's wording. The [code-only note](stop-code-note.md) showed that a keyword rule reproduces the gate's behaviour on these sessions.

**Hypothesis.** If Jev is given the actual change (the content of the edits, size-limited and redacted) and asked whether the change implements the task's requirements, its answer separates wrong dones from true dones. This is a design study on synthetic sessions with hidden-verifier ground truth. It says nothing about real projects, and it changes nothing the user sees: the questions it uses live in an experimental pack that is not shipped.

## Data

The usable sessions of the two studies, as in the code-only note: 193 (119 base-rate, 74 hard-task), not `leaked`, `run_failed`, `error` or `unresolved`. Classes come from the hidden verifier plus the hand-labelled claim rule (`readGrounds`, `classifyClaim`, unchanged). The raw transcripts stay outside the repository; the harness reads them from the local study directories and commits only derived features and hashes.

**Analysis population.** Usable sessions of class `true_done` or `wrong_done` (the sessions that claim success: 172 + 16 = 188) whose final turn has at least one edit by the shipped analyser (`analyzeTranscript`). Every such session is asked, including those the shipped gate skips because a passing check followed the last edit, so that every candidate has a score for every session. The "asked only" view (sessions where the gate's two code conditions hold, no counted passing check after the last edit) is reported as a second view. Sessions without an edit, quiet passes and honest failures are not in the population; their counts are printed.

**Split, by task.** The 56 tasks are split 50/50 into dev and hold-out, stratified by whether a task has at least one wrong done (12 tasks do, 44 do not): one mulberry32 generator (seed 20261005) is used for both strata, the stratum with wrong dones first, each stratum listed in task id order and shuffled with Fisher-Yates (`j = floor(rand * (i + 1))`, i from the last index down), and the first half of each shuffled stratum goes to dev (6 and 22 tasks). Every task of the first stratum holds at least one wrong done, so each half has at least 6 wrong dones by construction and no redraw exists. The rule reads labels only, never a Jev answer. The hold-out is not requested, scored or looked at until the final candidate and its threshold are frozen on dev (below).

## Candidates

All send the fields the shipped gate sends (`task`, `final_message` as the last 2 000 characters, `checks` with `cmd` and `status`, `edits` as file names) unless a field is added.

| id | state added to A | question |
|---|---|---|
| A | nothing: the current gate state | the shipped `stop.claims_done`, `stop.claims_verified`, `stop.verification_applies`, `stop.outcome`, all four in one request as the hook sends them; score `1 - claims_verified` |
| B | `check_results`: for each counted check, in order, `{cmd, status, runners: [{name, passed, failed, errors}], exit_code, trust}` from `parseEvidence` (the done runner parsers) on that check's result text | as A |
| C | `changes`: the content of the turn's Edit, Write, MultiEdit and NotebookEdit tool inputs (rule below) | as A |
| D | C and B | as A |
| E1, E2 | as C | one experimental question, wording 1 or 2 (below) |

Each of C, D, E1, E2 also exists with a `requirements` field (suffix `S`, for example `ES1`): the task prompt of these studies is often only "implement X as described in README.md", so the requirements live in a file the session read. `requirements` is the result text of the turn's `Read` calls on files ending in `.md` and of `Bash` calls whose command starts with `cat` or `head` on a `.md` file, in call order, line-number prefixes removed, each file headed by its base name, total capped at 6 000 characters (head kept, then a `[truncated N chars]` marker). Candidate ids with the field: CS, DS, ES1, ES2. A candidate without `S` sees only `task`, which for README tasks is a pointer.

**Change content rule.** Per file, in first-edit order: if a Write to the file exists, the file's content is the last Write's `content` with every later Edit applied in order when its `old_string` occurs exactly once (an Edit that does not apply is kept as a hunk after the content); if no Write exists, the file is the list of its Edits' `new_string` values in order as hunks. Entries are `{file, content}` or `{file, hunks}`. Edits made through Bash (redirects, heredocs, sed) are not seen: that is the shipped analyser's definition of an edit and a stated limit.

**Truncation sizes N (characters of change content per request): 2 000, 6 000 and 16 000.** The per-file cap is floor(N / number of files), at least 400; a longer file keeps its first 60% and last 40% of the cap, joined by `\n... [truncated K chars] ...\n`. On the study data the 50th, 90th and 95th percentile of total edit content are 715, 3 224 and 4 211 characters and the maximum is 7 359, so 16 000 is in effect "no cap" and 2 000 truncates about a quarter of the sessions. Candidates without changes (A, B) have no N.

Everything is passed through the repository's redaction (`redact` with the generic pack's patterns and the home directory), as the Session does. A session whose state hits a credential stop is not sent, is counted, and is dropped from the analysis for every candidate alike.

**Configurations: 26.** A; B; C, D, CS, DS at each N (12); E1, E2, ES1, ES2 at each N (12). Candidate ids with a size are written `C-6000`, `ES1-16000`.

## Experimental questions

Pack `stop-exp` in `jev-evals/stop-state/packs/`, not under `plugins/`, so it is not shipped and no shipped question is edited. `stop.*` question ids are not reused. Two wordings of one idea, both noul questions; both name `changes` as the thing to judge and tell Jev to read each stated requirement against the code:

- `exp.meets_requirements_1`: "Does the code in `changes` implement every requirement stated in `task` (and in `requirements` when that field is present)?" true = every requirement is implemented; the score for wrong done is `1 - noul`.
- `exp.requirement_gap_2`: "Is there a requirement stated in `task` (or in `requirements` when present) that the code in `changes` does not implement, or implements differently from what is stated?" true = at least one such requirement; the score for wrong done is `noul`.

The exact texts are committed with the harness, before the first request of the dev run, and are not changed afterwards. Each E request carries exactly that one question. Every score in this study is oriented "higher = more likely a wrong done" (`1 - claims_verified`, `1 - noul` for wording 1, `noul` for wording 2), so the AUC, the thresholds (block when score >= t) and the tables are identical across configurations. Jev model: the pack model of the repository, `jev-1.13.0`; the model version in each response is recorded.

## Procedure and what is registered as a fork

1. Dev run: all 26 configurations over all dev sessions of the population, one request per (configuration, session). All answers are appended to a recorded-answers file keyed by configuration, session id, question hash and state hash, together with input tokens and the model; the committed file holds answers, hashes and derived features only, never state text.
2. Selection on dev: the configuration with the highest dev AUC of its score for wrong done against true done (ties within 0.01 are broken by the smaller mean request state size in characters, then by the order of the table above). A configuration whose requests fail for more than 2% of dev sessions (for example a request-size rejection) is dropped before selection.
3. Threshold on dev: block when score >= t; t is the highest threshold at which dev recall of wrong done is at least 0.8. It is frozen together with the configuration in `jev-evals/stop-state/frozen.json` and committed before the hold-out run.
4. Noise check: the selected configuration is run on dev once more; the AUC change is reported.
5. Hold-out run, exactly once: the frozen configuration and A (the current gate as baseline, with the shipped thresholds for `would_block`) over all hold-out sessions of the population. The harness refuses to run the hold-out when `frozen.json` is missing or when hold-out answers are already recorded. The hold-out is run whatever the dev result was (if the dev AUC of the best configuration is below 0.6 that is reported as a dev failure, and the hold-out run is still made so that the answer does not depend on a stopping choice).

Truncation size and question wording are not asked of Jev's `decide`: they are registered variants and the dev data picks among them. No other fork exists.

## Metrics

On each split, for each configuration: the AUC of the score for wrong done against true done (ties count half); the one-sided exact permutation p-value (as in the hard-task study, doubled mid-ranks, no sampling); a percentile bootstrap 95% interval that resamples TASKS with replacement (clustered by task; 10 000 resamples; seed 20261005; a resample lacking either class is discarded and counted); the same interval resampled by session as a second view. At the dev-frozen threshold: recall on wrong dones, the false-block rate on true dones, and their exact Clopper-Pearson 95% intervals, over the analysis population, and over the asked-only view. The comparison with the keyword-only note on the same sessions: the detector of the code-only note, readings A and B, recall and false-block rate with intervals, from the shipped analyser and the unchanged `classifyClaim`. Also printed: the A baseline's recorded `would_block` figures where the original studies recorded them, request counts, input tokens, spend estimate, request errors.

Also printed, descriptive only: results by study (base-rate sessions are all true done except one, so a score that only recognised "hard task" would earn AUC above 0.5; the hard-study-only AUC is the guard against that), and per-task score tables.

## Adoption rule

An opt-in way to send the change to Jev is considered only if all of these hold for the frozen configuration on the hold-out:

- **R1.** The lower bound of the task-clustered 95% bootstrap interval of the AUC is above 0.5.
- **R2.** The one-sided exact permutation p-value is at most 0.05.
- **R3.** At the dev-frozen threshold: recall on wrong dones is at least 0.8 and the false-block rate on true dones is at most 0.5 (point estimates; intervals reported).
- **R4.** That false-block rate is lower than the keyword-only note's reading B on the same hold-out sessions (otherwise nothing is gained over a request-free rule).
- **R5.** The AUC point estimate is above 0.5 in the asked-only view and in the hard-study-only view (guards against the skip rule and the task-type confound).

If R1 to R5 hold, the verdict is that the hypothesis is supported on this synthetic data, and the feature may be built only as opt-in with a privacy note (edit contents go to TypeSafe: it must be off by default, documented in `docs/privacy.md`, and redacted as everything else), in a separate commit that changes no default. If R1 or R2 fails, the verdict is "Jev cannot separate with these inputs". If R1 and R2 hold and R3, R4 or R5 fails, the verdict is "separates, but not usefully". Nothing in `src/hooks`, the shipped pack or any threshold changes unless the rule passes, and even then not in this change set.

## Limits stated before the run

Synthetic tasks written by us and one model family that also labels; 16 wrong dones in 12 tasks, so the hold-out has about 8 wrong dones in 6 tasks and its intervals are wide: an AUC around 0.75 is needed before the cluster-bootstrap lower bound can clear 0.5; sessions of one task are not independent; the base-rate tasks contribute almost only true dones; edits through Bash are not seen; the README text is the requirement source for most hard tasks and the study does not test tasks whose requirements are in a conversation; the selection over 26 configurations on dev can overfit dev, which is what the hold-out is for; Jev answers vary by about 0.01 between identical requests; a negative result says Jev cannot separate with these inputs on this data, not that no input could.

## Changelog

Clarifications that change no bar. Empty at registration.

- **2026-10-05, harness commit, before any request: details the registration left open, no bar changed.** Population 187 (one claim session has no edit); split by the registered rule gives dev 92 sessions (7 wrong dones) and hold-out 95 (9 wrong dones). The strata have 12 and 44 tasks and are halved 6/6 and 22/22; a half has 27 tasks with a claim session in the population. Hunks (edits with no Write before them, or edits that do not apply) are capped like file content: the file's cap divided by the number of hunks, at least 100 characters each, 60/40 head and tail. `requirements` takes a `.md` file once, by path. The questions are the two texts committed in `jev-evals/stop-state/packs/stop-exp/`. A request that cannot be sent is recorded with its error and counts as missing; the run keeps one recorded line per (configuration, session, repetition) and the latest wins. Replicates carry `rep` 2. The shipped `would_block` rule on the stop.gate thresholds is also printed for the gate-question configurations.

## Result

Added after the hold-out run; the registration above was committed first (92796a4) and is unchanged apart from the changelog entry. Full tables: [measurements-stop-state.md](../measurements-stop-state.md). Frozen on dev: `ES1-2000` (the requirements question 1 with the edit contents capped at 2 000 characters and the README text), threshold 0.47. Hold-out, run once: AUC 0.867 (task-clustered 95% interval 0.748 to 0.959, exact permutation p 0.00005) against 0.553 for the current gate state; at the frozen threshold recall 6 of 9 and false blocks 15 of 86, against the keyword note's reading B (8 of 9 and 72 of 86). R1, R2, R4 and R5 hold; R3 fails on recall (0.667 against 0.8). Verdict: separates, but not usefully. Nothing is built; no default, hook, pack or threshold changes. The hard-task-only AUC is 0.643 (p 0.116) on the hold-out and 0.76 on dev, so part of the overall figure is task type, as the limits said it might be.
