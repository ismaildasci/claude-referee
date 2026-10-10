# The Vite built line is enough, with or without a size table

Registered 2026-10-10, before any code change. Chosen with `decide` among three options (o1 0.99, both orders agreeing; receipt `rmv260n4w1xky`). It reverses bar B2 of [vite-built-line.md](vite-built-line.md), on purpose.

## Why

A real run of the owner (2026-10-09): a Vite 8 production build whose log is a `[PLUGIN_TIMINGS] Warning:` block, `✓ built in 4.09s` and `exit code: 0`, no size table and no `vite vX building` banner. The criterion "vite production build completes with exit code 0" was `missing` (p 0.49): the log read as exit-code-only, so the facts held the exit line and not the built line. The earlier rule needed the built line and a size line, and said the built line alone is not claimed; this shape shows the size line is not always printed.

## The rule

The Vite parser claims a log that has the whole-line `✓ built in <time>` even without the banner and without a size line. Errors still come from `error during build:`, `✗ Build failed` and `[vite...` lines; warnings now also come from `[PLUGIN_TIMINGS] Warning:` lines, in addition to `(!)` lines. Facts are build-only with the built line as the summary. A log with the banner is read as before.

## The cost, stated

- A different tool printing exactly `✓ built in 1.2s` would be read as Vite. The known neighbours differ (`✔ ... built in` in Nuxt, `✓ Completed in` in Astro, `build complete in` in vitepress; Storybook with the Vite builder is Vite).
- When a log moves from exit-code-only to parsed, the exit-only wording cap no longer applies, so a criterion such as "no warnings" could become a wrong `met`; counting the plugin-timings block as a warning keeps that shape `unsure`, and a test and a recorded case pin it.

## Bars

- **B1 (reads):** the invented plugin-timings shape and the built line alone are `vite`, build-only, 0 errors; the first has 1 warning.
- **B2 (errors and exits):** a built line followed by `error during build:`, and a non-zero exit, are not clean.
- **B3 (recorded facts):** the parsed facts of all recorded done cases are identical before and after.
- **B4 (real logs):** replayed on the 38 real build outputs, only logs with the built line change.
- **B5 (Jev reads it):** a new dev suite `done-vite` (invented text from the shapes, no project names): exit-status criterion on the plugin-timings shape expected `met`; "no warnings", a test criterion, a failed second build and a non-zero exit expected not `met`; 0 wrong `met`.
- **B6 (gates):** `npm run check` and `ci:local` green.

## Result (2026-10-10)

- **B1, B2:** `test/vite-built-line.test.ts` (5 tests): the built line alone and the plugin-timings shape read as `vite` (build-only, the second with 1 warning), `✔ Client built in` and `✓ Completed in` do not, a following `error during build:` counts the error and a non-zero exit stays missing material.
- **B3 met:** the parsed facts of all 372 recorded done cases are identical before and after.
- **B4 met:** on the 38 real build outputs nothing changes (the 20 with a table were already read as `vite`; the 18 others are silent `nest build` runs); the new shape comes from a 39th log that was not in the sample.
- **B5 met:** new dev suite `done-vite` (7 invented cases): 0 wrong `met`, both expected-`met` cases are `met` (the exit-status criterion on the plugin-timings shape 0.94, the plain success criterion on a lone built line 0.94); the no-warnings and test criteria on the same shape, the failed and swallowed-exit cases are not `met`; the other tool's wording stays `unsure` (0.67) by exit-code reading. The suite is a dev set.
- Measured on a probe data directory, so the owner's receipts stayed clean.
