# done v2 on a third real-log sample: the second unseen test, and a negative result

Registered in [done-v2-real-logs-3.md](decisions/done-v2-real-logs-3.md) on 2026-10-15 (registration commit `f60b071`, one amendment `494ea06` before any case was labelled, see "Deviations"), before any run or job log of this sample was requested. Code frozen at `a8f3b83c11db531e5f38579ac38dd42fcee90c7c`: the plugin CLI, the redaction screen, `parseEvidence` and `doneRequest` ran from a `git archive` of that commit, built there and identical to the committed `plugins/` tree. Each model was recorded once (`jev-1.13.0`, receipt `rmv9zsbh2eoeb`; `jev-1.14.0`, receipt `rmv9zsbhzm7ac`); nothing was changed after the first answer. This file is not called `measurements-real-logs-3.md` because that name belongs to the [second look](measurements-real-logs-3.md) at the second sample.

**Result: negative on both models.** Wrong `met` on expected-`missing` sent cases: **6 of 83 on `jev-1.13.0` (the primary result), 4 of 83 on `jev-1.14.0`**; the bar is 0, and the second sample had 2 of 85. Four of the six are parsed logs (class R) and are identical on both models. `met` recall among parsed cases passes its bar on both: 69 of 76 = 0.908 (exact lower bound 0.819). `missing` recall fails: 0.470 and 0.554 against 0.9. The registered code-level check passed (108 cases, 0 violations). `done` v2 stays "not measured" on its original bar.

## Sample

| | Second sample (2026-10-05) | Third sample (fetched 2026-10-15) |
| --- | --- | --- |
| Runs | created at or after 2026-10-04T00:00Z | created at or after 2026-10-10T00:00Z |
| Repositories contributing cases | 126 (17 buckets) | 123 of 128 accepted (17 buckets: 13 of 8, Dart, Elixir, Scala and Shell of 6; 579 walked) |
| Overlap with earlier samples | the first sample's 94 repositories excluded | the repositories of both earlier samples excluded; 0 of 123 overlap (checked) |
| Cases after the failed-only top-up | | 270 (46 from failed steps = 17.0%) |
| Dropped before the suite | | 1 by the redaction screen (secret assignment), 8 `ambiguous`, 13 silent-output `met` |
| Kept | 272 (231 sent to Jev, 41 failed steps decided in code) | **248: 202 sent to Jev + 46 failed steps decided in code (all `missing`)** |
| Sent, by label | | 119 expected `met`, 83 expected `missing` |
| Criteria (sent) | | build 60 (49 `met`), lint 48 (19), test 94 (51) |
| Classes of the sent cases | R 108 of 231 parsed | R 111 (76 `met`, 35 `missing`), E 91 (43, 48), U 0 |
| Labellers | | labeller 1 on 223 succeeded steps (133 `met`, 83 `missing`, 7 `ambiguous`), blind labeller 2 on 90 (40%): agreement 0.967, kappa 0.938, 0 disagreements. Claude quota used: $8.74 over 63 calls |

`gh` made 11,668 calls in the walk that counts (`fetch.json`); 179 candidates were skipped as already used. Per-case rows, parsed facts and both models' answers are in [data/done-v2-real-3](data/done-v2-real-3); the evidence text is not.

## Registered bars, per model

| Registered bar | `jev-1.13.0` | `jev-1.14.0` | Verdict |
| --- | --- | --- | --- |
| 1. Wrong `met` = 0, pooled | **6 of 83** = 0.072 (exact 0.027 to 0.151; repository bootstrap 0.024 to 0.132) | **4 of 83** = 0.048 (0.013 to 0.119; 0.011 to 0.098) | **failed** on both |
| 1. class R | **4 of 35** = 0.114 (0.032 to 0.267) | **4 of 35** (same) | **failed** on both |
| 1. class E | 2 of 48 = 0.042 (0.005 to 0.143) | 0 of 48 (0 to 0.074) | failed on 1.13, met (weak) on 1.14 |
| 1. class U | n = 0 | n = 0 | not applicable |
| 2. `met` recall among R >= 0.9 (n = 76, evaluable) | 69 of 76 = **0.908** (0.819 to 0.962; bootstrap 0.835 to 0.973) | 69 of 76 (same) | passed on the point value; the interval includes values below 0.9 |
| 3. class E `met` recall, report only | 19 of 43 = 0.442 (0.291 to 0.601) | 17 of 43 = 0.395 (0.250 to 0.556) | reported |
| 3. `met` recall pooled, report only | 88 of 119 = 0.739 | 86 of 119 = 0.723 | reported |
| 3. Parsed coverage of sent, report only | 111 of 202 = 0.550 (0.478 to 0.619) | same | reported |
| 4. `missing` recall >= 0.9 (all sent) | **39 of 83 = 0.470** (0.359 to 0.583) | **46 of 83 = 0.554** (0.441 to 0.663) | **failed** on both |
| 4. same, class R / class E | 7 of 35 = 0.200 / 32 of 48 = 0.667 | 7 of 35 = 0.200 / 39 of 48 = 0.813 | |
| Code-level check (108 cases, no runner and no exit line, p = 1.0 must give `unsure`) | 0 violations | 0 violations | passed |

