# Rename to evidence-referee reverted

Decision by the maintainer, 2026-10-02: commit 235ebd8 (rename to `evidence-referee`) is reverted before any release.

- Seen: Claude Code 2.1.287 `claude plugin validate` reports names starting with `claude-` as reserved for third parties (`Plugin name "claude-referee" is reserved: it passes as one of Anthropic's own`).
- Install and run still work at 2.1.287: `claude plugin marketplace add` and `claude plugin install claude-referee@claude-referee` succeed and the installed CLI runs.
- Widely used plugins such as claude-mem fail the same validation, so the error is not specific to this plugin.
- The rename was precautionary, not required, hence reverted.
- Mitigation: `scripts/validate-plugin.mjs` ignores only this one error for `claude-referee`; every other error or warning still fails CI.
- Risk accepted: a future Claude Code could refuse the name at install. Fallback: `evidence-referee`, which is unclaimed on npm.
- Data: anyone who ran main between 235ebd8 and the revert has data under `evidence-referee-evidence-referee`; copy it back to `claude-referee-claude-referee`.
