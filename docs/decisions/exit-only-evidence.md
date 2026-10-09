# Exit-code-only evidence: a next step and a size on the receipt

Registered 2026-10-09, before any code change. Second of the four usage fixes the owner approved in order ("tamam sırası ile yap bunları").

## Why

In the local receipts (4 days, all projects, aggregate counts), 242 of 722 `done` runs are `missing`. Most of those in sessions of the owner's other projects carry `trust: exit_code` with `p` between 0.03 and 0.49: the evidence held an exit code line and no output a runner parser recognised, so Jev saw an exit code and nothing that shows the criterion. The `next_step` for that case is the generic "Run the check that proves it and pipe its output in; the same evidence gives the same answer", which does not say that only an exit code was seen. Receipts also keep no size of the evidence, so a tiny evidence (the output was never piped) cannot be told from a large log no parser reads (a runner gap).

## The rule

- A `done` result that is `missing` with `trust: exit_code` and no other cap gets one specific `next_step`: only an exit code line was recognised, an exit code cannot show a criterion, pipe the check's output in front of the exit code line. Verdict, `p` and `reason` do not change.
- Every `done` result carries `evidence_lines`, the number of lines of the evidence (the same count already sent to Jev as `lines`). The receipt outcome copies it as a count. No text.

## Bars

- **B1 (verdict unchanged):** `eval score` over the recorded suites gives the same scores; a test pins that `verdict`, `p` and `reason` of an exit-code-only `missing` are the same as before.
- **B2 (next step):** an exit-code-only evidence that Jev answers `missing` gets the new text; a parsed `missing`, an `unsure` and an `exit_code_nonzero` keep their text.
- **B3 (size):** a `done` receipt's outcome has `evidence_lines` as an integer; other commands' outcomes have no such field; no receipt line holds evidence text.
- **B4 (privacy):** `docs/privacy.md` and the `done` contract name the field.
- **B5 (gates):** `npm run check` and `ci:local` green.
- **Report (not a bar):** from the next real runs, the share of `missing` + `exit_code` receipts with `evidence_lines` under 5 versus 5 or more.

## Limits

- The text cannot tell Claude which command to run; it only says what was seen.
- Whether the large exit-code-only logs are a runner gap is not known until `evidence_lines` has data.
