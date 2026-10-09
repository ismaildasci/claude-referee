# README claims audit, 2026-10-09

Chosen with `decide` among five candidates (o3 0.88, then 1.00 after one added fact; both orders agreeing; receipts `rmv0voynrrix0`, `rmv0vp580a9gi`). Read the English and Turkish READMEs against the code, `docs/privacy.md` and `docs/configuration.md`; numbers were checked by script, not by Jev.

## Findings and fixes

- **Privacy bullet (both READMEs):** "receipts ... never the text you sent" had no mention of the opt-in `REFEREE_KEEP_EVIDENCE=1`, which keeps redacted `done` criteria and evidence on the machine for 14 days. Now stated, with "off by default and nothing is sent".
- **Turkish README:** said the rubocop case "is not yet fixed"; it is capped since 0.2.6. It also lacked the sentence on detected checks. Both fixed.
- **Tested Claude Code version (both):** 2.1.292 became 2.1.295, the version the install canary passed on in `ci:local` today.
- **Briefing size row (both):** the 431 to 599 character measurement stays; a note adds 620 characters measured in a test with detected checks, a long plugin path and long script names (cap 800). The status-board chart text still says the briefing fits in 600; the image was not regenerated.

## Check

The four new sentences about the opt-in evidence and the detected checks were checked with `claims` against `docs/privacy.md` and `docs/configuration.md`: 4 of 4 supported (receipt `rmv0vqpc8csja`).

## Not done

- The chart alt text and the chart images keep "600 characters".
- The measurement tables and their numbers were not re-derived; they cite `docs/measurements.md`.
