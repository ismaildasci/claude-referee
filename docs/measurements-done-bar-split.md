# done v2 under the split bar: a post hoc rescoring, not a pass

Registered in [done-bar-split.md](decisions/done-bar-split.md) on 2026-10-02, before any number below was computed. This is a **re-definition of the success bar after six failed registered checks**. `done` v2 stays "not measured" on the old bar. Everything here rescoring old data is **post hoc and not a pass**: the parsers and caps that decide the classes were written after looking at these cases, so the numbers describe the current code on its own development history, not unseen output.

Reproduce: `node scripts/done-bar/rescore.mjs && node scripts/done-bar/split.mjs && node scripts/done-bar/report.mjs` (offline, no request, no key). Per-case rows without text: `docs/data/done-bar-split/cases.jsonl`; summary: `docs/data/done-bar-split/summary.json`.

## What was scored

- **Classes** by the repository's own `parseEvidence(doneEvidence(text)).trust`: **R** parsed by a recognised runner, **E** only an exit code line, **U** neither (`met` is impossible by design).
- **Hold-outs 2 to 6** (`done-v2-h2` to `done-v2-h6`): the cases that remain in those suites (cases that moved to `done-v2` as dev after parsers were written are not in them; `done-v2` itself is dev plus the first hold-out and is not scored here). 209 cases. The parser regression group `done-v2-h6p` (8 cases) is reported apart, never in the pooled counts.
- **Recorded answers** replayed through current code (`doneRequest`), used only when the question and state hashes match, as `eval score` requires: **0 stale, 0 missing** in all six suites. Code-decided cases (non-zero exit, Jev never asked) are counted apart and in no denominator.
- **Clusters:** the same step with and without the exit code line is one case. Cases merged by clustering: **0** (no such pair exists in these sets); in the real-log sample all 229 `(repo, job, step)` keys are distinct.
- **Labels** are from model processes (hold-outs: a writer agent and a second labelling agent, hold-out 5 one author-labeller; real logs: two `claude -p` processes, kappa 0.966 on a 30% re-label). No human labelled anything. Labels were not changed after answers were seen.

## Cases per class and suite

| Suite | Cases | R | E | U | Code-decided | Sent | Unusable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `done-v2-h2` | 40 | 29 | 5 | 6 | 11 | 29 | 0 |
| `done-v2-h3` | 36 | 25 | 6 | 5 | 15 | 21 | 0 |
| `done-v2-h4` | 45 | 13 | 29 | 3 | 14 | 31 | 0 |
| `done-v2-h5` | 35 | 11 | 23 | 1 | 18 | 17 | 0 |
| `done-v2-h6` | 53 | 2 | 47 | 4 | 14 | 39 | 0 |
| h2 to h6 pooled | 209 | 80 | 110 | 19 | 72 | 137 | 0 |
| `done-v2-h6p` (apart) | 8 | 8 | 0 | 0 | 0 | 8 | 0 |

Hold-out 2 was written for tools the first parsers cover (its record lists pytest, go, cargo, jest, vitest, mocha, PHPUnit, RSpec, eslint, ruff and others); 4 to 6 deliberately picked tools without parsers and are mostly E. The class mix therefore follows how each set was written, not a population.

## Result per class, pooled hold-outs 2 to 6 (current caps, recorded answers)

| Class | Sent clusters | Expected met | Expected missing | Wrong met (upper 95% one-sided) | Missing found | Met found |
| --- | --- | --- | --- | --- | --- | --- |
| R | 47 | 30 | 17 | 0 of 17 (16.2%) | 15 of 17 (88.2%; 63.6% to 98.5%) | 23 of 30 (76.7%; 57.7% to 90.1%) |
| E | 71 | 49 | 22 | 0 of 22 (12.7%) | 13 of 22 (59.1%; 36.4% to 79.3%) | 26 of 49 (53.1%; 38.3% to 67.5%) |
| U | 19 | 1 | 18 | 0 of 18 (15.3%) | 15 of 18 (83.3%; 58.6% to 96.4%) | 0 of 1 |
| all | 137 | 80 | 57 | 0 of 57 (5.1%) | 43 of 57 (75.4%; 62.2% to 85.9%) | 49 of 80 (61.3%; 49.7% to 71.9%) |

Against the registered bar, descriptively:

