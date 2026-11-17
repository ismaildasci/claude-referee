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

## Update (2026-11-17)

TypeSafe moved the page: `model-jaggedness/jev-1.13.md` now redirects to one `model-jaggedness.md` for every model, with no "last reviewed" date, and a model changelog (`changelog.md`) lists what each Jev release changes. The scheduled run had been red since the move. The watcher now reads `model-jaggedness.md` and records its section headings (10 on 2026-11-17, 9 failure modes) in place of the date, and reads `changelog.md` and records its release names (`Jev 1.14`), so a new Jev release fails the run by name. `test/docs-watch.test.ts` covers both. The snapshot was updated the same day: 144 links in `llms.txt` (15 added, 2 removed; the link count was 131), `models.md` lists `jev-1.13.0` and `jev-1.14.0`.

Read on that day and not acted on: the models page documents a long-context header that raises both context limits to 262k tokens ("slower and less accurate"); claude-referee does not send it.
