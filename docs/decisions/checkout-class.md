# A checkout class on new receipts and stop records

Registered 2026-10-08, before any code change. Chosen with `decide` (class-first 0.95, the other two 0.01 and 0.03; both orders agreeing; receipt `rmuznxdo7hi07`). It is the prerequisite for the held grouping decision in [repo-root-grouping.md](repo-root-grouping.md): without it, eval-run receipts from `.claude/worktrees` cannot be told apart once they are joined.

## Why

Receipts and stop records keep a project id, a hash of the directory. They keep no word that says what kind of checkout the command ran in, so a linked worktree, an eval worktree and the main checkout of one repository look the same once they share an id. On the owner's machine that is 84 receipts from `.claude/worktrees` against 826 from the main checkout in the grouped view (session-10 and local-store measurements, aggregate counts).

## The rule

A new field `worktree` on each new receipt and stop record, with one of four fixed words, computed from the cwd the command ran in:

- `main`: the cwd is in a checkout whose git dir is the common dir (the main checkout, and a submodule, which has its own git dir);
- `claude-worktree`: a linked worktree whose toplevel path contains `/.claude/worktrees/`;
- `linked`: any other linked worktree;
- `no-checkout`: outside git, or a bare repository (no toplevel).

The path is inspected to choose the word and is never stored. Old records are not backfilled and do not get the field. No verdict, reason or fact depends on the field.

`docs/privacy.md` lists the field with its four values and says it never holds a path.

## What will be reported, and the bar

- **Bar 1 (recorded suites):** the 512 entries of `jev-evals` keep their facts (`eval-facts`, base against the change). Expected: none change.
- **Bar 2 (writers):** every receipt and stop written in a test carries `worktree` with one of the four words; the class is `main` in a main checkout, `linked` in a linked worktree outside `.claude/worktrees`, `claude-worktree` inside it, and `no-checkout` outside git and in a bare repository. Tests use temp repositories built with real git.
- **Bar 3 (no path):** the stored receipt and stop text of a command run in a `.claude/worktrees` checkout contains no `.claude` and no path separator in the new field.
- **Bar 4 (privacy):** `docs/privacy.md` names `worktree` and its four values; a test fails if a receipt field written by the code is missing from that list.
- **Bar 5 (old records):** a receipt without the field reads, counts and verifies as before (existing tests stay green).
- **Bar 6 (gates):** `npm run check` and `ci:local` green; Jev `done` on the test output and on this repository's typecheck, with exit codes.
- **Report (not a bar):** the class of each live checkout on the owner's machine, counted per class (aggregate only), to show that the classes occur on real repositories.

## Limits

- The class says what kind of checkout a command ran in, not which project it belonged to; the grouping decision still needs its own bars.
- A submodule is `main`, not `linked`; a bare repository is `no-checkout`.
- Records written before this change have no class, and the reports say so rather than guess.
- Windows path separators are not covered by the test; no Windows log was checked.
