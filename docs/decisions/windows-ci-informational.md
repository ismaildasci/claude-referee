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

## Follow-up (2026-10-09): fix batch chosen with `decide`

`decide` among four options (o2 1.00, both orders agreeing; receipt `rmv1083doj0by`): fix the checkout class and skip the maintainer-only harness tests on Windows (3a647a3, 0d064ca); the other product failures wait. Result in CI: the 46 harness tests are skipped (133 tests skipped in all, the harness files in full), and the checkout class works on Windows (the cause: git printed the long path form and a relative `..` path resolved against the 8.3 short temp path, `RUNNER~1`; `realpathSync.native` expands short names). Windows now shows 16 failing of 1,109 (960 pass, 133 skipped): Stop gate record pruning and locking 8, `ui` 2, and one each in `stop-sessions`, `receipt-outcome`, `decide` (home-directory path keeps `\`), `datadir` (path-form assertion), `breaker` (parallel sessions) and `abort-crash` (timeout line). The project id (`realpathSync` in `projectRoot`) was left alone on purpose: switching it could change the project hash, and so split receipt chains, on machines where it works today.

## Result of the fix batches (2026-10-09, commits dec3e5b and a9f2550)

The `windows` job is green: 1,125 tests, 987 pass, 0 fail, 138 skipped (the maintainer-only harness files, the two POSIX-shell fixtures in `ui`, the study fixture test and the two append-race tests). Causes fixed, aggregate: one product bug (Stop gate record pruning never ran on Windows because the file being replaced was still held open by the same process; the descriptor is closed first there), a path-form assumption in tests (a `.pathname` that carries a leading drive slash, absolute import specifiers that Node rejects on Windows, `/`-built expected paths), and a bare spawn environment. The two append-race tests exist only where a file can be renamed while another process holds it open, so they run on POSIX only; on Windows the pruning skips on contention and a line appended in the instant between the final tail copy and the replace can be lost (documented in the code and the changelog). `continue-on-error` stays for now: it is removed after the job has been green on several runs in a row. The README now says the unit tests run on Windows in CI and that the key step and a real Windows session are not tested.

## Enforced (2026-10-09, commit after c970647)

A docs-only commit turned the job red once: one of 16 parallel sessions in the breaker test lost its failure count, because Windows refuses a rename onto a file another process has open (the stale scan of a parallel session reads every entry). The rename is now retried a few times (c970647). After that the job was green on the push and on three reruns of the same run, so `continue-on-error` is removed: the `windows` job gates CI like the macOS and Ubuntu jobs. If it turns flaky, the right move is to find the cause in the log, as above, not to make it informational again.
