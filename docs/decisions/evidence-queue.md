# receipts --evidence-queue: a list of done receipts waiting for a label

Registered 2026-10-09, before any code change. Chosen with `decide` among four options (o1 1.00, both orders agreeing; receipt `rmv0w677y6pmv`). Extends [local-evidence-labels.md](local-evidence-labels.md).

## Why

The owner asked to label wrong `met` verdicts and `REFEREE_KEEP_EVIDENCE=1` is now set in the global Claude Code settings. Stored evidence is looked up by receipt id, but ids appear only in the JSON a past `done` run printed. Without a list, labelling is a shell loop over the evidence folder and `receipts export`, and labels will not exist. 0 labels exist, so no wrong-`met` rate exists.

## The rule

`receipts --evidence-queue` prints up to 20 `done` receipts that have stored evidence and no label, newest first; `--verdict <v>` keeps one verdict (for example `met`). Each row has the receipt's own fields only: id, time, verdict, p, trust and runner names. No criteria, no evidence text. Labelling stays `--show-evidence <id>` then `--label-receipt <id> --right|--wrong`.

## Bars

- **B1 (queue content):** stored and unlabelled receipts are listed newest first; a labelled receipt, a receipt without stored evidence and a non-`done` receipt are not.
- **B2 (filter and cap):** `--verdict met` keeps only `met`; at most 20 rows.
- **B3 (no text):** the output holds no criteria or evidence text and no path.
- **B4 (docs):** the `receipts` contract and `docs/privacy.md` name the flag.
- **B5 (gates):** `npm run check` and `ci:local` green.
- **Report (not a bar):** the first labelled wrong-`met` rate once the owner has labelled.

## Limits

- Only runs made with `REFEREE_KEEP_EVIDENCE=1` set (new sessions after the settings change) are listed; records older than 14 days are gone.
- Labels are the owner's judgement; nothing labels on the owner's behalf.
