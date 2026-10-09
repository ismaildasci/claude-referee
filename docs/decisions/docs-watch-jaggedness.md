# Docs watch: the jaggedness page and the SDK changelogs

Registered 2026-10-09, before any code change. Chosen with `decide` among five candidates (o1 0.98, both orders agreeing; receipt `rmv0vhaicvwqe`).

## Why

The weekly watcher hashes TypeSafe's `models.md`, `api.md` and `llms.txt`. TypeSafe also publishes "Jev 1.13 jaggedness" (its known weaknesses, "last reviewed 2026-10-02", "many of these will be fixed in later versions") and dated SDK changelogs (Python 0.7.3 appeared on 2026-10-09, JavaScript 0.6.0 on 2026-09-15). Nothing watches them, so a fixed weakness or a new release would show up only through our receipts.

## The rule

- `model-jaggedness/jev-1.13.md` joins the watched pages: its hash is compared like the others, and the recorded facts carry its "last reviewed" date. A change fails the run, as for the other pages.
- The newest version and date of the Python and JavaScript SDK changelogs are recorded under `info` in `docs-watch.json` and compared on every run. A difference prints a GitHub `::notice::` line and never fails the run; a changelog that cannot be fetched or read prints a notice too. `--update` records the current values.

## Bars

- **B1 (parsing):** a test reads `v0.7.3 (2026-10-09)` from a heading in Markdown and from the HTML heading form the Python changelog uses, and returns nothing for text without a release.
- **B2 (info never fails):** a test shows a changed SDK version yields a notice line and no changed page.
- **B3 (page):** a test reads the "last reviewed" date from the jaggedness page text; `compare` reports the page when its hash differs.
- **B4 (live):** `node scripts/docs-watch.mjs --update` records the three new values; `node scripts/docs-watch.mjs` then says unchanged.
- **B5 (gates):** `npm run check` and `ci:local` green.

## Limits

- Any edit of the jaggedness page, including a typo, turns the weekly run red until someone reads the diff and runs `--update`.
- A notice shows only in the run's annotations; nobody is paged.
- The SDK changelogs say nothing about the HTTP API beyond what a release note mentions.
