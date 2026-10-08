# Result: a narrower `tsc -b` marker for TypeScript 5 and 6

Result of [tsc-build-marker-ts56.md](tsc-build-marker-ts56.md), 2026-10-08. The rule was built as registered, in `tscBuilt` in `src/engine/runners/js.ts`, and nothing else changed. Base is `cd23674` (its `src` is the same as `e09b227`, named in the registration). Every replay below runs the base copy and the change on the same text; counts come from scripts, not by hand.

## What was built

In `tscBuilt`, a listed project whose last status line is `Building project '<path>'...` with an absolute path (`/` first, or a drive letter followed by `:/` or `:\`) counts as ended only when a later line in the status block carries tsc's clock and names a project. Blank lines and exit lines do not count. A relative path (TypeScript 7) ends its project as before, and `is up to date because` is unchanged. The top comment of `js.ts` says the same in its sentence on the marker.

## Review logs: bars 1 and 2

The review's 105 real logs (35 from TypeScript 5.9.3, 31 from 6.0.3, 36 from 7.0.2, and 3 that are not tsc runs), as 2,630 evidence variants: the whole log with its real exit line and without one, and every `head` and `tail` cut with `exit code: 0`.

- 62 variants change, 38 from TypeScript 5 and 24 from 6. Every change removes the marker (`passed` back to 0, `summary_line` back to null); none adds one.
- **Bar 1, met:** the 3 logs of TypeScript 5 and 6 builds killed with SIGKILL during their last project (`5-killed-multi`, `5-killed-single`, `6-killed-multi`; 68 variants) carried the marker in 15 variants at base and in 0 now.
- **Bar 2, met:** none of the 740 TypeScript 7 variants changes, and none of the 98 variants of the 3 other logs.
- The other changes: 37 are `head` cuts of failing builds (exit 1, 2 or 134) that end at the last `Building project` line, before the errors or the crash trace; their marker was wrong. 10 are the cost (next section).
- `head` cuts that end at the last `Building project` line, with only blank lines after it, and carry the marker: 29 from TypeScript 5, 18 from 6, 20 from 7 and 2 from the other logs at base; 0, 0, 20 and 2 now. (The review's earlier count of 58 used its own flag rule; this count also takes the cuts of clean and killed logs.)

## The cost

Two clean logs lose the marker: `5-ok-first` and `6-ok-first`, single-project first builds with exit 0, in 5 variants each (the whole log with and without its exit line, and the `head` and `tail` cuts that keep every line). Their last status line is the absolute `Building project` line, the same line a killed build ends in.

Asked with a key, fresh, criterion "the typecheck passes", the whole log with `exit code: 0`:

| evidence | 0.2.5 | change |
|---|---|---|
| `5-ok-first` (clean) | `met` 0.93 (`rmuzfidt1onpi`) | `missing` 0.14 (`rmuzfiec0ijql`) |
| `6-ok-first` (clean) | `met` 0.93 (`rmuzfiermhstz`) | `missing` 0.14 (`rmuzfif6avsd2`) |
| `5-killed-multi` (real exit 137, evidence `exit code: 0` as after a pipe) | `met` 0.93 (`rmuzfim7wgygk`) | `missing` 0.13 (`rmuzfimoivqrt`) |
| `6-killed-multi` (real exit 137, evidence `exit code: 0`) | `met` 0.91 (`rmuzfin7qr0zn`) | `missing` 0.19 (`rmuzfinn2sp1z`) |

The first two rows are right `met` answers that become `missing`; the last two are wrong `met` answers that become `missing`.

## Real captures

The 45 captures from the TypeScript 7 work (6.0.3 and 7.0.2) plus a fresh run of this repository's typecheck. As captured, none changes. With `exit N` written as `exit code: N`, 2 change: the 6.0.3 `clean-first` and `clean-force-pretty` runs, both clean, lose the marker. The 6.0.3 `clean-second` run (up to date) and every 7.0.2 run keep it.

## Recorded eval suites: bar 3

Facts for every `done` evidence text and stop transcript in `jev-evals` (512 entries: 352 `done` texts that reach Jev, 112 decided in code, 48 stop transcripts), base against the change: none changes. `done-v2/h3-d-02` keeps `passed: 4` and its summary line. **Bar 3, met:** no recorded case moves, so none moves to a wrong `met`, and nothing had to be recorded again.

## This repository's typecheck: bar 4

TypeScript 7.0.2, `npx tsc -b tsconfig.json --verbose --force`, exit 0: the facts do not change (`passed: 1`). Asked fresh with the change's CLI: `met` 0.91 (`rmuzfi5kojs5q`). **Bar 4, met.**

## Real-use replay

Aggregate counts only, over 1,374 transcript files on this machine. 373 `done` calls; 2 show `tsc -b` output in their result, both from the tsc work sessions, and neither changes. Other Bash results with build-mode status lines: 61 from the tsc work sessions (35 with an absolute `Building project` line), of which 1 changes (a clean TypeScript 5 or 6 run from the review loses the marker), and 1 from other sessions, which has an absolute `Building project` line and does not change (it had no marker before either). No real-use verdict outside the tsc work can move.

## Limits

- **A clean TypeScript 5 or 6 build whose last listed project is built gets no marker** and reaches Jev as `passed: 0`, `summary_line: null`, as before 0.2.5; the two review logs above are answered `missing` (0.14). The marker stays when the last project is `up to date because`, or when another status line follows the last `Building project` line.
- **A TypeScript 7 log cut by `head` right after the last project's `Building project` line**, before its errors, still reads as a clean build (20 variants above): TypeScript 7 prints a project's errors after that line, and a clean build ends the same way. Pipe the whole output, not a `head` of it.
- Windows drive paths are covered by the rule's wording; no Windows log was seen.
- Every other limit in [tsc-build-marker-result.md](tsc-build-marker-result.md#limits) stays as written there, apart from its first item, which this change closes.

A fix fitted to the shapes named in the registration, not a clean test.

## The decision

`decide` (ship or hold, both orders), with the registration and this record as context: `ship` 0.78, `hold` 0.21, a weak lean (receipt `rmuzfmoud76nu`). One fact file was added, quoting the repository's own weighting of the two errors (the registered `done` bars allow no wrong `met` and 10% lost `met`; the 1.0 criteria name "no known wrong `met`" and no recall target), that main is unreleased and a revert is one commit, and that no real-use `done` call had TypeScript 5 or 6 output. Asked once more: `ship` 0.95, `hold` 0.05, both orders agreeing (receipt `rmuzfnhdczkhs`). The added file is framing chosen by me, and it moved the answer from 0.78 to 0.95.
