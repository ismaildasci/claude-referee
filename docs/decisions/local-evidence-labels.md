# Opt-in local evidence for labelling done verdicts

Registered 2026-10-08, before any code change. The owner approved it: "evet devam et" after the proposal to store redacted evidence only on the owner's machine so that wrong `met` verdicts can be labelled and counted.

## Why

Receipts keep a verdict, a trust level and an exit code, but not the evidence text or the criteria, so a wrong `met` cannot be told from a right one on the owner's machine. The Stop gate has labels (`receipts --label`); `done` has none.

## The rule

Only when the environment variable `REFEREE_KEEP_EVIDENCE` is `1`:

- each `done` run that reaches Jev writes `<data dir>/evidence/<receipt id>.json` (mode 0600) holding its criteria and its evidence, both passed through the same redaction as the Jev request, plus the time; nothing else;
- files older than 14 days are deleted when a new one is written;
- `receipts --show-evidence <id>` prints one stored record to the owner's terminal;
- `receipts --label-receipt <id> --right|--wrong` appends to `<data dir>/receipt-labels.jsonl` (`right`: the verdict was correct; `wrong`: it was not);
- `receipts --evidence-stats` prints counts of labelled receipts by verdict, with right and wrong.

Without the variable nothing is written, nothing changes in output, and the Jev request is the same.

## Bars

- **B1 (off by default):** a test runs `done` with the variable unset and finds no `evidence/` directory and no change in the output.
- **B2 (redaction):** with the variable set, a stored record contains no credential-shaped value from the test input (the same pattern list as Jev's request).
- **B3 (retention):** a record whose file is older than 14 days is removed by the next write.
- **B4 (labels):** a label on an existing receipt is counted in `--evidence-stats`; a label on an unknown id is refused.
- **B5 (no leak):** evidence text appears only in `--show-evidence` output.
- **B6 (recorded suites):** the 512 entries of `jev-evals` keep their facts.
- **B7 (gates):** `npm run check` and `ci:local` green; the privacy doc names the variable, the folder, the file and the 14-day rule.

Shipping is decided with `decide` after these bars.

## Limits

- Redaction is the pattern list the project already uses; a secret that matches no pattern is stored as the owner's text, on the owner's disk, for 14 days.
- Labels are the owner's judgment and are not checked by Jev.
- Only `done` is covered; stop records keep their own excerpts and labels.
