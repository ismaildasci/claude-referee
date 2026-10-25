# Pest failure lines count before the summary

Registered 2026-10-20, before the code. Found while re-reading today's local `done` calls: Pest and Collision (`php artisan test`) output is read by the `jest` parser through its `Tests:` summary only. Chosen with the advisor tool (probe a cut-off log first); the ship check is a Jev `decide`.

## Why

- Real Pest 5.3.3 output of an invented project (2 failing, 3 passing, 1 skipped, 1 todo test) marks failures in three ways before its summary: a `⨯ name` line per failing test, a `FAIL  Tests\Namespace\FileTest` header over each file with a failure, and a `FAILED  Tests\Namespace\FileTest > name` block per failure. `--compact` prints one progress line such as `.⨯..s.t!!i` instead of the per-test lines. Collision, the printer `php artisan test` uses, is expected to print the same shapes for PHPUnit tests; that was not run here.
- The `jest` parser reads none of these: its failure marks are `● name` and a `FAIL` file path with `.` or `/`. A Pest log cut before its `Tests:` line (`| head`, a clipped paste) with `exit code: 0` after it is exit-code-only evidence; Jev sees only the exit code.
- Every prefix of the two failing logs (default and `--compact`) that shows a failure mark but ends before the summary, followed by `exit code: 0`: 71 of 71 read as `trust: exit_code` with no failure fact. Only the 6 prefixes that reach the summary give a conflict.
- Live probe (temporary data directory, `jev-1.14.0`): one such prefix (20 lines, two `⨯` lines, two `FAIL` headers, one `FAILED` block) gives `met` 0.99 for `the test command exits with code 0` and `missing` 0.15 for `all tests pass`. The first is a wrong `met`: the log shows failing tests, so a 0 after it is the pipe's code, the case [exit-code-only-met.md](exit-code-only-met.md) cannot see.
- Real use (local transcripts since 2026-10-01, aggregates only): 3 `done` calls on Pest or Collision output, all full logs in `{ ...; echo "exit code: $?"; }` form, all labelled `jest`. The path above has not happened in real use yet; it is the shape the repository already closes for jest, vitest, node:test, cargo and bun (a cut-off log never counts as a pass).

## What

The `jest` parser, which already owns Pest's `Tests:` summary, also reads Pest's failure marks:

- a `FAILED` block header whose id is a PHP namespace (`FAILED  Tests\Unit\ParserTest > name`), one failure each, name kept (the trailing exception class column removed);
- a `FAIL` file header whose id is a PHP namespace (`FAIL  Tests\Unit\ParserTest`, optionally `- N todo(s)`), one failure each when no test name is known;
- a `⨯ name` line, one failure each, only in a log with a namespaced `PASS`, `WARN`, `FAIL` or `FAILED` header (Next.js prints `⨯` for its own errors);
- a `--compact` progress line (only `.`, `⨯`, `s`, `t`, `i` and `!`, the marks seen), one failure per `⨯`.

The failure count is the largest of these and the summary's `failed`, never their sum. With `exit code: 0` any of them is a conflict (`unsure`); with a non-zero code nothing changes (`missing` before any request).

The runner keeps the `jest` label, as [parser-defects-2026-10-06.md](parser-defects-2026-10-06.md) decided (rule 4): a `pest` label would change the facts of the recorded hold-out case `h6-f-07` and make its answer stale. (Reversed on 2026-10-25: [pest-runner-label.md](pest-runner-label.md).)

## Bars

- **B1:** the 71 cut-off prefixes above give a failure fact and a conflict; the full failing logs keep their facts.
- **B2:** passing Pest logs (the 2026-10-06 test fixtures, `h6-f-07`, the risky/todo/skip log of the same project) keep their facts; a Next.js-shaped `⨯` line in a log without a Pest header adds no failure.
- **B3:** replay of `parseEvidence` over every eval case with evidence and every locally stored evidence log: no change outside logs that hold a Pest failure mark (counts only, here).
- **B4:** `ci:local` green, `eval score --suite all --fail-on violated` unchanged.
- **B5:** live probe on the 20-line prefix: `the test command exits with code 0` is no longer `met`.

## Cost, stated up front

About 20 lines in `src/engine/runners/js.ts` and their tests. Pest shapes live in the `jest` parser, and a cut-off Pest failure reaches Jev as a `jest` runner. Not covered: a cut-off log that shows only Pest's skip, risky or incomplete marks (`-`, `!`, `…`) and no summary stays exit-code-only evidence; Collision's own wording was not run here (same printer, not verified).

## Decision

Jev `decide` (receipt `rmvgbcdh81uje`, both orders agree, verdict `clear`): read the marks in the `jest` parser 0.96, a separate `pest` runner 0.02, no change 0.01. The context gave each option's cost, including that the wrong-met path has not occurred in real use yet.

## Result (2026-10-20)

Written after the code. B1 and B2 are tests (`test/pest-failure-lines.test.ts`; the three tests that check a failure fact fail without the change, the passing-log and Next.js tests pass either way).

- **B1:** of the 77 prefixes of the two failing logs that show a failure mark, all 77 now give a failure fact and a conflict (6 before). The two full logs (`exit code: 2`) keep `failed: 2`; they gain the two failing test names.
- **B2:** the passing log with skip, todo, risky and incomplete marks keeps its facts on all 19 prefixes (same replay); its 16 prefixes cut before the summary stay exit-code-only (the documented limit). A `⨯` line without a namespaced header adds nothing.
- **B3:** replay of `parseEvidence` over 477 texts (every eval case with evidence, the 95 locally stored evidence logs, the three Pest 5.3.3 runs of the invented project): 2 changed, the two full failing Pest logs (names added, counts equal). No eval case and no stored log changed, `h6-f-07` included.
- **B4:** `eval score --suite all --fail-on violated` gives byte-identical output before and after the build; `ci:local` green before the push.
- **B5:** live probe on the 20-line prefix (temporary data directory): `the test command exits with code 0` `unsure` (raw 0.98 on `jev-1.14.0`, 0.94 on `jev-1.13.0`, capped by the conflict); before the change it was `met` 0.99 on 1.14 (1.13 was not probed before). `all tests pass` `missing` 0.01 on both (0.15 before, 1.14).

Limits: fitted to the output of one invented project on Pest 5.3.3 by the same model family that wrote the rule; Collision's PHPUnit printer and older Pest versions were not run. Real use has 3 Pest calls, all full logs, so the real effect so far is the failing names on full failing logs and nothing else.