1. **Wrong `met` is 0 in every class**, but this is the weakest line. The caps that make it 0 (warning and notice, failure and skip wording, `|| true`, skipped tests, no-tests) were written after the wrong cases of these same sets were seen; the unparsed rule predates them and is by design. **Before the caps the judge's answers gave 9 wrong `met` among 57 expected-`missing` clusters** (R 1, E 6, U 2; the table below), so 0 is the cap's result on its own training cases, not a finding about new logs. Upper bounds are wide for the same reason as always: 12.7% for 0 of 22 in E.
2. **`missing` recall 0.754, below 0.9: the pooled bar fails.** All 14 misses are `unsure`, none `met`. By class: R 0.88, U 0.83, E 0.59.
3. **R `met` recall 23 of 30 (0.767): evaluable only because n is exactly the minimum of 30, and below 0.9.** Seven misses: three are `unsure` from the skipped-tests cap on runs that print skipped tests but were labelled `met` under the older labelling of hold-outs 2 and 3 (`h2-b-01` 1 skipped, `h2-e-04` 2 skipped, `h3-a-02` unittest `OK (skipped=2)`); the convention since hold-out 4 says skipped tests make "all tests pass" not shown, which is what the code does. Labels were left as they were; reading those three as `missing` would give 23 of 27 (0.85), still below 0.9. The other four: `h2-f-04` and `h2-f-05` (`unsure`, 0.63 and 0.56), `h3-a-07` (`unsure`, 0.64) and `h3-b-01` (`lint is clean`, `missing`, 0.25).
4. **E `met` recall 0.53, no bar.** By criterion, expected-`met` E cases: "all tests pass" 0 of 18 (11 `missing`, 7 `unsure`; the exit code does not show tests ran), build 14 of 15, lint 8 of 12 (4 `unsure` from the lint caps), typecheck 4 of 4. This is the trade the lint caps make on purpose.
5. **U is coverage only:** 19 of 137 sent clusters (13.9%) have neither a runner nor an exit code line, 1 of them expected `met`. In the real-log sample U is empty by construction, because the study appends the exit code line.

### Raw `met` answers that code caps turned into `unsure` (pooled h2 to h6)

| Case | Class | Expected | Cap |
| --- | --- | --- | --- |
| h2-b-01, h2-e-04, h3-a-02 | R | met | `skipped_tests` |
| h3-e-04 | R | missing | `skipped_tests` |
| h2-c-04 | U | met | unparsed |
| h3-c-03, h6-e-03 | U | missing | unparsed |
| h4-e-07, h5-c-05, h6-c-08, h6-e-02 | E | met | `warning_in_log` |
| h4-d-03, h5-c-03, h6-c-06, h6-c-07, h6-c-10, h6-e-08 | E | missing | `warning_in_log` |

17 cases: 9 expected `missing` (the wrong `met` prevented) and 8 expected `met` (the recall paid). The E and U rows are the lint-wide cap and the unparsed rule doing the trade the registration describes.

### Per suite (same columns; one-line reading)

| Suite | R: wrong met, met found | E: wrong met, met found | U: wrong met | Missing found, all |
| --- | --- | --- | --- | --- |
| h2 | 0 of 9, 7 of 11 | 0 of 0, 2 of 3 | 0 of 5 | 13 of 14 |
| h3 | 0 of 3, 6 of 9 | 0 of 1, 3 of 3 | 0 of 5 | 7 of 9 |
| h4 | 0 of 3, 5 of 5 | 0 of 5, 6 of 15 | 0 of 3 | 7 of 11 |
| h5 | 0 of 2, 4 of 4 | 0 of 3, 6 of 7 | 0 of 1 | 4 of 6 |
| h6 | 0 of 0, 1 of 1 | 0 of 13, 9 of 21 | 0 of 4 | 12 of 17 |

Per-class counts per suite are small (0 to 20 clusters), so no per-suite figure supports a claim by itself; the full per-suite tables are in `summary.json`.

### Parser regression group `done-v2-h6p` (apart)

8 cases, all R: wrong `met` 0 of 3, `met` found 4 of 5, `missing` found 1 of 3 (the other two are `unsure` from the skipped and warning caps). Eight cases carry no recall verdict; seven of the eight texts are invented from memory of the tools' formats.

## Real-log sample, code-level only (no Jev answers exist)

229 cases from 94 repositories: 82 R, 147 E, **0 U**; 30 code-decided (14 R, 16 E, all `missing`), 199 sent. Wrong `met` and `met` recall are **not scored** for this sample. What the caps alone allow if the judge answered p = 1 (`met` reachable):

