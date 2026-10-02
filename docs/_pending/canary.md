# Pending: canary

CHANGELOG (Unreleased):
- Added a weekly canary workflow that installs the plugin with the latest and the pinned Claude Code in an isolated config dir, and a local `scripts/canary-install.mjs` (also run by `npm run ci:local` when `claude` exists).
- Added docs/decisions/name-canary.md with the detection scope and the unexecuted `evidence-referee` fallback plan.

ROADMAP: none (name stays claude-referee).
