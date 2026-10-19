# The briefing names only the `--run` families that exist here

Registered 2026-10-19, before any code change. Found in the owner's local transcripts, not in a test. Advisor first. Scope chosen with Jev `decide` over three options (leave it; name the detected families; put family labels in front of each check): clear, the detected families 0.98 against 0.01 and 0, both orders agree, receipt `rmvf9obpwg5sr`; the option costs were written by the assistant.

## Why (local data, aggregates only)

- The session cheat sheet says `done --run <test|lint|typecheck|build|check>` in every project. `--run` runs only a check that `detect-checks` finds in the manifest, so a family the project does not have is refused (`--run takes a detected check by family or exact command`), and with no detected check at all every `--run` is refused (`No check was detected here`).
- Local transcripts of every project on this machine hold 12 `done --run` calls in 4 sessions; 2 were refused, both with `check`, in 2 of the 4 sessions. The refusal lists what is detected, so the next call recovers: the cost is one wasted call, at most one per session. Small sample (the live install is two weeks old), which is why this is a small fix and not a claim of effect.
- [briefing-detected-checks.md](briefing-detected-checks.md) measured 8 of 14 project roots with a detected check, so the other 6 get a briefing that advertises `--run` and can never succeed there.
- The list is wrong in the other direction too: `ci` and `verify` are detectable families that the briefing never names.

## The rule

1. The briefing's `--run` line lists the runnable families of the checks it already shows (the same cap as `Checks here`: at most 4 commands, 80 joined characters; subfolder checks whose folder name is not plain are not runnable and are left out). So `Checks here: npm run test; npm run build` goes with `--run <test|build>`.
2. No runnable check: the `--run` sentence is replaced by one that says no check is detected and to pipe the output of the check that was run. The pipe example line stays as it is.
3. A pack whose session cheat sheet does not use the new placeholder is untouched (custom packs keep their own text).
4. Verdicts, parsers and egress do not change.

## Bars

- **E1 (tests):** a manifest with `test` and `build` scripts gives `<test|build>`; a project without a `check` script never offers `check`; a `ci` script is offered; no manifest, or only a non-runnable subfolder check, gives no `--run` and the pipe line; explicit `areas[].checks` change `Checks here` but not the families; a pack template without the placeholder renders as before; same input gives the same bytes.
- **E2 (size):** the existing worst-case test stays at 700 characters or less with a long install path, and the last line is kept.
- **E3 (consistency):** the `done --run` describe text, the `jev` skill and the README name the same seven families (they already do; the briefing was the only subset).
- **E4 (gates):** `ci:local` green, recorded evals unchanged (the briefing is not in them).
- **Report (not a bar):** after the live update, the share of `done --run` calls refused, against 2 of 12.

## Cost, stated up front

- The saving is at most one call per session where Claude would have tried an absent family; it is not a verdict change and cannot produce a `met`.
- The briefing is no longer one fixed sentence per pack: it varies with the manifest. It stays byte-stable for the same input.
- A runnable family beyond the 4 shown (or beyond 80 joined characters) is not named, though `--run` accepts it; the refusal text lists all of them.
- The owner's global `~/.claude/CLAUDE.md` carries the same fixed list. If Claude follows that file, a refused `--run check` can survive this change, so a later drop cannot be credited to the briefing alone. That file is the owner's to edit.
- Not measured: the effect on real calls. Live is still on an older commit, so this is one more unshipped change until the owner runs `claude-referee-live-update`.

## Result

- **E1:** `test/detect-checks.test.ts` (14 tests, one rewritten): the families follow the manifest (`<test|build>`, `<ci|verify>`, `<test>` with explicit area checks), at most the 4 shown (`test|lint|check|build` from five scripts), and a project with no manifest, only a non-runnable subfolder check, or area checks and no manifest gets `done --run finds no check here; pipe the check's output instead` with the CLI path kept (without it the pipe line had no path). The old test that required the `--run` sentence in a project without checks now requires the nudge once and the `--run <` form only where a check exists; that is the one contract change (briefing-done-nudge B1 said "with and without checks").
- **E2:** briefing length with a 73-character install path, before and after: no manifest 632 to 595, four long script names 676 to 664, all seven families 668 to 662. It never grows (the family names are shorter than the old fixed list, at most four are shown, and the no-check sentence is shorter).
- **E3:** the `done --run` describe text and the `jev` skill already list all seven families; nothing else needed a change.
- **E4:** `npm run check` green; `ci:local`: see the commit.