Verdict mix of the sent cases: `jev-1.13.0` 94 `met`, 59 `unsure`, 49 `missing`; `jev-1.14.0` 90 `met`, 51 `unsure`, 61 `missing`. Among expected-`missing` R cases (35) both models said 4 `met`, 24 `unsure` and 7 `missing`; the code let `met` through offline in exactly those 4 (the offline "`met` reachable" count), so the R wrong `met` are the code's, not the model's. The two models gave a different verdict on 18 of 202 cases: 16 in class E, 2 in class R (an `unsure` and a `missing` swapped). 1.14 turned more exit-code-only runs into `missing` (50 against 38 in class E) and said `met` less often there (17 against 21). That is a difference, reported as one: no model is chosen from it, and the package default and anything local are untouched.

## Against the second sample

| | Second sample (code of 0.2.1) | Third sample, `jev-1.13.0` | Third sample, `jev-1.14.0` |
| --- | --- | --- | --- |
| Wrong `met`, pooled | 2 of 85 | 6 of 83 | 4 of 83 |
| Wrong `met`, class R | 2 of 29 | 4 of 35 | 4 of 35 |
| Wrong `met`, class E | 0 of 56 | 2 of 48 | 0 of 48 |
| `met` recall among R | 69 of 79 = 0.873 | 69 of 76 = 0.908 | same |
| Class E `met` recall | 0 of 67 | 19 of 43 | 17 of 43 |
| `missing` recall | 45 of 85 = 0.529 | 39 of 83 = 0.470 | 46 of 83 = 0.554 |
| Parsed coverage of sent | 108 of 231 = 0.468 | 111 of 202 = 0.550 | same |

The code and the sample both changed between the two, so the rows are two measurements, not a trend. The part worth reading is that the R wrong-`met` rate did not measurably fall after the 0.2.2 to 0.2.8 fixes: 2 of 29 became 4 of 35 on new cases (the intervals overlap), mostly from causes the earlier fixes did not name.

## The six wrong `met`

In my words, no log text. "Label" is what the labellers wrote under the convention fixed in advance (`label.mjs`): for lint, any warning or notice in the output means `missing`; for tests, a project or file that did not run means the criterion is not shown.

| Case | Class | Jev p (1.13 / 1.14) | What the log shows | Why the code let it through |
| --- | --- | --- | --- | --- |
| `rl-068615bc` QL-Win/QuickLook, C#, build | R | 0.97 / 0.98 | an MSBuild run of the restore target only: packages restored, a success line, one warning, nothing compiled | the MSBuild parser reads the summary (passed 1, warnings 1); no cap for a restore-only run |
| `rl-afdc724c` browser-use/browser-use, Python, lint | R | 0.94 / 0.96 | `ruff check` limited to one rule family, preceded by a package-manager deprecation notice; ruff itself reports a clean run | the ruff parser reads the clean summary (warnings 0); the notice is the package manager's, not ruff's |
| `rl-fcaa19e3` jasontaylordev/CleanArchitecture, C#, test | R | 0.92 / 0.88 | five test projects: four ran and passed (39 tests), one reported that it found no test to run | the dotnet runner sums the per-project pass summaries and does not read the no-test message of the fifth project as an incomplete run |
| `rl-0a2ad9ba` railsadminteam/rails_admin, Ruby, lint | R | 0.96 / 0.98 | 520 files inspected, no offenses, after a plugin-migration deprecation notice from a rubocop extension | the rubocop parser reads the summary only; the fixed rule for rubocop is one other sentence ([rubocop-skip-warning](decisions/rubocop-skip-warning.md)) and did not cover this one |
| `rl-334269f7` bobthecow/psysh, PHP, lint | E, `jev-1.13.0` only (1.14: `unsure` 0.53) | 0.70 / 0.53 | phpstan human-format output ending in a no-errors line, after a long dependency install and a notice that the PHPStan version is old | the pretty format has no parser (only the agent JSON format), so Jev read it; p 0.70 is exactly the `done.met` band (`thresholds.json`) |
| `rl-471794f8` btwld/fvm, Dart, test | E, `jev-1.13.0` only (1.14: `missing` 0.46) | 0.70 / 0.46 | `dart test` of one named file, one test passed | no parser for `dart test`; the criterion is about the whole suite and the output shows one file |

