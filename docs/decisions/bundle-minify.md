# Whitespace-only minification of the bundles

2026-10-06. `dist/cli.mjs` was 390,033 bytes against the CI tripwire of 400,000 and `dist/hook.mjs` 181,641 against 200,000. The cli tripwire had been raised from 280,000 the day before (233eb06) with the stated reason that the new limit leaves headroom, so it is not nudged again for each feature; the night's defect batches alone add an estimated 3 to 5 KB. The tripwire guards against unplanned growth, not safety.

## Options

Asked with `decide` (neutral names, four options): turn on whitespace-only minification and keep both tripwires; keep readable bundles and raise the tripwire again; keep both and move rarely used commands (`eval`, `extract`, `ui`, about 90 KB) into lazily imported chunks with code splitting; change nothing and only do work that adds no bundle code.

- First round, with the size facts only: `minify` 0.60, `split` 0.21, `raise` 0.17, `freeze` 0.01, orders agreeing, verdict weak (receipt `rmuwvx3pvbjju`). Below the 0.90 bar, so the missing facts were measured.
- Measured on a scratch copy of 6eeef75 with `minifyWhitespace: true`: cli.mjs 315,651 bytes, hook.mjs 140,665; `--describe` returns valid JSON for all 11 commands and `eval score --suite all --fail-on violated` passes offline with the minified bundle; start latency over 60 interleaved runs each (same machine, busy with other jobs): hook `stop` median 128.4 ms plain against 132.5 ms minified, `session-start` 128.8 against 128.1, `cli doctor` 181.0 against 188.6, so no difference beyond run-to-run noise. No test or script reads the text of the built bundles.
- Second round, with those measurements added: `minify` 1.0, every other option 0, both orders agreeing, verdict clear (receipt `rmuwvzidyq9t0`).

## Rule

`scripts/build.mjs` passes `minifyWhitespace: true` to esbuild. Identifiers are not renamed and `keepNames` stays, so function and variable names remain searchable in the bundle; the readable form is the TypeScript in `src/`, and CI checks that the committed bundles are exactly what the build produces from it. The tripwires stay at 400,000 and 200,000 bytes.

Applied on top of the parser fixes (ba2231d): cli.mjs 392,827 to 318,049 bytes, hook.mjs 184,329 to 142,960.

To undo: delete the option and rebuild. Stack traces from the bundles point at long lines with columns instead of short lines; nothing in the plugin parses its own stack traces.
