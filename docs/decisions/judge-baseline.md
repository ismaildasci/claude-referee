# judge --baseline design

Three forks went through `decide` (two option orders each, bar p 0.90 with both orders agreeing). Receipts are in the data directory of the machine that ran them.

| Fork | Chosen | p | Receipt |
|---|---|---|---|
| What identifies a finding | Hash of question id plus whitespace-normalised text, with a count per hash; item id and `--context` excluded. Rejected: hash including the line number (resurfaces on every move), hash including the file name (resurfaces on every rename) | 0.91 | rmuqam6oi6mhk |
| Where the file lives | An explicit `--baseline <file>`, recommended as a committed `.claude/referee-baseline.json`. Rejected: the data directory (not shared), one fixed file (mixes item sets) | 0.51, orders disagreed; after adding the facts that other commands take explicit paths and that one repository runs several item sets, 1.00 | rmuqam76smzee, rmuqamfuanmgg |
| Verdict | Computed from new findings only, with `new`, `baselined` and `gone` counts, so `--fail-on flagged` needs no change. Rejected: a separate field only, a new verdict word | 0.96 | rmuqam7pbmvdn |

Judgement calls made without Jev, conservative in each case: only yes answers are recorded (review and unanswered stay visible); `--baseline-write` replaces the file but refuses to overwrite one it cannot parse; a baseline from another pack fails the run.
