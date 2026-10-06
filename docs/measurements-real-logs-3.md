# done v2 after three parsers: dev and a frozen hold-out of the second real-log sample (a second look)

Registered in [real-logs-2-split.md](decisions/real-logs-2-split.md) (commit `a1b2a5a`) before any parser; parsers in [real-logs-2-parsers.md](decisions/real-logs-2-parsers.md) (code commit `3bdce9f`, the commit named before the first hold-out request). **The hold-out half is a second look at the sample of the [second real-log test](measurements-real-logs-2.md), whose aggregate bars were already seen: it is not an unseen test, and `done` v2 stays "not measured" on its original bar.** A clean unseen test needs a third sample, fetched and split in advance (a later task). Dev numbers after the parsers are fitted. Labels are model labels (two `claude -p` processes, no human); one Jev model (`jev-1.13.0`).

## Result

Before = main at 0.2.2 (code of `after-parser-fixes`, recorded answers); after = `3bdce9f`, hold-out recorded once (8 requests, 1 cache hit, receipt `rmuw8hgj66uer`), no code or rule change after the first answer. Sent cases only (code-decided failed steps excluded). Exact two-sided 95% Clopper-Pearson, then the repository-level bootstrap (B = 2000, resampling repositories, seed `sha256("real-logs-2-split-boot")`).

| Half | Metric | Before | After |
| --- | --- | --- | --- |
| Hold-out (62 repositories, 115 sent) | Wrong `met` | 0 of 52 (one-sided bound 5.6%; repository-clustered 0 of 38, 7.6%) | **1 of 52** (1.9%; exact 0 to 10.3%; bootstrap 0 to 6.0%; one-sided bound 8.8%; repository-clustered 1 of 38, bound 11.9%) |
| | `met` recall among parsed | 23 of 29 = 0.793 (0.603 to 0.920; bootstrap 0.655 to 0.926) | **26 of 35 = 0.743** (0.567 to 0.875; bootstrap 0.622 to 0.862) |
| | Parsed coverage | 48 of 115 = 0.417 (0.326 to 0.513; bootstrap 0.310 to 0.527) | **57 of 115 = 0.496** (0.401 to 0.590; bootstrap 0.380 to 0.608) |
| | Verdicts `met` / `missing` / `unsure` | 23 / 48 / 44 | 27 / 43 / 45 |
| Dev, fitted (64 repositories, 116 sent) | Wrong `met` | 0 of 33 (bound 8.7%; clustered 0 of 26, 10.9%) | 0 of 33 (unchanged) |
| | `met` recall among parsed | 46 of 50 = 0.920 (0.808 to 0.978) | 50 of 54 = 0.926 (0.821 to 0.979; bootstrap 0.854 to 0.982), **fitted** |
| | Parsed coverage | 60 of 116 = 0.517 (0.423 to 0.611) | 66 of 116 = 0.569 (0.474 to 0.661), **fitted** |
| | Verdicts | 46 / 37 / 33 | 50 / 32 / 34 |
| Both halves | Wrong `met` / recall among parsed / coverage | 0 of 85 / 69 of 79 = 0.873 / 108 of 231 = 0.468 | 1 of 85 / 76 of 89 = 0.854 / 123 of 231 = 0.532 |

What this says. On the hold-out, parsed coverage rose by 8 points (9 cases that were exit-code-only are now read), but one of them is a **wrong `met`** and `met` recall among parsed fell, because the new parsers also read three expected-`met` logs they then treat as incomplete. The hold-out wrong-`met` bound after is 8.8% (one-sided) over 52 negatives, which is weak evidence in both directions; the repository-level interval includes zero. Nothing about this is a pass of any registered bar of the earlier studies; the hold-out recall (0.743, n = 35) is below 0.9 and the interval does not include 0.9.

### The hold-out wrong `met` (analysed after scoring, not fixed in this task)

`rl-2160ff01` (`rubocop/rubocop`, criterion "lint is clean", Jev p 0.96, labelled `missing` by both labellers). The log opens with a rubocop message that a configured cop needs a gem that is not installed and that "analyses that use the project index will be skipped", then `1769 files inspected, no offenses detected`. The `rubocop` parser counts `Warning:`, `Notice:` and deprecation lines as warnings (which cap a lint criterion) and did not recognise this wording, so the facts read as a clean run. The parser was written from three dev logs and none has such a preamble. The defect class (a skipped analysis announced in plain words before the summary) is the same one the exit-code-only caps address with word lists; no fix was made, per the registration.

### Recall misses among the newly read hold-out logs

Two hold-out `ctest` logs print a summary without a failed count (`100% tests passed out of N`), and one hold-out `mix test` log prints `Result: 105 passed` with no parenthesis; formats absent from the dev half. Both parsers treat an unknown summary as incomplete, so the three expected-`met` cases stay unread (`missing` 0.03, 0.03, 0.04, none `met`). That is the cost of anchoring on the dev shapes, and exactly what a hold-out should show. Not fixed.

## Rows that changed

Replay of both real-log tables (501 rows) with the recorded answers; old code reproduces the committed tables, the new code changes 24 rows, all of them logs of `mix test`, `ctest` or `rubocop` (no cross-tool claim). Full list with facts in `docs/data/done-v2-real-2/after-new-parsers/changed-rows.txt`.

