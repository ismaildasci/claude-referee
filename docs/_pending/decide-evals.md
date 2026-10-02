# Pending for decide-evals

## CHANGELOG (Unreleased, Added)

- `eval` now handles `decide` suites. `eval record` asks both option orders per case; `eval score` reports leader agreement with the labelled best option, the clear/weak/tie mix, order disagreements and agreement per verdict as raw counts, with no precision, recall or pass/fail threshold. Metric choice and first numbers: [docs/decisions/decide-eval-metric.md](docs/decisions/decide-eval-metric.md).
- `eval record` and `eval score` take `--ablation context|reversed` for decide suites: `context` leaves the context text out of the request, `reversed` asks the written order only (rescored from the same recording, no request).
- New suite `jev-evals/decide-best`: the 39 close-call decisions with one author-written best option each, recorded against `jev-1.13.0`.

## ROADMAP (v0.2 leftover)

Replace "Still to do: `decide` suites and `--ablation`." with "`eval` handles `decide` suites and `--ablation context|reversed`; a decide suite is scored by leader agreement, not precision. Still to do: more labelled decide cases, ideally written by someone other than the repo author."

## docs/measurements.md (add)

Decide eval, 2026-10-02, `jev-1.13.0`, 39 close-call cases, one author's labels: full run 16 of 39 leaders match (verdicts 0 clear, 25 weak, 14 tie; 12 order disagreements); written order only 17 of 39 (8 leaders and 9 verdicts changed); context removed 11 of 39 (22 leaders changed, 8 clear verdicts of which 2 matched). Dev split 11 of 20, hold-out 5 of 19. Not evidence that decide is accurate; labels are single-author judgement on decisions built to be close.
