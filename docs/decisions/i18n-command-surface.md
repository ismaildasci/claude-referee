# i18n pack: command surface

The fork: expose the deterministic candidate extractor as `judge --files <glob>` (judge extracts and judges in one call), or as a separate `extract` command that writes judge items, with an optional per-item `context` field on `judge --items`. Asked through `decide`, two option orders each, bar p 0.90 with both orders agreeing.

| Run | Framing | Result | p | Receipt |
|---|---|---|---|---|
| 1 | First draft; the `extract` option was argued at more length | `extract` | 0.94 | rmur7l44a0zj6 |
| 2 | Reversed: the `judge --files` option argued at more length, `extract` stated tersely | `judge --files` | 0.91 | rmur7lcqomg08 |
| 3 | Symmetric: both options the same length, each with surface added and its strength | `extract`, weak | 0.76 | rmur7llrgnuhh |
| 4 | Run 3 plus two true facts: judge-baseline docs already show pipelines into `judge --items -`; Node 20.3 has no built-in glob | `extract` | 0.91 | rmur7lvkkzzg1 |

Runs 1 and 2 crossed the bar in opposite directions on framing alone, so neither counts. Run 3 was weak; per the method, one neutral fact was added and the question asked once more (run 4, both orders agreeing). Chosen: the separate `extract` command, on run 4. The framing sensitivity is the reason the choice is recorded with all four receipts.

Differences from the option as asked: the command runner prints one JSON result line, so `extract` cannot stream items on stdout. It writes them with `--out <file>`, and the next step is `judge --items <file>`, not a pipe. It takes paths and walks directories (shell globs work) instead of implementing a glob matcher for Node 20.3.

Judgement calls made without Jev, conservative in each case: an item's own `context` replaces `--context` for that item (no merging); `--baseline` hashes ignore the context, so a string moved between files stays known; identical candidates are collapsed by default to keep the number of paid requests down.
