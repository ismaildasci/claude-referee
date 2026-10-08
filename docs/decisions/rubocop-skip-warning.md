# A rubocop run that says an analysis will be skipped is not a clean lint run

Registered 2026-10-08, before any code change or replay. Closes the one known wrong `met` that the README still lists ("The rubocop case is not fixed yet", README.md:258; [measurements](measurements-real-logs-3.md#hold-out) row for `rl-2160ff01`).

## Why

Hold-out real log `rl-2160ff01` (rubocop/rubocop, step 5, criterion "lint is clean") printed this line before its summary:

> Analyses that use the project index will be skipped. Add `gem 'rubydex'` to your Gemfile.

and then `1769 files inspected, no offenses detected`. The rubocop parser read the run as clean (`passed` 1769, `warnings` 0, `trust` parsed). Jev answered `met` at p 0.96; both labellers said `missing`. The log text was recovered on 2026-10-08 from the job log (the job is still served by GitHub), and its SHA-256 equals the recorded `evidence_sha256`, so the replay uses the same text. The text itself is not committed, as the study's rule says.

Mechanism, checked in code: `done` caps a lint or clean criterion at `unsure` (`warning_in_log`) when a parsed runner reports `warnings` above 0 (`hasParsedWarnings` and `warningCap` in `src/cli/commands/done.ts`; "lint is clean" matches `CLEAN_CRITERION`). So the fix is one more warning in the rubocop parser, not a new reason code.

## Rule

In the rubocop parser (`src/engine/runners/more-tools.ts`), a line that contains the words "will be skipped" (case-insensitive) counts as one warning, like the `Warning:` and `Notice:` lines already do. Nothing else changes: the parser still reads the summary and the offense lines the same way.

## What will be reported, and the bar

- **Bar 1 (recorded suites):** the 512 entries of `jev-evals` keep their facts (the three recorded rubocop cases `h3-c-02`, `h3-c-06` and `h4-d-03` have no such line). Expected: none change.
- **Bar 2 (real logs):** the ten rubocop lint rows of the two real-log samples (hashes verified, texts kept outside the repository) are replayed, base against the change. Bar: `rl-2160ff01` moves from `met` to `unsure` (`warning_in_log`); the three recorded `met` rows keep their facts (`rl-3cee1e31`, `rl-46863d59`, `rl-a50cea6a`; none of their logs has the line); the other rows keep theirs. No row may move from `missing` to `met`.
- **Bar 3 (tests):** invented rubocop output with the skip line, read as a lint criterion (`unsure`, reason `warning_in_log`) and as a test criterion (unchanged); a clean run without the line stays `met`.
- **Bar 4:** `npm run check` and `ci:local` green; `done` on the test output and on the typecheck output of this change, with exit codes.

Shipping is decided with `decide` (ship or hold, both orders) after the replay, with the cost named: if a real `met` rubocop log ever contains the same sentence, it becomes `unsure`, which is not a wrong answer.

## Limits

- Fitted to one sentence from one real log. Recall on other phrasings of the same skip is unknown; the only recorded instance is this one.
- The wording rule covers rubocop only. Other linters that say an analysis was skipped (none is recorded) are not covered.
- The three `met` rows were checked by hash and by the absence of the sentence, not by a new label.
