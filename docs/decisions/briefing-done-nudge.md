# A one-line nudge in the briefing: run the checks before saying done

Registered 2026-10-09, before any code change. Chosen with `decide` among four candidates (o1 0.89, then 1.00 after one added fact separating it from the cap-only option; both orders agreeing; receipts `rmv0vusvzxcf7`, `rmv0vv0aiag6k`).

## Why

The owner asked why Claude does not ask Jev often just because the plugin is configured. The code answer: the SessionStart briefing is advice and the Stop gate is `shadow` (records, never prints). The README says a check that does not run by itself barely exists, and measured one `done` run in 14 days before the briefing pointed to it. On this machine, since turns are recorded (0.2.5), 52 of 124 turns had edits and 28 of those 52 (54%) had a counted check before the stop; 24 (46%) ended with none.

## The rule

The generic pack's session cheat sheet gets one line after the `done` pipe example: "After editing files, run the checks below this way before saying it is done." The detected-checks list is capped at 80 joined characters (was 90) to pay for it. The briefing budget in tests is 700 characters (was 600); the hard cap stays 800.

## Bars

- **B1 (text):** the briefing contains the line exactly once, after the pipe example and before `Checks here`, in a project with and without checks.
- **B2 (size):** with a long installed plugin path and four explicit checks, and with four detected checks of up to 80 joined characters, the briefing is at most 700 characters and keeps its last line.
- **B3 (stable and runs):** output stays byte-identical for the same input; the pipe example still runs as written (existing tests).
- **B4 (docs):** README and its Turkish copy say the size honestly (measured 660 on a real project with detected checks and the new line, 697 in the long-path test); the 431 to 599 measurement stays as a dated measurement.
- **B5 (gates):** `npm run check` and `ci:local` green.
- **Report (not a bar):** after the next release, the share of edit turns that end with a counted check, on turns recorded afterwards, against 28 of 52 (54%) before. It is observational: no control group.

## Limits

- No controlled comparison; if the share does not move, or turns get longer, revert the line.
- The line asks for checks after edits only, so sessions without edits get no extra call.
- The chart images still show the old 600 target; they were not regenerated.
