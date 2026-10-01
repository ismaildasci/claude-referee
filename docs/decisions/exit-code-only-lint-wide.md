# Wider cap for exit-code-only lint evidence

Decided 2026-10-01 with `decide`, after the [sixth hold-out](done-v2-holdout6.md) had 2 wrong `met` that the [narrow warning cap](exit-code-only-met.md) did not see.

**Question.** With `trust: exit_code` (an exit code line, no recognised runner) and a lint or clean criterion, should `met` always be capped at `unsure`, or only on a wider set of log wording?

**Measured (offline replay, throwaway script over every recorded `done-v2*` suite, 354 recorded answers, the repo's evidence parser, answers at p 0.7 or more).** Exit-code-only `met`: 40 cases, 33 true, 7 wrong. With a lint or clean criterion: 19 cases, 13 true, 6 wrong. The narrow cap already catches 5 of the 19 (1 true, 4 wrong). The 14 it missed are 12 true and 2 wrong (`h6-c-07` semgrep "partially analyzed", `h6-e-08` conftest `|| true`). Capping all would lose those 12 true `met` too (13 of 13 in total); it would make `met` unreachable for a lint tool without a parser. The third option, wording on the log (failure, skip, partial, error, violation, finding words with the command line, flags and negated phrases such as "0 errors" removed, and `|| true`, `--no-fail`, `--exit-zero`), catches both wrong cases and 3 true ones: `h4-e-07` (helm lint, "failed" in a harmless line), `h5-c-05` (markdownlint "Finding"), `h6-e-02` (`iac-lint.sh`, "findings: 0").

**Round 1** (receipt `rmups10owrnyc`): `keep` 0.19, `capall` 0.13, `capwide` 0.67; verdict `weak`, orders agreed. Not accepted (below 0.90).

**Round 2** (receipt `rmups17x4e8di`), after adding one fact (the word match runs on the log only; 9 of the 12 true cases stay `met`; the 3 lost become `unsure`, one extra step to pipe the linter summary; `capall` makes `met` unreachable for parserless lint tools): `keep` 0.04, `capall` 0.00, `capwide` 0.96; verdict `clear`, `order_disagrees: false`. Accepted under the p >= 0.90 bar. The CLI prints only the mean across both orders.

**Implemented.** `hasProblemMessage` in `src/cli/commands/done.ts`, joined to `hasWarningMessage` for exit-code-only evidence; same `reason: "warning_in_log"`. Test: `test/done.test.ts`.

**Replayed after the rule (not a new pass).** On the recorded answers it newly caps 5 cases: the 2 wrong (`h6-c-07`, `h6-e-08`) and 3 true. Replayed `done-v2-h6` has 0 wrong `met` instead of 2; its allowance stays 2 and every other allowance is unchanged. `eval score --suite all --fail-on violated` passes.

**Limits.** The rule is fitted to the h4 and h6 wrong cases, not a clean test: the word list was written after looking at those two logs, and the numbers above are measured on the data it was fitted to. It rests on invented outputs from one model family and one Jev version, and says nothing about the wording of tools not seen. `h6` stays a failed hold-out (registered check not met); nothing here changes the status "not measured". A real linter whose clean log contains one of the words, such as "failed" or "findings", will now give `unsure`.