| Part | Class | Cases | Code-decided | Sent | Expected met | Expected missing | Met reachable among expected met | Met reachable among expected missing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| all | R | 82 | 14 | 68 | 44 | 24 | 42 | 7 |
| all | E | 147 | 16 | 131 | 79 | 52 | 74 | 43 |
| all | U | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| dev | R | 40 | 11 | 29 | 16 | 13 | 16 | 4 |
| dev | E | 84 | 11 | 73 | 43 | 30 | 43 | 25 |
| holdout | R | 42 | 3 | 39 | 28 | 11 | 26 | 3 |
| holdout | E | 63 | 5 | 58 | 36 | 22 | 31 | 18 |

(Full table, with totals: `node scripts/done-bar/report.mjs`; `docs/data/done-v2-real/classes.json`.)

The exposure the bar is about is the E row: of 52 expected-`missing` exit-code-only steps, 43 can still reach `met` through the judge alone; of the 24 expected-`missing` R steps, 7. Those are the cases bar 1 would test once answers are recorded.

### Split of the real-log sample (frozen)

By repository, seed `done-bar-split-v1`, even positions dev and odd positions hold-out within each language bucket (rule and ratio decision in the registration: ratio fork put to `decide`, below the 0.90 bar, conservative half and half). Files: `docs/data/done-v2-real/split.json`, `backlog-dev.json`.

| | Repositories | Cases | Sent | Expected met, R |
| --- | --- | --- | --- | --- |
| dev | 48 | 124 | 102 | 16 |
| hold-out | 46 | 105 | 97 | 28 |

Hold-out SHA-256 of the sorted case-id list: `9d1e9e4e7c6baa71188a41ef4103b79d414c38757c67f806f243d4eecaccbbf9`.

**Correction to the registration.** It estimated "about 22" parsed expected-`met` cases in the hold-out; the actual figure is **28**. It is still below 30, so the conclusion stands: **bar 3 (R `met` recall) is not evaluable on this hold-out** (n = 28). The estimate was written before the split was computed and was wrong; the number above is the one to read.

**This hold-out is not clean.** The whole-sample parser backlog was published before the split ([measurements-real-logs.md](measurements-real-logs.md)), and six parsed-tool misses of the sample were read in the text, so tool names of the hold-out were already seen. The split protects the future: parsers are to be written from `backlog-dev.json` and dev text only, and the hold-out text is not to be read for that. A fresh real-log sample split before any parser is written is the clean test.

### Parser backlog from dev only

`docs/data/done-v2-real/backlog-dev.json`: 31 unparsed tool labels over 84 dev cases (the whole-sample backlog had 44 labels over 147). Same ranking as before (expected-`met` cases, then cases, then repositories); like the whole-sample backlog it counts code-decided failed steps too. Top rows:

| Tool | Criterion | Cases | Expected met | Repos |
| --- | --- | --- | --- | --- |
| `cmake build` | build | 12 | 5 | 4 |
| `dotnet build` | build | 5 | 5 | 4 |
| `swift test` | test | 6 | 4 | 4 |
| `swift build` | build | 5 | 3 | 2 |
| `make` | build | 3 | 3 | 3 |
| `dotnet test` (a parser exists; the VSTest summary is not recognised) | test | 3 | 3 | 1 |
| `npm build` | build | 3 | 3 | 1 |
| `make test` | test | 5 | 2 | 4 |
| `maven build` | build | 3 | 2 | 2 |
| `npm build -> build` | build | 3 | 2 | 2 |
| `docker build` | build | 2 | 2 | 2 |
| `ruff` (a parser exists; clean `uv run` output has no summary) | lint | 5 | 1 | 2 |

No parser was added.

## What this shows and does not

- The split makes the structure visible: R is where recall can be asked for (0.77 on 30 post hoc clusters), E is where the lint caps trade recall for wrong `met` (0.53 `met` found, 0 wrong after caps, 6 wrong before), U carries only a coverage number.
- It does **not** show that `done` v2 meets the bar: wrong `met` 0 is the caps' result on their own training data, the pooled `missing` recall (0.754) fails, R recall fails, nothing was scored on unseen output, and the real-log sample has no judge answers.
- Next, in order: record the real-log answers (`eval record --suite done-v2-real`), score the dev and hold-out parts with the class tables (`scripts/real-ci/score.mjs` plus the class split), and run the registered check on a fresh sample split in advance.

## Limits

Model-labelled data (no human), invented outputs in five of the six hold-outs, one Jev model version, caps and parsers fitted to these cases, class membership depends on the parser set at the time of scoring, small per-class counts, E and U rows of the old sets chosen by their writers to be tools without parsers.
