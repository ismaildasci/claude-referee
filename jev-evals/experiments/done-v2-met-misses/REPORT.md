# done v2: the "met" cases that are not reported met

Scripts and data: analyze.mjs, show.mjs, mism.mjs, cmpfix.mjs, cmp.mjs, PREREG.md (written before the live run), parser-fix.diff, question-note.diff, ev-dev/ and ev-holdout/ (variant recordings), packs/donenote (variant pack). Nothing in the repo was changed (git status clean). Live requests: 78 (30 dev + 48 hold-out), under the 600 budget.

## 1. Which cases (by script, analyze.mjs; same numbers as `eval score`: 22 met / 7 unsure / 49 missing)

The doc's "3 met cases still unsure or missing" are all hold-out. Dev has 4 more (11 met expected, 7 found).

| case | split | p (older / latest recording) | verdict | trust |
|---|---|---|---|---|
| h-cargo-pass | holdout | 0.71 / 0.64 | unsure | parsed |
| h-pytest-rerun | holdout | 0.63 / 0.58 | unsure | parsed |
| h-phpunit-warn | holdout | 0.20 / 0.21 | missing | parsed |
| d-cargo-pass | dev | 0.64 / 0.65 | unsure | parsed |
| d-build-exit0 | dev | 0.50 / 0.57 | unsure | exit_code |
| d-eslint-clean | dev | 0.23 / 0.23 | missing | exit_code |
| d-tsc-silent-exit0 | dev | 0.25 / 0.21 | missing | exit_code |

(`findRecording` takes the latest line whose hashes match; the 2 lines per case are the pre-label and post-label recordings, not repeated draws of one state.)

## 2. Cause per case (offline)

- h-phpunit-warn: PARSER GAP (src/engine/runners/js.ts:70). The jest tally regex `/^\s*Tests:\s+(\d.*)$/` matches PHPUnit's `Tests: 45, Assertions: 118, Deprecations: 3.`, so the facts sent contain a phantom `jest 0/0/0/0` next to `phpunit 45/0/0/0` (shown by show.mjs). The note says zero tests do not show passing; p 0.21. Offline, a patched copy (parser-fix.diff, one regex line) removes the phantom in exactly 4 of 111 cases compared (78 done-v2 + 33 injection): d-phpunit-skipped, h-phpunit-warn, h-phpunit-fail, h-phpunit-skipped; all other parsed facts are byte-identical. Not verified live (no request was spent on the patched facts).
- h-cargo-pass, d-cargo-pass: not the parser counts (passed is correctly the sum 14 and 10), but the facts are internally inconsistent: `summary_line` is the LAST result block ("2 passed", "1 passed") while `passed` is the total (compiled.ts:175 uses the last result line). Cargo is the only runner where `summary_line` states a count different from `passed` in the same object (mism.mjs). Also both have no exit code line. Parsed met cases without an exit code average p 0.72 (n 17) vs 0.97 with one (n 6), but that split is confounded (all 6 with an exit code are dev cases). Cause between "summary_line vs passed" and "missing exit code clause in the note": not separable offline; the variant below addresses both.
- h-pytest-rerun: facts are clean (18/0/0/0), `summary_line` has "1 rerun". Jev hedges on a flaky pass (0.58-0.63) while rspec-retry gets 0.79. Whether a rerun-then-pass is "met" is a labelling choice. Cause: question/evidence, not a parser gap. The band is not the cause (see 4).
- d-eslint-clean, d-tsc-silent-exit0, d-build-exit0: exit-code-only evidence. Their hold-out twins (h-eslint-silent-0 0.92, h-tsc-silent-0 0.91, h-build-silent-0 0.80) print `tsc exit code: 0`, so `exit_lines` carries the tool name (the label that moved hold-out from 13 to 15). The dev ones print the command on an earlier `$ npx tsc ...` line and a bare `exit code: 0`, so the facts carry no label (exit_lines `["exit code: 0"]`). Parser gap by omission: nearest preceding `$ <command>` line is not captured. Not tested live; not a question change. Criterion text on these (`lint is clean`, `typecheck passes`, `the build succeeds`) is fine.

## 3. Live test of ONE question-text candidate (PREREG.md, rules fixed before the run)

