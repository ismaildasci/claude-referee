# A Vite build log without the banner is still a Vite build

Registered 2026-10-09, before any code change. Chosen with `decide` among three options (vite first 0.99, both orders agreeing; receipt `rmv10t7s81p2x`); the silent-linter reading was ranked second and is not part of this change.

## Why

In 114 check outputs written by the owner's gate scripts (lint, test, build; aggregate counts), 20 of 38 build logs have Vite's chunk lines (`dist/assets/index-....js 432.28 kB │ gzip: 117.70 kB`), `✓ built in 3.32s` and an exit code, but not the `vite v5.x building` banner the parser requires, so they read as exit-code-only and a build criterion can only be `met` when it is worded as an exit status. Vite prints `✓ built in` only after a build that finished; a failed build prints `error during build:`. ROADMAP lists `met` recall as an open question; this is one parser "from real output".

> Bar B2 below ("`✓ built in` alone is not claimed") was reversed on 2026-10-10 by [vite-built-line-alone.md](vite-built-line-alone.md): a real Vite 8 log has no size table.

## The rule

The Vite parser also claims a log with no banner when it has a `✓ built in <time>` line and at least one output line of Vite's shape (a path, a size in kB, B or MB, and `│ gzip:`). Facts are the same as with the banner: build-only, `errors` from `error during build:` / `✗ Build failed` / `[vite...` lines, `warnings` from `(!)` lines, the built line as the summary. A log with the banner is read exactly as before.

## Bars

- **B1 (reads):** a banner-less log with chunk lines and `✓ built in` is `vite`, build-only, 0 errors, with the built line as summary.
- **B2 (does not claim):** `✓ built in` alone, chunk lines alone, a banner-less log with `error during build:`, and a non-Vite tool printing `built in` are not read as a clean Vite build (the first two are not claimed; the error case counts the error).
- **B3 (recorded suites):** the parsed facts of the 357 recorded `done` cases are identical before and after.
- **B4 (real logs):** replayed on the owner's 38 build outputs (aggregate): the banner-less ones with chunk lines become `vite`; none that had a failure marker or a non-zero exit changes to a clean reading.
- **B5 (gates):** `npm run check` and `ci:local` green.
- **Report (not a bar):** how many of the 20 banner-less real builds are now parsed.

## Limits

- A Vite-shaped log pasted from another tool would be read as Vite; the rule needs both the built line and the size line.
- The silent-linter shape (37 of 38 real lint outputs) is not touched.

## Result (2026-10-09)

- **B1, B2:** four tests in `test/vite-built-line.test.ts`; two fail on the code before the change and pass after.
- **B3 met:** the parsed facts (trust, exit code, runners) of the 357 recorded `done` cases are identical before and after.
- **B4 / report, a correction:** the registration said 20 of the 38 real build outputs were banner-less Vite logs. That was an assumption from the exit-code-only count; the replay shows 2 of them are, and 18 are `nest build` logs (a silent build: the npm script echo, `exit code: 0`, nothing else). After the change 20 of 38 build outputs are parsed as `vite` (18 before); 18 remain exit-code-only. The change is kept (8 lines, no recorded fact moves), but its value is 2 real logs, not 20. The `decide` ranking used the wrong number; the silent-success reading is re-asked with the corrected counts.
