# One ANSI strip for the escape forms that reach real logs

Registered 2026-10-08, before any code change or replay. Follows the limit written in CHANGELOG 0.2.5 (Stop hook entry) and [the 0.2.5 record](docs/decisions/tsc-build-marker-result.md#limits).

## Why

`stripAnsi` in `src/engine/runners/util.ts` removes only CSI sequences whose parameters are digits, `;` or `?`. `done`, `verify` and the Stop gate read their text through it. The parsers read through `prepare`, which also removes OSC sequences but still not colon-separated parameters. So a real log can reach a check reader with escape text it cannot read.

Real-use scan (aggregate only, 2026-10-08, `~/.claude/projects`, 2,930 transcript files): 1,701 tool results contain an escape. After the current `stripAnsi` 5 of them still hold one, with 24 escape occurrences: 8 OSC sequences ending in ESC `\` (hyperlink shape), 5 CSI sequences the current pattern does not match, and 3 cut at the end of the text (a bare ESC). A scan of the recorded eval suites (`jev-evals`, all 135 `.jsonl` files) finds only `ESC[` sequences with digits: 783 of them, and no OSC, colon, charset or 8-bit C1 (0x9B) form.

## Rule

One pattern in `src/engine/runners/util.ts`, used by `stripAnsi` and `prepare`:

- CSI: ESC `[`, any parameter bytes `0x30`-`0x3F` (digits, `:`, `;`, `<`, `=`, `>`, `?`), intermediate bytes `0x20`-`0x2F`, one final byte `0x40`-`0x7E`;
- the same CSI as one 8-bit byte `0x9B`;
- OSC: ESC `]` up to BEL or ESC `\`, which covers OSC 8 hyperlinks; when unterminated, to the end of its line. (The first draft said "to the end of the text"; a test showed that this would strip every later line of a log, including its failure lines, so it was narrowed before any code or replay. Not a change of the bar.)
- charset designation: ESC `(` or `)` followed by one byte (`ESC(B`).

Nothing else changes. A check's reading after stripping is the reading of the same text without the escapes.

## What will be reported, and the bar

- **Bar 1 (recorded suites):** no fact changes in `jev-evals` at all: the 512 `done` and stop entries' facts, base against the change (`eval-facts` script as in the 0.2.5 record). Expected: none, since the recorded forms are unchanged by the wider pattern. If any changes, it is re-recorded and reported, and the bar is no wrong `met`.
- **Bar 2 (real-use results):** for the 5 results above, every check status that changes is listed with its old and new reading and read by hand. A change to `passed` is accepted only when the stripped text carries the same pass line an uncoloured log has. Any change that gives `passed` without that line fails the bar.
- **Bar 3 (tests):** invented logs for an OSC 8 link around an exit-code-looking title, a colon-separated colour, an 8-bit CSI, a charset switch and an unterminated OSC, each read as the uncoloured text reads.
- **Bar 4:** `ci:local` passes; `done` on this change's own test output and typecheck output met with exit codes.

Shipping is decided with `decide` (ship or hold, both orders) after the replay. The decision context names the real-use count and the 5 results.

## Limits

- Parsers keep their own copies of the rule in `php-ruby.ts`, `python.ts`, `more.ts`, `compiled.ts` and `skips.ts`; they are not touched here, since no real or recorded case shows them failing.
- A lone ESC cut at the end of the text stays, since no form above matches it.
- Windows drive text is not involved; no Windows log was checked.
