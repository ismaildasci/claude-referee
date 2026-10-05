# A recipe for the project `verify` skill

Claude Code can run a skill named `verify` right before it commits. This page gives a ready `SKILL.md` that makes that step a `claude-referee done` check on your test output. The plugin does not write the file into your project; you copy it yourself.

## Install

```sh
mkdir -p .claude/skills/verify
curl -fsSL https://raw.githubusercontent.com/ismaildasci/claude-referee/main/docs/recipes/verify/SKILL.md -o .claude/skills/verify/SKILL.md
```

Or copy [docs/recipes/verify/SKILL.md](recipes/verify/SKILL.md) by hand, into `.claude/skills/verify/` in a project or `~/.claude/skills/verify/` for all projects. Then change the test command in step 1 to your own. The recipe needs `claude-referee` available through `npx` and a TypeSafe key (see [configuration](configuration.md#the-api-key)).

## What Claude Code does with it

Verified against official sources on 2026-10-01:

- The changelog entry for 2.1.286 reads: "Improved commit guidance: when your project or user skills include one named `verify`, Claude is now told to run it right before committing, except for docs-only and tests-only commits" ([changelog](https://code.claude.com/docs/en/changelog)). The page is fetched live and was not pinned to an archived copy.
- The skills page says a recorded project skill at `.claude/skills/verify/SKILL.md` replaces the bundled `/verify` (needs 2.1.200 or later) and lists the frontmatter fields used here: `name`, `description`, `allowed-tools` ([skills](https://code.claude.com/docs/en/skills)). It does not itself mention the pre-commit run; only the changelog does.

"Told to run it" is guidance in Claude's prompt, not a hook. Claude can still skip it, so it is not a gate. For a gate that blocks a stop, see the done-gate (`hooks.stopGate`) in the [README](../README.md).

## Limits

- A project skill named `verify` replaces the bundled `/verify`, which builds and runs your app. If you rely on that, keep the app-run step in your copy of the recipe or give this one another name and call it yourself.
- Docs-only and tests-only commits skip the step by design.
- Each check is one Jev request; repeats of the same evidence come from the local cache. See [economics](economics.md).
- Output from a runner the referee does not recognise is sent as text and can never count as `met` (see `done --describe`). The recipe appends an `exit code:` line so a failing run of such a runner is `missing`; a passing run with only that line is usually `unsure`, not `met` (0 of 67 passing steps on real CI logs). Pipe the runner's own summary where you can.
- Privacy: the redacted test output leaves your machine on every check (sent to the TypeSafe API, which runs in the US). Input that looks like a password, key or token is not sent. Read [privacy](privacy.md) before enabling a skill that fires before each commit.
