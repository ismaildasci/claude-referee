# The echoed command as a fact for exit-code-only evidence

Registered 2026-10-09; the experiment came first and the measured numbers below decided the shape. Chosen with `decide` among three options (allowlisted tool names o3 0.62 on the first ask, 0.87 after one added fact, both orders agreeing; receipts `rmv13gzd3u0hy`, `rmv13hw7agvsz`). Below the 0.90 bar, so the option with the smaller privacy cost was taken, as the project rule says.

## Why

Real runs of the owner: the evidence `$ tsc --noEmit` and `exit code: 0` is `missing` (p 0.2) for "typecheck passes", while `tsc exit code: 0` is `met` (0.91). For exit-code-only evidence the facts sent to Jev hold the exit line text (80 characters) and not the echoed command, so Jev cannot tell what ran. The README had to tell users to put the tool name in the exit line.

## The rule

For `trust: exit_code`, up to three echoed command lines (`$ cmd` or `> cmd`, at most 80 characters, exit lines excluded) are sent as `command_lines`, only when the command's first word is a known check tool (`tsc`, `vue-tsc`, `eslint`, `oxlint`, `biome`, `prettier`, `ruff`, `mypy`, `pytest`, `phpunit`, `pest`, `vitest`, `jest`, `mocha`, `npm`, `pnpm`, `yarn`, `bun`, `npx`, `node`, `cargo`, `go`, `dotnet`, `make`, `mvn`, `gradle`, `composer`, `php`, `python`, `rake`, `bundle`, `rubocop`, `rspec`, `flutter`, `dart`, `swift`, `mix`), and none for a log in which an echoed check command hides, redirects or tolerates its output or failure (`||`, `; true`, `--quiet`, `-q`, `--silent`, `--format`/`-f`, `-o`, `--fix`, `> file`, `2>/dev/null`). Runner-parsed logs are unchanged. The table grows only from real output.

## Measured (re-recorded answers, same cases and model; 270 cases, 269 requests)

- Wrong `met` is 0 on every done suite and on the injection suite (33 logs: no `met`), unchanged. Recall against the committed recordings: done-v2 0.77 to 0.83 (37 to 40 `met`), hold-out 4 0.61 to 0.71 (13 to 15), the other hold-outs unchanged (hold-out 6 stays 0.45). The unfiltered prototype (every echo, no allowlist) reached 0.80 on hold-out 4 and 0.50 on hold-out 6 but turned `eslint --quiet .` into a wrong `met` (0.89), so the hiding filter is part of the design; the allowlist keeps non-check commands (`./deploy.sh`, `echo`, shell functions) from leaving the machine.
- `done-silent`: a silent `tsc --noEmit` echo with exit 0 now reads `met` for "typecheck passes", which is true; its expected label (first `unsure`, by policy) was changed to `met`, and the suite has 0 wrong `met`.
- The recorded answers of the done and injection suites were replaced by the re-recorded ones (latest-only files; the old files held earlier recordings that are no longer comparable).

## Costs

- **Privacy:** up to three command lines (80 characters each) now leave the machine in exit-code-only runs, after the usual redaction; arguments of an allowlisted command (a test path, a filter) are sent. Stated in `docs/privacy.md`, the `done` contract and the README.
- **Injection:** the command text is attacker-controllable like the exit line; the injection and adversarial hold-out groups show no `met` from it, which is evidence, not proof.

## Bars

- **B1:** `test/command-echo.test.ts`: the kept and dropped shapes, the hiding commands, the caps, and that only exit-code-only facts carry the field.
- **B2:** wrong `met` 0 on all done and injection suites after re-recording (met above).
- **B3:** `docs/privacy.md` and the README say what is sent; `npm run check` and `ci:local` green.
