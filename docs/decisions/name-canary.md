# Name canary

Decision, 2026-10-02: the name stays `claude-referee` ([rename-reverted.md](rename-reverted.md)); a weekly canary watches the one risk that decision accepts.

## What it detects

Claude Code 2.1.287 `claude plugin validate` reports the name as reserved, yet installs work. If a later release refuses the install, every user breaks silently. `.github/workflows/canary.yml` (weekly Monday plus manual dispatch) installs `@anthropic-ai/claude-code` at `latest` and at the pinned last known good (2.1.287), then runs `scripts/canary-install.mjs`:

- `claude plugin marketplace add <checkout>` and `claude plugin install claude-referee@claude-referee`, in a temp `CLAUDE_CONFIG_DIR` and `HOME` (nothing of the runner's or developer's config is touched);
- the plugin appears in `claude plugin list --json`, is enabled, and has the repo's `plugin.json` version;
- the installed `dist/cli.mjs --version` prints that same version;
- Claude Code's version is printed and appended to the job summary.

It uses no secrets and never needs the TypeSafe key (the key variables are removed from the child environment). On failure a separate `report` job, the only one with `issues: write`, opens or comments on one issue titled "Canary: Claude Code install check failing". It runs only in `ismaildasci/claude-referee`, never for forks. Locally: `node scripts/canary-install.mjs` (exit 0 pass, 1 fail, 2 no claude binary); `npm run ci:local` runs it when `claude` exists.

Reporting choice (issue job vs failed run only) went through `decide`: issue 0.90, failrun 0.09, both orders agree, clear (receipt rmuqawssp53lj).

Not detected: a refusal that only appears in the interactive `/plugin` UI, or a community-marketplace validation verdict.

When a newer Claude Code is verified good, raise the pin in the matrix.

## Fallback plan (listed, not executed)

Fallback name: `evidence-referee`, unclaimed on npm. Steps if the canary shows `latest` refusing the name:

1. Confirm with the failing run's log and a local `node scripts/canary-install.mjs` against that Claude Code version.
2. Rename plugin, marketplace and CLI references to `evidence-referee` (`.claude-plugin/marketplace.json`, `plugin.json`, `package.json`, skills, hooks, docs, `validate-plugin.mjs` filter becomes unnecessary, the install id in the canary).
3. Rebuild `dist` and `npm/`, release a version, publish to npm under the new name (subject to the npm lock).
4. Tell users to reinstall; data moves from `claude-referee-claude-referee` to `evidence-referee-evidence-referee` in the data dir (same copy step as in rename-reverted.md, reversed).
5. Re-run the canary with the new id.

Commit 235ebd8 holds the earlier rename and is the reference for the file list.
