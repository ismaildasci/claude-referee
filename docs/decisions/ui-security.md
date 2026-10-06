# Local dashboard: security design

Status: implemented for `claude-referee ui` (ROADMAP v0.4). Written alongside the code; `test/ui.test.ts` covers the Host, Origin, token, XSS, traversal, label and shutdown rules below. The request timeouts and the launcher file modes are not covered by a test.

The dashboard shows and edits data that holds excerpts of the user's prompts and Claude's messages (`stops.jsonl`), so it is built as if a hostile web page and a hostile local user were both trying to read it.

## What it is

A Node `http` server started by `claude-referee ui`, with no new runtime dependency. The page is vanilla HTML, CSS and JavaScript served from strings in `src/ui/page.ts`, so the existing bundle carries it. It shows the current project only (the directory `ui` was started in).

| View | Source |
|---|---|
| Flow (first tab, since 2026-10-06) | this project's receipts and stops of the last 1, 7 or 30 days, newest 200, each call with Jev's stored answers looked up by the receipt's `cache_keys` (at most 12 entries per call and 600 per response, the rest counted as not read; an entry older than the 30-day cache life counts as gone); nothing new is stored, and what was sent to Jev is not shown because it is never stored |
| Labelling queue | unlabelled `would_block` stops, with the weak next-message hint shown and never applied |
| Overview | receipt totals of the last 30 days, stop stats with Clopper-Pearson intervals, whether a `claims_done` suggestion is available |
| Privacy | what is stored and how big, counts, what would be sent to TypeSafe and when |
| Export | receipts, stops or labels of this project as JSON lines |

JSON lines stay the source of truth. Labels are written only through the existing `labelStop` function, which appends to `labels.jsonl`.

## Threats and answers

| Threat | Answer |
|---|---|
| Network exposure | The server binds `127.0.0.1` only (never `localhost`, `0.0.0.0` or `::`), on a random free port unless `--port` is given. Nothing is listened on IPv6. |
| DNS rebinding: a hostile site resolves its name to 127.0.0.1 and talks to the port | Every request, the page shell included, must carry `Host: 127.0.0.1:<port>` exactly; anything else gets 403. A rebound name always sends its own name in `Host`. The token is a second line: the attacker's page never learns it. |
| CSRF: another site makes the browser send a request | There is no cookie or ambient credential; the token must be sent in a custom header (`X-Referee-Token`), which a cross-site page cannot add without a CORS preflight, and there is no CORS. API requests with an `Origin` other than `http://127.0.0.1:<port>` get 403, `Origin: null` included. `POST` requires an `Origin` and `Content-Type: application/json`. A `Sec-Fetch-Site` other than `same-origin` on an API request gets 403. |
| Other local users on the same machine (loopback is shared) | The token is 128 bits from `crypto.randomBytes`, compared in constant time over SHA-256 digests. It is printed once to the terminal that started the server. The browser is opened through a launcher file in a fresh `mkdtemp` directory (mode 0700, file 0600) so the token never appears in a process argument list; the file is removed after 20 seconds and on shutdown, and at once when the opener fails to start (`opened: false`). Anyone who can read the owner's terminal or files already has the data. Guessing needs about 2^127 tries, and the server stops with the process. |
| Token leakage in URLs, logs, referrers | The token travels in the URL fragment (`/#t=...`), which browsers never send to a server or in `Referer`; it is not a query parameter and a token in a query string is rejected. The page copies it into a variable, removes it from the address bar with `history.replaceState` and never stores it in `localStorage` or cookies. When the printed URL is opened again in the same tab (only the fragment changes, so the page does not reload), the `hashchange` handler takes the new token the same way; any other fragment, such as the skip link's `#main`, is ignored. The server keeps no access log and never prints a request URL. `Referrer-Policy: no-referrer`, `Cache-Control: no-store`. Residual: the first history entry may be recorded by the browser before the script strips it; it is useless after the server stops. |
| XSS from stored excerpts (they hold anything Claude or the user ever wrote) | Excerpts are returned only as `application/json` with `X-Content-Type-Options: nosniff`, and the page builds every node with `createElement` and `textContent`; it never uses `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` or `new Function` (a test greps the served script). The CSP is `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, with no inline script or style, so an injected tag would not run even if it got in. |
| Misleading text in stored excerpts: Unicode bidi controls that reverse or reorder what the labeller sees | The queue API replaces each bidi control character (U+061C, U+200E, U+200F, U+202A to U+202E, U+2066 to U+2069) with a visible code point such as `[U+202E]` before the page gets it; `stops.jsonl` and the export keep the original text. A test checks both. Added on 2026-10-06 after the first run of the page in a real browser. |
| Path traversal through the flow view | `days` and `command` only select from fixed lists (1, 7 or 30; the commands present in the window, or `stop`), anything else falls back to 7 and all. A cache key from a receipt is read only when it is 64 lowercase hex characters, so a tampered receipt cannot point the reader outside `cache/`; other keys are counted as missing. A test plants `../../outside`. A corrupt receipt or cache entry (a field of the wrong type, a timestamp no `Date` can hold) becomes a placeholder or a missing answer instead of failing the route; a test covers both, after an independent review found that one bad line returned 500. |
| Path traversal in export | Export takes `kind` from the allow-list `receipts`, `stops`, `labels` and nothing else; the server rebuilds the body from its own readers, so no request value ever reaches a file path. Static routes are exact string matches (`/`, `/app.js`, `/app.css`). A request target that starts with `//` or holds any backslash gets 400 before it is parsed, because URL parsing reads `\` as `/` (before, `/\` gave 500 ahead of the token check and `/\x/api/flow` was served as `/api/flow`). A path that URL parsing changes gets 400 after parsing: dot segments such as `..`, `%2e` or `.%2E`, and characters it percent-encodes such as `{` or a backtick. So `/x/../api/flow` and `/x/%2e%2e/app.js` are refused instead of served as `/api/flow` and `/app.js`. A path that parsing leaves alone but no route matches gets 404, or 401 under `/api/` without the token. Before 2026-10-06 such a path was resolved and served; that was not a bypass, because the resolved route still ran the Host, Origin, Fetch-Metadata and token checks, but this row said otherwise until a review sent one. A query value is not checked as a path, and the page encodes both query values, so it never sends a raw backslash. The download filename is fixed. |
| Cross-origin reads and framing | No `Access-Control-Allow-*` header on any response and `OPTIONS` is refused. `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY` and `frame-ancestors 'none'`. |
| A mislabel by a drive-by request | A label needs the token, an `Origin` match, a JSON body of at most 2 KiB and an id of a `would_block` stop of this project; the label is `right` or `wrong`. The weak hint is shown, never applied. |
| Slow or oversized requests | Body cap of 2 KiB, 10 s request timeout, 5 s header timeout. |
| Data leaving the machine | The server makes no outbound call, loads no external font, script or image, and sends no telemetry. Opening the browser is the only process it starts, and only without `--no-open`. |

