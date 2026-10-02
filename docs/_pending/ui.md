# Pending notes for the integrator (stream: ui)

Rebuild `plugins/claude-referee/dist` and `npm/cli.mjs` once after merging (`npm run build`); the new files are `src/ui/*` and `src/cli/commands/ui.ts`, and `ui` is registered last in `src/cli/commands/index.ts`. `test/describe.test.ts` lists `ui` as the last command.

Deliberate convention break: `src/cli/commands/ui.ts` writes its "listening" line with `io.write` (CONTRIBUTING says the runner prints), because the command blocks until SIGINT/SIGTERM and the URL must appear first. The runner prints the final "closed" line as usual. The page was syntax-checked with `vm.Script` and the served routes were exercised with curl against the built bundle; it has not been rendered in a browser here.

## CHANGELOG (Unreleased)

- Added `claude-referee ui`: a local dashboard on 127.0.0.1 behind a random 128-bit token (URL fragment, header), with Host, Origin and Fetch-Metadata checks, no CORS and a strict CSP. It has a labelling queue (the weak hint is shown, never applied), an overview with stop stats and exact intervals, privacy counters and a per-project export. `--port` and `--no-open`. No new runtime dependency, no network calls out, no telemetry ([security design](docs/decisions/ui-security.md)).

## ROADMAP edit (v0.4, replace the dashboard bullet)

- **A local dashboard** (`npx claude-referee ui`), done in main: 127.0.0.1 only, a random token in the URL fragment sent as a header, Host and Origin checks, no CORS, a strict CSP and `textContent` rendering ([design and threats](docs/decisions/ui-security.md)). The labelling queue, overview, privacy counters and a per-project export are in; labels go through the same `labelStop` as `receipts --label`. JSON lines stay the source of truth. SQLite is not added: a full read of 20,000 receipts and 1,500 stops takes about 20 to 35 ms, so there is no measured need (it would also require Node 22.13 or later). Open: a Windows browser launcher, and a check of the page in more than one browser.

## Docs to link

- `docs/privacy.md` gets a short "Dashboard" line from this branch; README can mention `npx claude-referee ui` next to `receipts --stops`.
