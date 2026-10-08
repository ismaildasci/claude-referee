# Grouping a repository's worktrees under one project id

Registered 2026-10-08, before any code change. Follows the session-join work in 0.2.5 (`receipts --session`), which joins a session's records across project ids and does not change project ids.

## Why

A project id is a hash of the directory a command or stop ran in. A repository worked on in its main checkout, in `.claude/worktrees` (eval runs, agent worktrees) and in sibling linked worktrees therefore has several ids, and its receipts and stops are split across them. Measured on the user's machine in session 10 (aggregate counts only): 38 ids. Two shares come from an analyst's map and were not measured again: about 27% of receipts in sibling worktrees, and 71 of the 99 receipts under `.claude/worktrees` being decide-scale eval runs.

## The option

**D:** the id of a checkout is the id of its main worktree, found with `git rev-parse --path-format=absolute --git-common-dir` (the directory named `.git` gives its parent). Outside git, the id stays the directory's, or the `REFEREE_PROJECT` value that SessionStart exports. Reads also accept the old per-worktree ids of worktrees that still exist, as aliases.

Measured with the session-10 map (scratch files, not in the repo): 38 ids become 25. Of the receipts, 382 and of the stops 83 join the main view through aliases (13 worktree ids, 7 still on disk). 35 receipts and 4 stops of removed worktrees cannot be joined again, because they only keep their old id.

## Alternatives not chosen

- **Keep ids per directory and join in reads only (session key, the 0.2.5 work):** done for sessions; does not group a repository's worktrees.
- **Session start directory as the id:** a session started in a parent folder then absorbs several repositories (measured: 95 stops change id, 92 of them to a non-git parent). Rejected by measurement.

## What will be reported, and the bar

- **Bar 1:** no recorded eval entry changes (`eval-facts`, 512 entries). Expected: none, since the eval suites carry no project ids.
- **Bar 2:** the aliases keep every receipt and stop of an existing worktree in the main view: counted before and after on the session-10 map, the 382 and 83 numbers reproduce.
- **Bar 3:** eval-run receipts of `.claude/worktrees` are reported separately (count per view), so the mixing risk is measured, not argued. The mixing is accepted only if the run-id filter reproduces the per-worktree totals.
- **Bar 4:** tests on a real temporary repository with `git worktree add`, a submodule-shaped and a bare-repo-shaped case, and a non-git directory. `npm run check` and `ci:local` green.
- **Bar 5:** `verify --project-only` on the main chain still verifies after the change; old chains stay in their own directories and are not rewritten.

Shipping is decided with `decide` (ship or hold, both orders) after a replay of the bars. If the decision is hold, the per-worktree ids stay and the session join stays the only join.

## Limits

- Two agents writing to one main chain at once make more `fork` results in `verify`.
- Git older than 2.31 lacks `--path-format`; the fallback is a second spawn.
- Worktrees that were kept apart on purpose (for example a branch comparison) become one project once joined, and that cannot be undone from receipts.
- Only the session-10 map was measured; no later machine state was checked.

## Decision to implement

`decide` (implement or keep, both orders, this record as context): `implement` 0.97, `keep` 0.03, orders agreeing (receipt `rmuzizyskvg8m`). The implementation follows the bars above in its own commits; this record is registration only, no code has changed.
