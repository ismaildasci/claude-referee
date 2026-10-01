# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's private reporting instead: the repository's **Security** tab → **Report a vulnerability**. If that isn't available to you, email hello@ismaildasci.com with "evidence-referee security" in the subject.

Include the version, what you did, what happened and, if you can, a minimal reproduction without real secrets. The maintainer aims to answer within seven days. Fixes are released as a patch version and credited in the changelog unless you'd rather stay anonymous.

## What evidence-referee is, and isn't

- **Not a security boundary.** Its checks fail open and can be switched off with `REFEREE_HOOKS=off`. Use permission rules, branch protection and code review to enforce anything.
- **Redaction is pattern-based.** It stops requests that contain credential-shaped values and replaces emails, IP addresses and your home path. It can miss a secret in an unusual format, and it can't clean free text such as a customer's name written in prose. `--dry-run` shows exactly what would be sent.
- **Text inside the evidence can steer a verdict.** Jev reads the evidence as text, so a line in it that addresses the judge can move the answer. In a test of 33 logs, such a note changed no verdict when the log showed the failure and the exit code, but on a log cut off before its summary it moved `done` from missing to met ([measurements](docs/measurements.md#instructions-inside-the-evidence)). Pipe the whole output with its exit code, and treat verdicts on output you don't control as advisory. In the unreleased `done` v2, output from a recognised test runner, linter or type checker is parsed in code and only counts, the exit code and failing test names are sent, and output that isn't recognised can never return `met` ([measurements](docs/measurements.md#done-v2-on-held-out-cases)).
- **Data leaves your machine** when a command asks Jev: the redacted input goes to TypeSafe's API, hosted in the US. See [docs/privacy.md](docs/privacy.md).
- **The API key** is read from the plugin setting, the environment, a key command or the macOS Keychain. evidence-referee never writes it to receipts, the cache, `CLAUDE_ENV_FILE`, output or project files. A key command runs without a shell and only when it comes from your environment, never from a project file.
- **Packs are data.** evidence-referee never runs code from a pack. Project files can only make thresholds stricter and can't set the key, the key command or the packs directory.

## In scope

- A secret reaching TypeSafe, a receipt, the cache or Claude's context despite matching a documented stop pattern.
- The API key appearing anywhere evidence-referee writes.
- A project file or pack causing code to run, or loosening a threshold.
- A hook blocking or crashing a Claude Code session instead of failing open.

## Out of scope

- Sensitive free text that no pattern describes; that's a documented limit.
- Anything that requires an already compromised machine or Claude Code installation.
