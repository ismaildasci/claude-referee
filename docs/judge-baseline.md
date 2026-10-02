# judge --baseline: adopt a rule on existing code

A new rule such as `line.risky` flags what is already there. A baseline records those findings once; later runs report only new ones, so CI can fail on regressions without cleaning the past first.

```sh
# Record the current yes answers (replaces the file).
git diff -U0 origin/main --no-ext-diff | grep '^+[^+]' \
  | npx claude-referee judge --question line.risky --items - --baseline .claude/referee-baseline.json --baseline-write

# Later, in CI: exit code 3 only when a finding is not in the baseline.
git diff -U0 origin/main --no-ext-diff | grep '^+[^+]' \
  | npx claude-referee judge --question line.risky --items - --baseline .claude/referee-baseline.json --fail-on flagged
```

## What it does

- **Identity.** A finding is the question id plus the item text with whitespace collapsed and trimmed, hashed with SHA-256 (first 16 hex characters). The item id (the line number) is not part of it, so a line that moves, is re-indented or shows up under another id stays known. A changed line is a new finding and the old one counts as `gone`. `--context` is not part of the key either, so a renamed file does not resurface what it held.
- **Duplicates.** The file stores a count per hash. Copies are matched in item order: if a line was recorded twice, the first two copies are known and a third is new.
- **Verdict.** With `--baseline`, the verdict comes from new findings only: `flagged` when there is a new yes, `review` when something is unsure or unanswered, `clear` otherwise. So `--fail-on flagged` fails on new findings only and nothing else changes in the exit codes. `yes` still counts every yes answer; `new`, `baselined` and `gone` split it, and `flagged` lists the new item ids only. `--baseline-write` has the verdict `recorded`, with `recorded`, and over an existing file `added` and `dropped`. Only yes answers are recorded; review and unanswered items are not, so they stay visible.
- **Where the file lives.** You pass the path; there is no default and no hidden location. Commit it, for example as `.claude/referee-baseline.json`, and use one file per set of items (diff lines with `line.risky`, test output with `failure.env`), since a run compares against everything in the file for the questions it asked. `--baseline` without `--baseline-write` fails when the file is missing; `--baseline-write` replaces an existing valid file and refuses to overwrite one it cannot parse.
- **Pack.** The file records the pack name. A run with another pack fails instead of comparing answers from different questions.
- **`gone`.** Recorded findings that were not flagged this time: fixed, edited, or not in this run's items. Run the same item set each time, or treat `gone` as informational. To tighten the ratchet, run `--baseline-write` again.

## File format

```json
{
  "version": 1,
  "pack": "generic",
  "entries": {
    "line.risky": { "3f9a1c0b77d2e4aa": 2, "b81e55c0d9a312f7": 1 }
  }
}
```

Keys are sorted so diffs stay small. The file holds no item text, no ids and no paths. A hash cannot be reversed, but a short, guessable line can be confirmed by anyone who tries the guess, so keep that in mind for lines that are themselves sensitive.

The design choices and their Jev receipts are in [decisions/judge-baseline.md](decisions/judge-baseline.md).
