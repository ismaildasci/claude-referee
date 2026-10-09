# An informational Windows job in CI

Registered 2026-10-09, before any change. Chosen with `decide` among four options (o1 1.00, both orders agreeing; receipt `rmv0zvi9ug3f0`).

## Why

The README says three times that Windows is not tested yet (key step, `doctor`, install). CI runs ubuntu and macOS on Node 22, 24 and 26. The code handles paths in project roots, areas and the checkout class, tests build temporary git repositories, and the PowerShell key step was never run. There is no list of what breaks.

## The rule

A separate `windows` job in `.github/workflows/ci.yml` on `windows-latest`, Node 24: `npm ci`, `npm run typecheck`, `npm test`, with `continue-on-error: true` so it cannot turn a run red. Git is told not to convert line endings before checkout. Nothing else changes: no code, no README claim.

## Bars

- **B1 (cannot break CI):** a Windows failure leaves the workflow run green.
- **B2 (report):** the first run's failing tests are counted and listed by area (aggregate count in the result below), then one fix batch is decided separately.
- **B3 (claim):** the README keeps "not yet tested" until the job passes on its own; no Windows support is claimed from an informational job.

## Limits

- A job that is always red can be ignored; the plan is to fix the failures and then drop `continue-on-error`.
- Windows `git` and symlink behaviour in the tests may fail for reasons unrelated to the product.