Pattern: three of the six (`rl-afdc724c`, `rl-0a2ad9ba`, `rl-334269f7`) rest on a notice outside the tool's own result; two (`rl-068615bc`, `rl-fcaa19e3`) are a parsed summary that hides that part of the run did not happen; one (`rl-471794f8`) is a partial-scope run read as the whole. The rubocop case is the same family as the case the narrow rubocop rule was written for, and that rule did not generalise: a fix per sentence does not cover the class.

Two labels are open to challenge, and are described here as they are, not re-scored and not corrected: the first labeller's stated reason for `rl-334269f7` talks about tests on a lint criterion (the second labeller's label is the same, and the convention's notice clause covers the version banner); for `rl-471794f8` the stated reason (the full suite is not shown) is not in the written convention text. Two of the three notice cases (`rl-afdc724c`, `rl-0a2ad9ba`) concern a warning that is not a lint finding; the convention counts it anyway. No corrected number is given, because any is post hoc.

## Recall misses and backlog

Among the 76 parsed expected-`met` cases both models gave 69 `met`, 3 `unsure` and 4 `missing`; those seven were not analysed here. Tools without a parser are listed in [backlog.json](data/done-v2-real-3/backlog.json) (39 tools; most cases: `make` 10, `cmake --build` 10, `clang-tidy` 9, `shellcheck` 7, `ktlint` 5, `pre-commit` 5, `phpstan` 4, `docker build` 4, `make test` 4).

## Deviations and limits

- **Amendment 1, fetch fault.** The first walk (three processes by language group, 1508 repositories) returned 0 cases: gh 2.102.0 refuses a response with terminal escape sequences unless `--allow-escape-sequences` is passed, and the fetch script read that as an expired log for 17,525 of 19,575 job logs. The fault was found from counts only; no case, label or answer existed. The log request now passes the flag (the only change to `fetch3.mjs`), the first walk's records are kept locally and summarised in [faulty-walk.json](data/done-v2-real-3/faulty-walk.json), and the second walk is the sample. The runs window was left unchanged at 2026-10-10 and runs created after the first walk may be in it. Why the second sample's fetch did not hit this was not investigated.
- **Scoring script.** `score3.mjs` is `score2.mjs` with the registered bootstrap seed and nothing else.
- **Labels.** Both labellers are language models of the same family as the author; agreement 0.967 measures consistency, not correctness. No human labels. The convention that any notice makes a lint run `missing` decides three of the six wrong `met`.
- **Weak evidence.** 83 expected-`missing` cases, 35 in class R. A count of 4 of 35 has an exact upper bound of 0.267. Repositories are clustered (123 contribute); the bootstrap intervals above are over repositories.
- **Failed steps** (46) are decided in code and say nothing about reading.
- **Public Actions logs only,** popular recently pushed repositories, plain `run:` steps; a window of five days. A pass on this sample would have said nothing about tools absent from it.
- **No fix in this task.** Parser or rule changes made for these six cases are fitted to them. A clean claim after any fix needs a fourth sample fetched from runs created after 2026-10-15.

## What this says

On real CI logs of repositories nobody tuned the code for, `done` still lets a wrong `met` through: 4 to 7% of the cases where the output does not support the claim, 11% among the parsed ones. It returns `met` for about 74% of the cases where a reader would (88 of 119 on 1.13), and stays at `unsure` or `missing` on most of the rest, which is the safe direction. The remaining defects are specific and fixable one by one, but each of the three samples has found causes the earlier ones did not, so one more round of fixes would again score as fitted until a fresh sample says otherwise. My reading, not a measured claim: `done` is a second pair of eyes that catches most failures, not proof that a run was clean.

## Files

`docs/data/done-v2-real-3/`: `table-jev-1.13.0.jsonl`, `table-jev-1.14.0.jsonl` (one row per kept case, no text), `recorded-jev-1.13.0.jsonl`, `recorded-jev-1.14.0.jsonl` (Jev's answers by case and hashes), `score-jev-1.13.0.json`, `score-jev-1.14.0.json`, `repos.json` (all 579 walked repositories: bucket, licence, stars, run counts, case ids), `fetch.json`, `faulty-walk.json`, `prepare.json`, `assemble.json`, `backlog.json`, `parsed-runners.json`. Scripts: `scripts/real-ci/` (`fetch3.mjs`, `score3.mjs`, the rest unchanged).
