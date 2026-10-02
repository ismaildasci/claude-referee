# Decide eval metric

Status: Decided 2026-10-02; first measurement below.

## Question

`eval` scores done, verify, judge and stop suites by precision and recall of one positive label. `decide` has no such label: it returns a leader, a probability per option and a verdict of clear, weak or tie. How is a decide suite scored?

## Asked through decide

Three candidates: leader agreement with a labelled best option (with the verdict mix and order disagreement shown beside it), agreement grouped by verdict (calibration), and the order-disagreement rate alone.

- First ask: weak, lean calibration, p 0.74 (leader agreement 0.19, order rate 0.07). Receipt `rmuqalhxi54ch`.
- A fact was added: no close-call decision in the earlier pilot reached a leader probability above 0.735, so a clear group would be empty; a decide verdict advises and never ends work, so there is no wrong-positive kill criterion to calibrate; counts need no grouping. Leader agreement was reworded to show agreement per verdict as raw counts, with no pass or fail threshold.
- Second ask: clear, lean leader agreement, p 1.00, both orders agree. Receipt `rmuqalpfm6ysg`.

The second ask changed both the facts and the text of one option, so it clears the amended option, not a repeat of the first question.

## Metric

Per decide suite, over the scored cases: `agree` and `agreement` (lean equals the labelled option), `verdicts` (counts of clear, weak, tie), `order_disagrees` (cases where the written and reversed orders picked different leaders) and `by_verdict` (cases and agreeing cases per verdict, raw counts). No precision, no recall, no sweep, and the suite verdict is always `scored`: there is no pass or fail threshold.

## Labels

`jev-evals/decide-best` holds the 39 close-call decisions of `jev-evals/decide-close`, each with one best option written by the repo author before any answer was recorded. In these decisions several options are defensible by construction, so a label is one author's judgement, not ground truth. Splits alternate by file order and carry no tuning.

## Ablations

`--ablation` on `eval record` and `eval score`, decide suites only.

- `context`: the `context` text is removed from the request; the decision and the options stay. It needs its own recording; cases without a context reuse the full recording.
- `reversed`: only the written order is asked; the verdict is computed from it alone, so order disagreement cannot occur. It reuses the full recording and sends no request.

Micro rules are not ablated: they are reported as flags and never enter the verdict, and eval cases do not send them.

## First measurement (jev-1.13.0, 39 cases)

| Run | Agreement | Verdicts clear/weak/tie | Order disagrees |
|---|---|---|---|
| Full | 16 of 39 | 0/25/14 | 12 |
| Reversed order dropped | 17 of 39 | 0/28/11 | 0 |
| Context removed | 11 of 39 | 8/24/7 | 6 |

Reading, within what 39 single-author labels support: dev split 11 of 20, hold-out 5 of 19, so the agreement figure depends on which half is read and is not a stable estimate. Dropping the reversed order changed 8 leaders and 9 verdicts and agreement by one case in either direction; this suite cannot show that the second order improves agreement, only that it moves leaders. Removing the context changed 22 leaders and lowered agreement by 5 cases, and 8 decisions became `clear` of which 2 matched the label: without its facts the model is confidently wrong more often than it was with them. No positive claim about decide accuracy follows from these numbers.
