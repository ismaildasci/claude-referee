# Should an exit code alone ever give met in done

Decided 2026-10-01 with `decide`, after the [fourth hold-out](done-v2-holdout4.md) left this question open.

**Question.** With evidence that has an exit code line of 0 but no recognised runner summary (`trust: exit_code`), may `done` answer `met`?

**Evidence (offline replay of the recorded answers of `done-v2` and its three hold-outs, current parsers).** 17 cases were answered `met` at p 0.7 or more on an exit code alone: 15 true (silent `tsc` and `eslint`, a CMake and a webpack build with warnings under "the build succeeds", `mypy` with notes, `stylelint` with 0 problems) and 2 wrong: `h4-d-03` (`rubocop` with a baseline notice under "lint is clean", p 0.91) and `h4-a-04` (`sbt` "No tests to run", p 0.72), which the no-tests cap already turns into `unsure`. That leaves the 16 this decision is about (15 true, 1 wrong). The 15 are 24% of the 62 true `met` found (p 0.7 or more, any trust level). Recount by script over `jev-evals/done-v2*/recorded.jsonl`, 187 recorded cases.

**Round 1** (receipt `rmupoeo0enpqb`): keep the rule 0.45, cap all exit-code-only `met` 0.15, cap on warning words 0.39 (means of the two orders). Verdict `tie`, the two orders disagreed (keep led one, warning words the other): not accepted. Capping everything would cost 15 true `met` for one prevented wrong one; a warning-word match (`warning`, `notice`, `deprecat*`) would hit 5 of the 15 true `met` (including the two `--max-warnings` and "0 problems" cases) plus the wrong one.

**Round 2** (receipt `rmupoeuvh22p8`), after adding one fact and one option: the only case where the criterion is about lint or being clean and the log really shows a warning or notice is the wrong one; the `--max-warnings` flag in the two true lint cases is not a message. New option `caplint`: cap at `unsure` only for exit-code-only evidence, a lint or clean criterion, and a warning or notice message in the log (flags and "0 warnings" do not count). Result (means of the two orders): `caplint` 0.91 (0.91 and 0.92), keep 0.06, cap all 0.02, warning words 0.00 to 0.01; both orders agreed, verdict `clear`. Accepted under the p >= 0.90 bar.

**Replay of the implemented rule.** 1 of the 16 exit-code-only `met` answers is capped (`h4-d-03`, the wrong one); 0 true `met` are lost (15 of 15 stay). `eval score --suite all --fail-on violated` passes.

**Decision.** An exit code alone may give `met` for build, typecheck, test and other criteria. It may not for a lint or clean criterion when the log shows a warning or notice: `unsure` with `reason: "warning_in_log"`. A cap on all exit-code-only `met` and the plain warning-words cap are not applied.

**Limits.** `caplint` was derived from the one wrong case, so the 0 lost and 1 prevented are measured on the data it was fitted to; Jev's p says nothing about new tools. Same model family writes and labels the cases; invented outputs; one Jev model version. `h4-d-03` stays in the hold-out (the suite allowance of 1 is unchanged, the observed wrong `met` is now 0), so the hold-out is not a clean test of this rule. `done` v2 is still not called measured: no hold-out has passed its registered check.
