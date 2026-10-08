# Result: one ANSI strip for the escape forms that reach real logs

Result of [ansi-wide.md](ansi-wide.md), 2026-10-08. The rule was built as registered in `src/engine/runners/util.ts`, with one change made before any replay: an unterminated OSC now ends at its line, not at the end of the text. The first draft would have removed every later line of a log (a test showed it), so the registration says so.

## What changed

- `stripAnsi` (read by `done`, `verify` and the Stop gate) and `prepare` (read by the runner parsers) use one pattern now: CSI with any parameter bytes (colons included), CSI as one 8-bit byte `0x9B`, OSC up to BEL or ST (OSC 8 hyperlinks included; unterminated, to the end of its line), and charset designations `ESC(` and `ESC)`.
- No other file changed. The parsers that keep their own copies (`php-ruby.ts`, `python.ts`, `more.ts`, `compiled.ts`, `skips.ts`) are unchanged, as the registration says.

## Bars

- **Bar 1, recorded suites: met.** 512 entries (352 `done` texts that reach Jev, 112 decided in code, 48 stop transcripts), base against the change: 0 facts change.
- **Bar 2, real use: met.** All 1,701 tool results with an escape, base against the change: 0 stop-gate check statuses and 0 `done` runner facts change. One result changes its text (one OSC sequence); no fact moves with it.
- **Bar 3, tests: met.** `test/ansi-wide.test.ts`, 4 tests: each escape shape is removed and its text kept; a log with an OSC 8 link or a colon colour reads as the plain log does, for the parsers and for `done`'s verdict; a stop check whose passing title is an OSC 8 link reads as the uncoloured pass (`passed`, skip reason `check_passed_after_edit`); an unterminated OSC does not swallow later lines. On the old strip 3 of the 4 fail; on the new strip 4 of 4 pass.
- **Bar 4: met.** `npm run check`: 1,074 of 1,074 tests pass. Jev on the test output: `met` 0.98 (receipt `rmuzhuvcalas1`). Jev on this repository's typecheck (`tsc -b --verbose --force`, exit 0): `met` 0.93, from the cache (`rmuzhuwegkeq4`), since the same text was asked before. `ci:local` is run on the commit with the rebuilt bundle.

## What stays

- After the wider strip, 4 real tool results still hold an escape byte. In 3 of them an `ESC` sits right before a line end (not a sequence). In 5 places an `ESC[` is followed by printable ASCII and no final byte before the line ends, so it is not a terminal sequence: text the tool printed, or a sequence cut by the tool. Removing these would mean reading across line ends, which could swallow the lines that show a failure, so they stay. No check status or fact changes because of them.
- A lone `ESC` at the very end of the text stays.
- Parsers outside `util.ts` keep their own copies of the older rule (see the registration's limits).
- Windows drive text was not involved; no Windows log was checked.

## Decision

`decide` (ship or hold, both orders, with the registration and this record as context): `ship` 1.0, `hold` 0, orders agreeing (receipt `rmuzhynpxunb9`). Shipped to main as one commit; no release is implied.