| Sample | Half | Cases | Change |
| --- | --- | --- | --- |
| 2 | dev | `rl-3cee1e31`, `rl-46863d59` (rubocop, `met`) | `missing` 0.24 to `met` 0.97, 0.96 (480 and 464 files) |
| 2 | dev | `rl-366fd752`, `rl-c0d94234` (mix test, `met`) | `missing` to `met` 0.97 (65 and 1534 passed) |
| 2 | dev | `rl-1c15d067` (mix test, `missing`, 41 excluded), `rl-d9cb56b3` (0 tests, `incomplete`) | `missing` to `unsure` (`skipped_tests`, 0.91), `missing` 0.03 |
| 2 | dev | `rl-4378dcb8`, `rl-fe7279ef`, `rl-ad4a555c`, `rl-bbbd7b41` (ctest, failed) | facts now read (failed 1 to 4), verdict unchanged: code-decided `missing` |
| 2 | hold-out | `rl-3e2ef7a0`, `rl-4f87a185` (mix test), `rl-4905fd08` (ctest 22 passed), all `met` | `missing` ~0.25 to `met` 0.97, 0.97, 0.98 |
| 2 | hold-out | `rl-03cd6fd4` (mix test), `rl-3469b7da`, `rl-e39c7f5b` (ctest), all `met` | read as incomplete, `missing` 0.04, 0.03, 0.03 (unknown summary form) |
| 2 | hold-out | `rl-83dac9dc` (mix test, `missing`, 56 excluded), `rl-a864ba87` (mix, `missing`, 1 error, incomplete) | `unsure` 0.88 (`skipped_tests`), `missing` 0.02 |
| 2 | hold-out | `rl-535e29af` (ctest, failed) | facts read, code-decided `missing` unchanged |
| 2 | hold-out | `rl-2160ff01` (rubocop, `missing`) | `missing` 0.23 to **`met` 0.96: the wrong `met`** |
| 1 | dev data | `rl-a50cea6a` (rubocop, `met`) | `missing` to `met` 0.96 |
| 1 | dev data | `rl-5d565b76` (`met`), `rl-0da9b215` (`missing`) rubocop | `missing` to `unsure` (`warning_in_log`, 0.95) |
| 1 | dev data | `rl-3fbd2582` (ctest, `missing`) | read as incomplete, still `missing` |

Synthetic suites: `done-v2-h3` (`h3-c-02`, `h3-c-06`, rubocop) and `done-v2-h4` (`h4-b-01`, `h4-b-04`, `h4-d-03`, ctest and rubocop) changed their facts and were re-recorded (5 requests, receipts `rmuw8d4rc17tc`, `rmuw8exa2enuc`). The only verdict count that moved: `done-v2-h4` `met` 12 to 13 and `unsure` 11 to 10 (one expected-`met` ctest log now read); wrong `met` 0 in every suite and every `max_wrong_positive` unchanged. A discarded draft of a `cmake` parser had made 4 recordings (receipt `rmuw8d5bpxrf9`), reverted with it.

Requests and receipts of this task: dev re-recording 6 (`rmuw8h26mp2ep`), hold-out 8 plus 1 cache hit (`rmuw8hgj66uer`), sample 1 re-recording 4 (`rmuw8ha1n6as1`), synthetic 5, discarded draft 4, two `decide` forks of 2 requests each (`rmuw8e7miq4py` excluded tests: cap 0.72 / ignore 0.26 / fail 0.01, weak, conservative option taken; `rmuw8eejzcqpq` cmake parser: write 0.06 / skip 0.94, orders agreeing, skipped).

## Does the done clip hide failures? (dev rows only, descriptive; the clip is unchanged)

The clip keeps the first 2,000 and last 12,000 characters. Dev sent cases of the second sample, by whether the clip cut anything (`chars_cut > 0`), after the parsers (`docs/data/done-v2-real-2/after-new-parsers/clip-dev.json`):

| Clip | Expected `met` | Expected `missing` |
| --- | --- | --- |
| nothing cut | 50 cases: 30 `met`, 12 `missing`, 8 `unsure` | 25 cases: 0 `met`, 15 `missing`, 10 `unsure` |
| cut | 33 cases: 20 `met`, 4 `missing`, 9 `unsure` | 8 cases: 0 `met`, 1 `missing`, 7 `unsure` |

No wrong `met` in either group (0 of 25 uncut, 0 of 8 cut). Among the 8 cut negatives, 5 have a failure-looking line (`FAIL`, `error:`, `***`, `not ok` and similar, a rough pattern) in the omitted middle, and in 2 of them (`rl-9f72dd78`, `rl-f4bd3e27`) there is none in the shown part: both were answered `unsure`, never `met`. So in this sample the clip hid failure evidence from the judge in 2 of 8 cut negatives and no wrong verdict resulted, but n is 8 and the cut negatives are mostly code-light logs; this does not show the clip is safe. Recall of `met` is similar with and without a cut (20 of 33 = 0.61 and 30 of 50 = 0.60). A cut parsed log is not treated differently by the code. Not changed in this task.

## Limits

- A second look, not an unseen test (above). The tool names of the backlog and the aggregate bars were published before the split; two parsers had been fitted to two cases of the sample.
- One wrong `met` among 52 negatives is not a rate; the clustered bound is 11.9%. The hold-out has 35 parsed expected-`met` cases (the earlier registrations ask for 30 for a recall verdict; no verdict is drawn here).
- Hold-out text was read only after scoring, for the three analyses above; no parser was changed afterwards. Facts of hold-out rows (counts, no text) were printed during the replay before scoring, as registered.
- `cmake --build`, `make`, wrapper builds, `phpstan` and `xcodebuild` were not written (reasons in the parsers decision), so the largest backlog items are untouched; clippy, checkstyle, maven build and cargo test recall misses are untouched.
- Data without log text: `docs/data/done-v2-real-2/after-new-parsers/` (tables of both samples, recordings, halves before and after, changed rows, clip counts); `node scripts/real-ci/halves2.mjs TABLE.jsonl` reproduces the half numbers from a table.