Out of scope: a compromised browser or browser extension, an attacker with the user's account, and the user pasting the URL into a chat. The URL is a credential for as long as the server runs; the command says so.

## Decisions

Each went through `claude-referee decide` (both option orders, acceptance bar p >= 0.90, both orders agreeing).

- **Export scope: this project only** over all projects. Jev p 1.00 for `project_only`, 0.00 for `all_projects`, both orders agree (receipts `rmuqan3s7apq5`, a fresh run of 2 requests, and `rmuqanah66qfu`, the same input replayed from the cache). The CLI's `receipts export` still exports every project; the dashboard is stricter because stops carry excerpts.
- **Opening the browser: a 0600 launcher file in a 0700 temp directory**, over pasting a token by hand and over passing the URL as an argument. Jev p 0.90 (rounded down by the output) for `temp_launcher`, 0.09 for `paste_token`, 0.00 for `argv_open`, both orders agree (receipt `rmuqan78n06qi`; the output floors to two places, so p is in [0.90, 0.91), at the bar). `--no-open` skips it, and only macOS (`open`) and Linux (`xdg-open`) are launched; elsewhere the URL is just printed. `opened` in the listening line is true only when the opener process started (its `spawn` event); a missing opener gives false. It does not confirm that a browser showed the page.

Taken without Jev because the task fixed them: the fragment-plus-header token, `Host` and `Origin` allow-lists with no CORS, the strict CSP, `textContent` rendering and `labelStop` for writes.

## SQLite: not added

The roadmap allows SQLite as an index, and it needs Node 22.13 or later while the package supports 20.3. It is not justified by measurement. On 2026-10-02 (Node 25.5, macOS), reading and aggregating 20,000 receipts (5.0 MB) plus 1,500 stops (2.5 MB, over the 2 MB rotation size) from JSON lines took 18.5 to 34 ms per full read, three runs, the same readers the dashboard uses. The dashboard re-reads on each request. Revisit only if a real data directory makes a view take longer than about 250 ms.

## Not done

- No login, no cookie session, no multi-user mode: the token is the session.
- No write action other than labels; overruling receipts or editing thresholds stays in the CLI.
- Windows is not covered: the server works wherever Node does, but the launcher is not implemented there.