Candidate (question-text.diff = question-note.diff): in `done.met` `note`, drop "or a missing exit code" from the "do not show" sentence and add: `passed` is the total over all result blocks while `summary_line` is only one of those lines; a recognised runner entry with passed above zero and failed/errors/skipped zero and nothing contradicting it shows the tests pass, a missing exit code line does not change that. Bands unchanged (0.7 / 0.5), same facts, built dist, pack `donenote` extends generic.

Dev (30 requests, cmp.mjs): met found 9 of 11 (baseline 7), wrong met 0, highest p of a non-met case that is not unparsed 0.40 (d-gotest-cut). Rules D1-D3 hold. Changes: d-cargo-pass 0.65 to 0.88, d-build-exit0 0.57 to 0.77 (a bare `exit code: 0` after compiler output now met), d-eslint-clean and d-tsc-silent-exit0 unchanged (0.23, 0.27). Mean |dp| over the split 0.036.

Hold-out (48 requests, run once, after dev passed): met found 17 of 18 (baseline 15), wrong met 0, `unsure` 5, `missing` found 26 of 30 (baseline 27: h-cargo-cut moved from missing 0.43 to unsure 0.57, an unparsed cut-off log; no expected-missing case became met), highest parsed non-met p 0.12. h-cargo-pass 0.64 to 0.95, h-pytest-rerun 0.58 to 0.95, h-phpunit-warn 0.21 to 0.51 (unsure; the phantom jest runner is still in the facts, so the parser fix is still needed). The three unparsed cut-off cases that Jev calls met-like went up (0.87 to 0.96, 0.84 to 0.95, 0.78 to 0.88); they are still turned into `unsure` only by the code rule (unparsed can never be met), so that rule is load-bearing, not the question. Mean |dp| over hold-out 0.091, max 0.37: the text raised confidence on nearly every parsed pass (0.74-0.83 to 0.94-0.97).

## 4. Is the 0.7 band the cause?

Not by itself, and moving it is not justified. Dev only: lowering met to 0.65 would add d-cargo-pass (0.65) with 0 wrong met on dev (dev sweep), but that rests on one case, and h-cargo moved 0.71 to 0.64 between two recordings of the same question, so a 0.64-0.71 value is inside re-record drift. The highest non-unparsed missing case is 0.30 on dev (0.43 on the baseline hold-out, which I had already read when diagnosing, so it was not used to pick anything). Recommendation: leave the bands alone.

## 5. Concrete diff proposals (not applied)

1. Parser (high confidence on mechanism, offline-verified fact change only, not verified live): src/engine/runners/js.ts line 70, see parser-fix.diff:
   `-  const tests = tally(lines, /^\s*Tests:\s+(\d.*)$/);`
   `+  const tests = tally(lines, /^\s*Tests:\s+(?=.*\b\d+\s+(?:failed|passed|skipped|todo|total)\b)(\d.*)$/);`
   Needs re-recording of the 4 changed phpunit cases only.
2. Question text (live-tested above, weak evidence, see limits): plugins/claude-referee/packs/generic/questions/done.json note per question-note.diff. It changes qhash, so all 78 done-v2 recordings (and any CI that checks hashes) need re-recording: 78 requests. Do the parser fix (1) first so h-phpunit-warn is judged on correct facts.
3. Not tested live, facts side: in compiled.ts cargo, report `summary_line` consistent with `passed` (for example join all result lines or state the total) so the facts do not contradict themselves; and capture the nearest preceding `$ <command>` line next to a bare `exit code:` line in exit_lines. These two would remove the need for the note sentences; unverified.

## 6. Limits

- Selection bias: the candidate text was chosen after reading hold-out recorded p values (disclosed in PREREG.md), so hold-out is a one-shot regression check, not an unbiased estimate. Dev gain is 2 cases (d-cargo-pass, d-build-exit0), hold-out gain 2 cases (cargo, rerun).
- The note raises p on all parsed passes; the safety on wrong met comes from the code rules (unparsed, conflict), and the expected-missing parsed cases stayed at 0.12 or lower (hold-out) and 0.40 (dev). With only 30 hold-out missing cases and invented data, a rise in wrong met on real runs is not excluded.
- h-pytest-rerun being counted `met` is my labelling-dependent judgement carried over from the case file, not independently verified; a rerun-then-pass is arguably not a clean pass.
- Single run per case on one model version; no repeat draws to size the noise; cases invented; parsers unchecked against real runs.
- Option-order agreement is not applicable: done asks one Noul per criterion.
