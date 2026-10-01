# Configuration

claude-referee combines settings from four places. Each one overrides the ones before it:

1. **Plugin settings**, your defaults for every project
2. **The project file** `.claude/referee.json`, what this repository uses
3. **Your personal file** `.claude/referee.local.json`, your overrides for this repository
4. **Environment variables**

Two limits apply:
- The project and personal files can pick a pack and turn hooks on or off, but they can only make thresholds stricter. They can't set the key, the key command or `packs_dir`.
- The API key has its own lookup order, described [below](#the-api-key).

Hooks stay off in any project without a project file. `hooks_enabled: false` in the plugin settings or `REFEREE_HOOKS=off` in the environment turns every hook off, whatever the project file says.

## Where settings live

| Where | Who writes it | What it sets |
|---|---|---|
| `/plugin configure claude-referee`, or `claude plugin configure claude-referee --values-stdin` (Claude Code 2.1.285+) | You | `api_key` (stored by Claude Code as a sensitive value), `packs_dir`, `hooks_enabled`, `model` (default `jev-1.13.0`) |
| `.claude/referee.json` (commit it) | The repository | The pack, optional `areas`, which hooks run, stricter thresholds |
| `.claude/referee.local.json` (gitignore it) | You | Personal overrides, same schema as the project file |
| Environment | You | See [environment variables](#environment-variables) |

## The project file

```json
{
  "pack": "generic",
  "areas": [
    {
      "prefix": "services/api/",
      "checks": ["cargo nextest run --profile ci", "cargo test --doc"],
      "evidence": ["target/nextest/ci/junit.xml"]
    },
    { "prefix": "web/", "checks": ["npx tsc --noEmit", "npx vitest run"] }
  ],
  "hooks": { "sessionStart": true, "stopGate": "shadow", "preModelSwitch": true }
}
```

`cargo nextest` doesn't run doctests, which is why the example lists `cargo test --doc` as a second check. The `evidence` path assumes JUnit output is turned on for the `ci` profile in `.config/nextest.toml`.

| Key | Values | Default |
|---|---|---|
| `pack` | A pack name from the plugin or from `packs_dir` | required |
| `areas` | Per path prefix: the check commands, evidence files (v0.2) and an optional pack | none |
| `thresholds` | Per-question overrides in the same shape as the pack's `thresholds.json`, and `cacheGuardUsd` (v0.2), the re-cache cost at which the cache guard asks. They can only make a check stricter, so `cacheGuardUsd` can only go down | the pack's; `cacheGuardUsd` 0.25 |
| `hooks.sessionStart` | `true` or `false` | `true` |
| `hooks.stopGate` | `off` or `shadow` (in `main`, not released); `active` is not built yet | `off` |
| `hooks.preModelSwitch` | `true` or `false` (v0.2) | `false` |

`areas` tells claude-referee which checks count as proof for which part of the repository. The session briefing shows only the area where the session started. A pack can ship default areas in `areas.json`; they apply only when the project file has no `areas`. From v0.2, an evidence file counts only if it changed after Claude's last edit, so a stale report is treated as no evidence.

### Done-gate modes

The done-gate looks at a stop only when Claude edited files and no check passed after the last edit. It then asks Jev whether Claude claimed success it didn't verify.

- **`off`**: nothing runs.
- **`shadow`**: asks Jev and records the decision in `stops.jsonl` in the data directory, but never blocks and prints nothing. It records the turns it skipped and why (no edits, a passing check after the last edit, `stop_hook_active`, background tasks, circuit breaker open). `claude-referee receipts --stops` lists the decisions with precision and false-block figures; `--unlabelled` shows the ones to review, and `--label <id> --right` or `--wrong` marks one. The record keeps the first 200 characters of the prompt and of the final message on your machine to help you label.
- **`active`** (not built yet): when Jev says the claim is unverified, the stop is blocked and Claude gets a note of at most 300 characters naming the area's check command. It blocks at most three times per session, with a 60-second cool-down.

`active` isn't recommended until shadow mode has at least 50 labelled stops with a precision of at least 0.8 and no more than 5% false blocks. It must also let through no more false "done" claims than Claude Code's built-in `/goal`, at a lower total cost. Both modes send the data listed in [privacy](privacy.md).

## The API key

claude-referee looks for the key in this order:
1. The plugin setting
2. `TYPESAFE_API_KEY`
3. `EVAL_TYPESAFE_API_KEY`
4. `TYPESAFE_API_KEY_CMD`
5. The macOS Keychain item `TYPESAFE_API_KEY`

Claude Code passes plugin secrets to hooks but not to the shell, so the commands Claude runs need one of the other sources. The Keychain and `TYPESAFE_API_KEY_CMD` work for both:

```bash
# macOS: prompts for the key, so it stays out of your shell history
security add-generic-password -a "$USER" -s TYPESAFE_API_KEY -w

# Linux (Secret Service, not yet tested): store it once...
secret-tool store --label="TypeSafe API key" service typesafe
# ...then add this line to your shell profile, so Claude Code inherits it
export TYPESAFE_API_KEY_CMD="secret-tool lookup service typesafe"
```

`TYPESAFE_API_KEY_CMD` is:
- read only from your environment, never from a project file
- run without a shell, so it must be a single command that prints only the key
- run at most once per process, with a 5-second timeout

claude-referee trims the key and rejects it with a configuration error if it contains spaces, control characters or non-ASCII characters. `npx claude-referee doctor` shows which source provided the key, never the key itself.

## Environment variables

| Variable | What it does |
|---|---|
| `TYPESAFE_API_KEY` | The API key |
| `EVAL_TYPESAFE_API_KEY` | The API key for evals and `claude plugin eval` runs, which pass on only a fixed allowlist and `EVAL_*` variables |
| `TYPESAFE_API_KEY_CMD` | A command that prints the key |
| `TYPESAFE_MODEL` | Overrides the `model` setting. The pack's thresholds were tuned on the default model |
| `TYPESAFE_BASE_URL` | The API root, `https://api.typesafe.ai` by default. For proxies and tests |
| `REFEREE_HOOKS=off` | Turns every hook off |
| `REFEREE_DATA_DIR`, `REFEREE_PACKS_DIR`, `REFEREE_PACK`, `REFEREE_MODEL` | Set for you. The session briefing hook exports them to Claude's shell through `CLAUDE_ENV_FILE`, so the commands Claude runs use the same data directory, pack and `model` setting as the hooks. `TYPESAFE_MODEL` still wins over `REFEREE_MODEL`. It never exports the key |

Outside Claude Code, the CLI works out the default data directory itself. Pass `--data-dir` to use another one.

## Packs

Questions and thresholds live in packs, not in code. A pack is a directory of data files:

```text
my-pack/
├── pack.json          name, version, the Jev model it was tuned on, optional "extends"
├── questions/*.json   the questions
├── thresholds.json    a threshold for each question
├── cheatsheet/*.md    optional: session.md is the session briefing text
├── redact.json        optional: extra redaction patterns
└── areas.json         optional: default areas, used when the project file has none
```

A question file maps question IDs to questions:

```json
{
  "done.met": {
    "type": "noul",
    "instructions": {
      "question": "Does `evidence` show that `criterion` holds?",
      "note": "A claim of success in prose is not evidence."
    },
    "criteria": {
      "true": "The check output directly shows that the criterion holds.",
      "false": "The output does not show it, or shows that it fails."
    }
  }
}
```

The matching entry in `thresholds.json`:

```json
{ "done.met": { "met": 0.7, "missing": 0.5 } }
```

Where the bundled numbers come from: `done.met`'s 0.7 and 0.5 were chosen on 25 cases in the earlier private kit, so they're in-sample, with no hold-out yet. `verify.relation` (supports 0.8, contradicts and says nothing 0.5) and `verify.injection` (0.7) were set by hand and checked once on 60 held-out claims. A replay of the recorded answers found nothing to tune: see [verify v2](measurements.md#verify-v2-on-held-out-claims). The 0.9 bands for `judge` follow the kit's rule of acting only at 0.90 or above. `line.risky` and `failure.env` have no eval yet.

`cheatsheet/session.md` may use three placeholders: `{{pack}}`, `{{cli}}` (the absolute path of the bundled CLI) and `{{checks}}` (the area's check commands). The briefing is capped at 800 characters.

`redact.json` adds patterns; it can never remove the built-in ones:

```json
{
  "stop": [{ "kind": "internal_token", "pattern": "\\bitk_[A-Za-z0-9]{24,}" }],
  "replace": [{ "kind": "account_id", "pattern": "\\bacct_[0-9]{8}\\b" }]
}
```

Packs are data only; claude-referee never runs code from a pack.

The `generic` pack has these questions: `done.met`, `verify.relation`, `verify.injection`, `decide.best`, `decide.fit`, and for `judge`, `line.risky` and `failure.env`.

The `generic` pack ships with the plugin. Your team's packs can live in a private repository. To use them:
1. Point `packs_dir` at that repository.
2. Name the pack in `.claude/referee.json`.

`npx claude-referee lint-pack <path>` (v0.2) checks a pack against TypeSafe's question-writing rules.

## Always-on cost

While claude-referee is enabled, its skill listing adds at most 250 tokens to every session, even in projects without `.claude/referee.json`. Each release is checked against that limit. Hooks start a short Node process at the events they handle. `claude plugin details claude-referee` shows the always-on token count.

## Update and uninstall

- **Update:** third-party marketplaces don't auto-update by default. Run `claude plugin marketplace update claude-referee`, then `claude plugin update claude-referee@claude-referee`. You can also turn on auto-update for the marketplace in `/plugin` → **Marketplaces**.
- **Export receipts:** `npx claude-referee receipts export --out receipts.jsonl`.
- **Uninstall:** `claude plugin uninstall claude-referee@claude-referee` deletes claude-referee's data directory, including receipts and the cache, unless you add `--keep-data`.

## Troubleshooting

- **Hooks stay silent but `doctor` works in your terminal.** Claude Code probably can't find Node 20.3 or later on its own `PATH`. That happens most often when Claude Code is launched from a desktop app instead of a shell.
- **`doctor` finds no key, but hooks work.** The key is stored only as a plugin setting, which reaches hooks but not the shell. Add the Keychain item or `TYPESAFE_API_KEY_CMD`.
- **The cache guard never asks.** It asks only when re-caching would cost at least `cacheGuardUsd` ($0.25 by default). It also needs Claude Code 2.1.251 or later, a warm cache, an interactive `/model` switch, and `hooks.preModelSwitch` in the project file.
- **`npx claude-referee` and Claude disagree.** `npx claude-referee` runs the copy published to npm, while Claude runs the copy bundled with the plugin. Run `npx claude-referee@<version>` with the plugin's version, which `/plugin` shows, to match them.
