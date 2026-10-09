# Detected checks in the SessionStart briefing

Registered 2026-10-09, before any code change. The owner approved the order of four usage fixes ("tamam sırası ile yap bunları"); this is the first.

## Why

The briefing ends with `Checks here: <checks>`. The checks come only from `areas[].checks` in `.claude/referee.json`. On the owner's machine all 14 projects with a project file have the same file (`pack`, `hooks.stopGate`) and no areas, so every briefing says `none listed in .claude/referee.json`. Claude is never told which command proves the work, and the Stop gate in `shadow` mode never nudges it: in the local stop store, 21 of the 41 turns with edits ended with no counted check (since `turn` was recorded, 98 turns).

## The rule

When no area matches (no `areas`, or none for the working directory), the briefing lists up to 4 checks detected from the manifests of the nearest directory, from the working directory up to the project root, that has `package.json`, `composer.json`, `Cargo.toml` or `go.mod`:

- `package.json` scripts named `test`, `typecheck`, `lint`, `check`, `build`, `ci`, `verify` (and `name:suffix` forms), listed as `npm run <name>`, `pnpm run`, `yarn` or `bun run` by lockfile (`npm` when none);
- `composer.json` scripts with the same names, as `composer <name>`; with a `laravel/framework` requirement or an `artisan` file and no `test` script, `php artisan test`;
- `Cargo.toml`: `cargo test`; `go.mod`: `go test ./...`.

Only script names are read, never script bodies. Order: test, typecheck, lint, check, build, ci, verify. The text says `(detected)` after the list. Nothing is written, nothing is sent, no network; any read or parse error falls back to the old text. Explicit `areas` checks win and the output for them is byte-identical to before.

## Bars

- **B1 (explicit wins):** a project with a matching area prints exactly the old text (existing tests unchanged).
- **B2 (detected):** a temp project with `package.json` scripts `test`, `build`, `lint` prints `npm run test; npm run lint; npm run build (detected)`; a `pnpm-lock.yaml` gives `pnpm run`; composer scripts and `artisan` give the composer and `php artisan test` forms.
- **B3 (none):** no manifest, or a manifest without matching scripts, prints `none listed in .claude/referee.json` as before.
- **B4 (safe):** an unparsable `package.json` does not throw and falls back to B3.
- **B5 (limits):** at most 4 checks; the briefing stays within 800 characters; the same input is byte-identical twice.
- **B6 (nearest):** from a subdirectory with its own `package.json`, that file is used, not the root one.
- **B7 (gates):** `npm run check` and `ci:local` green; Jev `done` on the test output with its exit code.
- **Report (not a bar):** how many of the owner's 14 project roots yield at least one detected check (aggregate count only, no names).

## Limits

- The list names commands the manifest offers, not commands that pass; it says nothing about the work being right.
- Monorepos with several manifests below the working directory get the nearest one only.
- Python, Ruby and JVM projects get no detection.
- The briefing wording in the template does not change, so the recorded briefing evals are not affected; only the value of `{{checks}}` does.
