# Exit-only next step: say what to do for tools that print nothing on success

Registered 2026-10-09, before any code change. Chosen with `decide` among five candidates (o4 0.92, both orders agreeing, after one added fact separating it from the TypeSafe docs-watch option at 0.57; receipts `rmv0sinynm0co`, `rmv0siuvhm9qm`). Extends [exit-only-evidence.md](exit-only-evidence.md).

## Why

123 of the 242 `missing` `done` receipts in 4 days (aggregate, all projects) are `trust: exit_code`, about half of all `missing`. In the owner's gate scripts, a lint step whose tool prints nothing on success reaches `done` as an exit code line only, under a criterion such as "eslint reports 0 errors and exits with code 0", and is answered `missing` (p 0.27 to 0.48) although the tool exits 0 only when it found no errors. The exit-only next step added in 0.2.7-to-be says an exit code alone cannot show a criterion, but not what to do for a tool that has no output to pipe.

## The rule

The exit-only `next_step` gets one more sentence: if the tool prints nothing when it passes (`eslint`, `tsc`), word the criterion as its exit status, for example "eslint exits with code 0". Verdict, `p` and `reason` do not change; no new judgement in code.

## Bars

- **B1 (text only):** a test pins that `verdict`, `p`, `reason` and `evidence_lines` of an exit-only `missing` are unchanged and that `next_step` has the new sentence; other next steps are unchanged.
- **B2 (gates):** `npm run check` and `ci:local` green; the recorded evals score the same.
- **Report (not a bar):** after a release, the share of exit-only `missing` receipts in a week against the 123 of 242 above.

## Limits

- Whether Claude rewords the criterion after reading it is unmeasured, as for the weak `decide` text.
- An exit-status criterion proves the exit status only, as the README says.
