# Pending: action stream

## CHANGELOG (Unreleased, Added)

- A composite GitHub Action (`action.yml`) that runs `done` on a test log and `claims` on the doc lines a pull request adds, uploads results and receipts as an artifact, and skips with exit 0 and nothing sent when no TypeSafe key is available (fork pull requests). Recipe: `docs/recipes/github-action.md`.

## ROADMAP (v0.5)

- Mark "A CI recipe and a GitHub Action" as built (unreleased): action.yml, action/run.sh, docs/recipes/github-action.md, test/action.test.ts. Not yet exercised on a hosted runner.

## Integrator notes

- Add `docs/recipes/github-action.md` to the README docs list if one exists.
- The action runs the committed `plugins/claude-referee/dist/cli.mjs`; rebuild dist as usual.
- No dogfooding workflow was added on purpose (see the recipe, "Fork pull requests").
