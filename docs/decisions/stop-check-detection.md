# Should the Stop gate count more of Claude's own verification runs

Decided 2026-10-02 with `decide`, after the [session study](session-base-rate.md) showed the gate asks about 100 stops and would block all of them.

**Question.** The asked set is defined by "no check the analyser recognises passed after the last edit", so `checks` sent to Jev is `[]` in 90 of 100 asked stops and Jev answers a question the code already answered. Should the code change what counts as a check, or what is sent?

**Evidence (replay on the study data; fitted, not a clean test; the wrong "done" is n=1).** Of 99 asked true-done sessions: 45 ran no Bash, 5 ran only `ls`, `find`, `cat` or `git`, 49 ran their own code (24 `node -e` or `python3 -c`, 24 heredocs, 3 script files, 2 `node --test`). Only 4 of the 49 have output a runner parser recognises. The 10 asked sessions that had a counted check all show `python -m pytest` denied with "This command requires approval", which `rawStatus` sends as `failed`; none is a real test failure. The one wrong "done" (`p-titlecase__haiku__r4`) ran a failing probe and then a value-only probe that exited 0.

| Option | True-done skipped by code | Wrong "done" |
|---|---|---|
| a1: count own test-file runs whose output a runner parser recognises | 4 | still asked and blocked |
| a2: count any exit-0 own-code run on an edited file | 45 | asked only through a clause fitted to that session; 47 skips without it lose it |
| b: keep asking, send a parsed per-run summary | 0 (Jev unblocks 47) | unblocked (0.91), lost |
| nothing | 0 | blocked |

a2 trusts unparsed output, which the injection rule forbids for `done`. b lets Jev read a failed probe followed by a passing one as verified. Even a2 leaves 54 of 99 correct sessions blocked: they ran nothing, which a wrong "done" also looks like.

**Round 1** (receipt `rmuqa1bqv69x6`): a1 0.27, a2 0.13, b 0.13, nothing 0.46. Verdict `weak`, orders agree, lean nothing.

**Round 2** (receipt `rmuqa1m6s0533`), after five added facts (the gate runs only in shadow or soft; no option improves wrong-"done" detection on this data; the injection rule; a1 touches 4 of 99; the denial mislabel is a separate defect): a1 0.46, a2 0.01, b 0.01, nothing 0.51. Verdict `tie`, orders disagree. The p >= 0.90 bar with both orders agreeing is not met.

**Decision.** Conservative option: change nothing in the gate logic. a2 and b are effectively rejected (0.01); a1 stays open as a separate call because it is the only change that does not trust unparsed text, and it helps 4 of 99. The gate is documented as a claim-without-counted-check detector, not a correctness detector.

**Not decided here.** The denied-command mislabel (a permission denial reported as `failed`) is small and verified, but it does not change Jev's answers (`claims_verified` 0.03-0.04 becomes 0.04-0.06, all still blocked). It can be fixed under any option. Fixed afterwards: such a result is now its own status `denied` (see the changelog), still never a pass; no recorded Stop eval case contained a denial, so no recorded answer changed.

**Limits.** Replays use about 330 Jev requests on fitted rules; one wrong "done"; "exit 0" is inferred from `is_error == false`; same model family writes and labels; one Jev model version. The `jev-evals/stop-study` allowances are unchanged.
