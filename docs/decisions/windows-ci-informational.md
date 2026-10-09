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

## Result of the first run (2026-10-09, commit 6b933ed)

B1 held: the run concluded `success` with the `windows` job failed. Typecheck passed on Windows; `npm test` ran 1,109 tests with 63 failing (1,045 passing). By area, aggregate counts:

- **Maintainer-only harness tests, 46:** the GitHub Action recipe (13), the session-study runner and tasks (8, 7, 5, 1), the bench harness (5, 1), the install canary (3), `done-bar` (2), `describe-drift` (1). They drive bash, python or POSIX paths and are not shipped.
- **Product-facing, 17:** Stop gate record pruning and locking (8: file rename and lock behaviour on Windows), the checkout class reads a plain main checkout as `linked` (1, git prints forward slashes where Windows paths use backslashes), the data directory order test (1, a path-form assertion), decide's home-directory replacement keeps `\` in a path (1), UI launcher and git spy (2), parallel sessions in the breaker (1), the abort/crash timeout line (1), a receipt-outcome eval path (1, `D:\D:\` doubled drive), a session-derived fixture (1).

Typical causes in the log: line endings (`\r\n`, 36 mentions), path separators and drive letters (assertions, `ENOENT` 10), POSIX-only helpers. Fixing is separate work, decided with `decide`. The README keeps "Windows isn't tested yet".
