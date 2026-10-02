# Claude Mods for the labelling queue and gate state

Decided 2026-10-02 with `decide`: wait, no prototype yet. The question was a tie below the acceptance bar, so the conservative option was taken.

## Question

Claude Code 2.1.287 added mods: a plugin can ship a hooks module (JavaScript or TypeScript functions) that draws a pane, a band above the prompt, a toast or a status line inside Claude Code. Could a pane complement or replace the planned localhost dashboard for labelling Stop-gate stops, and could a band or status line show gate state (mode, unlabelled count)?

## What mods can do

Sources, all read on 2026-10-02: [overview](https://code.claude.com/docs/en/plugins/mods/overview), [interface](https://code.claude.com/docs/en/plugins/mods/interface), [API](https://code.claude.com/docs/en/plugins/mods/api), [reference](https://code.claude.com/docs/en/plugins/mods/reference), [plugins overview](https://code.claude.com/docs/en/plugins/overview). The `plugin-authoring` skill bundled with 2.1.286 and `claude plugin validate` were used for the offline checks below.

- A mod is a plugin with `hooks/hooks.json` (`{"modules": ["./register.ts"]}`) and a module exporting `register(on, options)`. Hooks are `($, e, next)` functions on events such as `session.start`, `tool.call`, `turn.complete`, `command.run`, `ui.render` (overview, "How a mod works"; reference, "Files").
- Draw: `Pane` (sidebar in a wide fullscreen terminal, a framed region above the prompt otherwise) opened with `$.ui.open`; `AbovePrompt` band, shared by every mod; `$.ui.toast`; `$.ui.status` (one line under the prompt that starts with a warning glyph and the mod's name); `$.ui.log` (interface, "Pick where to draw"; API, "Show something without starting a turn").
- Elements: `Box`, `Text`, `Button` (hotkeys), `Input`, `Select`, `Link`, `Code`, `Markdown`; `Raster` and `Image` terminal only, `Svg` desktop only (reference, "Elements").
- Commands: `$.command.register` plus a `command.run` hook answers `/name` with no model turn (API, "Add a command").
- Data: `$.fs.read/write/list/exists/stat` (4 MiB per file), `$.process.run(argv)` (no shell, 30 s default timeout, 10 min at most), `$.http.fetch`, `$.store` (key-value, 4 MiB, shared by sessions), `$.state`, `$.env.get/set`, `$.settings.read`, `$.session.cwd()` and `messages()`, `$.clock.every` timers (API, "Reach files, processes, and the network"; reference, "Limits").

## Constraints

| Question | Answer | Evidence |
|---|---|---|
| Versions | Claude Code 2.1.287 or later; on by default; the early-access variable `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is ignored from 2.1.287 | overview, "Turn mods on or off" |
| Experimental? | The public docs no longer use the words early access except for that variable. The 2.1.286 build of the authoring skill still says "The API is early access and moves between releases: the declaration file is the authority", and the reference warns the types on GitHub can be older than the installed version. Treat the API as new and movable; there is no stability guarantee in the pages read | reference header; skill `reference.md` line 5 |
| Where hooks run | Terminal (including editor terminals and JetBrains), Desktop Code tab (not WSL sessions), VS Code chat panel, `claude -p` and the Agent SDK, Remote Control (on the machine), cloud sessions for plugins that reach them | overview, "Where mods run" |
| Where it draws | Terminal and Desktop Code tab only. VS Code chat panel, `claude -p` and cloud: hooks run, nothing draws. So a pane cannot serve headless or CI use | same table |
| Org control | `disableAllHooks`, `--safe-mode`, `allowManagedModsOnly`, `disableSideloadFlags` can stop mods; a managed machine may not load ours at all | overview; reference, "Settings and environment variables" |
| Opt-in from userConfig | Verified: a plugin with a `userConfig` boolean (default false) and a module loads under `claude --plugin-dir` in `claude -p`, and the module receives `options = {band: false}`. `claude plugin validate` passed and printed `hooks: session.start` and `calls: $.env.get, $.fs.write, $.process.run, $.session.cwd` | probe run on 2.1.287 on this machine (throwaway plugin in the session scratchpad, not in the repo) |
| Data directory | Verified: `$.env.get('CLAUDE_PLUGIN_DATA')` returned nothing in the mod, so a mod does not see the variable the settings hooks get. The CLI it would call falls back to `~/.claude/plugins/data/claude-referee-claude-referee`, which matches a marketplace install and not a `--plugin-dir` load | same probe; `src/engine/datadir.ts` |
| Read files | Yes, `$.fs.read` anywhere the user can, so it could read `stops.jsonl` directly, but it should not parse our store itself | API, "Reach files" |
| Run our CLI | Yes, `$.process.run(['node', root + '/dist/cli.mjs', 'receipts', '--stops', '--unlabelled'])`, `$.plugin.root` gives the plugin directory. Verified only that `$.process.run` runs `node -v` | API; probe |
| Write labels | Yes, by running `receipts --label <id> --right\|--wrong` through the same call. A label never leaves the machine and needs no new code path in the store | `src/cli/commands/receipts.ts` |
| Not verified | Pane rendering, focus and hotkeys in a live interactive session; whether the engine strips ANSI or other control characters from `Text`; behaviour of a `modules` entry on Claude Code older than 2.1.287; the Desktop Code tab | not tested here |

## Security model

- A mod runs inside Claude Code with the user's privileges and is not sandboxed. It can read files and secrets the user can, run programs, make network requests, read every prompt and tool call, rewrite them, submit prompts as the user and approve tool calls (overview, "What a mod can reach"). Our settings hooks already run as the user, but a module shipped in the plugin adds a longer-lived in-process surface; the plugin's trust level goes up, not down.
- `claude plugin validate` lists the events and calls a module makes before it loads (overview, "List what a mod does before you install one"). A module of ours would be reviewable that way, and its calls should stay at `$.process.run`, `$.session.cwd`, `$.fs.read` of the project file, `$.clock.every` and `$.ui`.
- A mod cannot change the permission prompt (overview), so it cannot dress up an approval.
- What a malicious excerpt could do in a pane: `task_excerpt` and `final_excerpt` hold up to 300 characters of the user's prompt and Claude's last message, which can contain text from files, web pages or tool output, so any third party can influence them. Inside a pane the risks are terminal escape sequences or control characters, bidirectional overrides that reorder text, a long line that pushes the label buttons off screen, Markdown links and look-alike text that imitates our own buttons or system messages, and a prompt-injection string that a labeller then copies into a prompt. The docs read do not say whether `Text` strips control characters; treat that as not done for us.
- Rendering rule for stored excerpts, if a pane is ever built: put them only in `Text` children as plain strings; never in `Markdown`, `Link`, `Code`, `Client` or `Svg`; remove C0 and C1 control characters including ESC, and the bidirectional controls U+202A to U+202E and U+2066 to U+2069; replace line breaks with a space; cap at 300 characters and set `wrap: 'truncate'`; draw them in a dim style under a fixed label such as `final:` so they cannot pose as interface; key buttons by stop id, never by excerpt text; never act on text inside an excerpt, and never copy an excerpt to the clipboard or into `$.prompt.submit`.
- A status line or band that shows only the mode word and an integer from the CLI has no such surface.

## Comparison with the localhost dashboard

| | Mods pane or band | Localhost dashboard (`ui`, planned) |
|---|---|---|
| Security | No listening socket, no token, no Origin or Host checks. But an unsandboxed in-process module, and excerpts rendered in a terminal need the escaping rule above | A server on 127.0.0.1 with a random token and Origin and Host checks; excerpts rendered in a browser need HTML escaping and a CSP |
| Setup | Ships with the plugin; needs Claude Code 2.1.287 or later, the module switched on, and a terminal or Desktop Code tab | `npx claude-referee ui`; needs Node and a browser |
| Headless and CI | Does not draw in `claude -p`, VS Code chat panel or cloud sessions | Works wherever a browser reaches the machine; separate from any Claude Code session |
| Labelling UX | In context, keyboard hotkeys; limited to about 300 characters of text and the pane width; focus rules (focus is granted only when the prompt is empty) | Full width, filters, export, charts, overview |
| Maintenance | Tied to a new API that has no stability promise in the pages read; a second UI to test (`claude plugin test` with a UI kit) | Ordinary web code with Node's stable APIs; the maintenance is ours alone |
| Reach | Only users of Claude Code at the right version with mods allowed | Any user of the CLI |

## Recommendation

Wait. Do not build a pane or band yet, and do not drop the localhost dashboard for it. A pane could later complement the dashboard as a quick in-session view, not replace it, because it cannot run headless and its API has no stability promise in the pages read. A band showing `referee: soft, N unlabelled stops` is technically feasible with the existing CLI and an opt-in userConfig flag (verified up to a headless load and `validate`), but today it would mostly count nearly every would-block stop (the [base-rate study](session-base-rate.md) found the gate flagged 99 of 99 correct asked stops), and the data directory mismatch means it would be wrong for `--plugin-dir` loads. Revisit when labelled real stops exist or when the mods API has gone through a few releases unchanged.

Uncertainty: the Jev answer was weak, not clear. The cases for building now (early learning, a cheap undo) are real; they were not strong enough at the acceptance bar. Pane behaviour in a live session, escape-character handling and the Desktop Code tab are unverified.

## Jev receipts

Question: build the opt-in band prototype now, or wait. Both orders asked; options `prototype` and `wait`.

| Round | Receipt | Verdict | p prototype | p wait | Orders agree |
|---|---|---|---|---|---|
| 1 | `rmuqavtdp3yk7` | weak | 0.66 | 0.33 | yes |
| 2, after adding the verified facts (opt-in loads headless, `CLAUDE_PLUGIN_DATA` not visible, easy to undo) | `rmuqay67tziza` | tie | 0.55 | 0.45 | no |

Neither round reached p 0.90 with both orders agreeing, so the conservative option (no new code in the shipped plugin) was taken. `decide` suggested going with `prototype` if easy to undo; that is a hint on a question we framed, not evidence, and it is below the bar. The facts were written by us, so the framing moves p; the `wait` option was stated in its strongest form.

## Limits

Docs read on one day; no interactive session was driven; the probe covered load, options, validate and process calls only. The `plugin-authoring` skill and the public docs differ on early-access wording.
