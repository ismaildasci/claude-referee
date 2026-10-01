# What leaves your machine

evidence-referee sends TypeSafe only what a judgement needs. Before anything goes out, it stops requests that contain something shaped like a secret, replaces personal details and caps the size of every field. Every command that calls Jev can show you its request first. Receipts and the answer cache stay on your machine, and your API key goes only to TypeSafe, as the credential on each request.

## Sent to TypeSafe

Requests go to `api.typesafe.ai`. TypeSafe's [privacy policy](https://typesafe.ai/legal/privacy-policy) says the service is hosted in the US.

| When | What is sent |
|---|---|
| Every call | The pack's question text and the input it asks about |
| `done` | Your criterion and the output you pipe in. Output from a runner evidence-referee has a parser for is parsed in code and only the counts, exit code and failing test names are sent; any other output is sent as text, its first 2,000 and last 12,000 characters |
| `decide` | The decision, any inline `context`, the option texts and the contents of your `context_files`. The choice is asked twice, in two option orders |
| `judge` and `verify` | The items, claims and source text you pass in |
| Done-gate in shadow mode | Each time Claude stops after editing without a passing check: the first 1,500 characters of your prompt, the last 2,000 characters of Claude's final message, the check commands with their pass/fail status, and the paths of the files Claude edited, without their contents |

The prompt and Claude's final message are free text. Patterns can't reliably clean free text, so keep the done-gate off where session text may not leave your machine.

The session briefing never calls the network.

## Check before sending

Add `--dry-run` to any command that calls Jev. evidence-referee prints the redacted input and a token estimate. Nothing goes over the network, and nothing is cached or logged:

```bash
cargo test 2>&1 | npx evidence-referee done --criteria "all tests pass" --evidence - --dry-run
```

If the input contains something shaped like a secret, the dry run stops with the same error the real command would give.

The done-gate has no preview. While it's on, in shadow mode too, it sends what the table above lists.

## Stopped before sending

A request that contains any of these is not sent at all:

- AWS access keys
- GitHub, Slack, Anthropic, OpenAI and TypeSafe API tokens
- JWTs and private key blocks
- Credentials in connection strings (`://user:password@`)
- Assignments whose names contain KEY, TOKEN, SECRET or PASSWORD, when the value looks like a secret rather than a type name, a translation key, a pagination token, an SSH algorithm name or another identifier

Values and object keys are both checked. Packs can add stop patterns in `redact.json`.

A command with a single input exits with code 1 and the error `credential_in_state`. A batch command skips that item, reports it and carries on. The error names the kind of value and the field it was in, never the value itself.

## Replaced before sending

- Email addresses
- IP addresses, but not four-part version numbers
- Your home directory, which becomes `~`
- UUIDs, added by the `generic` pack

Each replaced value becomes `[REDACTED:<kind>]`. Packs can add patterns, such as account IDs, but never remove the built-in ones. Each receipt records how many values were stopped or replaced, never which.

Redaction is pattern-based. It can miss a secret in an unusual format, and it can't find sensitive details written as prose, such as a customer's name in your prompt. Use `--dry-run` when you're unsure, and keep customer data out of anything evidence-referee reads.

## Stays on your machine

evidence-referee's data directory holds:
- **Receipts:** one line per command run: the command, pack, model, verdict, request IDs, request and cache-hit counts, input tokens, estimated cost, latency, redaction counts and a hash of the questions. Hook receipts add the Claude Code session ID. Planned: done-gate receipts will also note assertions removed from test files and new skip markers, as counts and file paths only. Receipts hold no request text.
- **The answer cache:** Jev's answers, keyed by the pack version, the model and hashes of the question and the redacted input. Entries expire after 30 days by default. `--fresh` skips the cache.
- **Done-gate stops and labels:** `stops.jsonl` and `labels.jsonl` (excerpts, scores, your labels). `receipts --stops` also reads your own Claude Code transcript on your machine to hint at a label from your next prompt; it keeps and prints only a fixed reason (`reported_broken` or `repeated_request`), never the prompt text, and sends nothing anywhere.
- **Results files:** the details of verdicts longer than 1,500 characters, such as per-item scores from `judge`.

When evidence-referee is installed as `evidence-referee@evidence-referee`, the data directory is `~/.claude/plugins/data/evidence-referee-evidence-referee/`. Receipts are grouped under a hash of the repository path, never the path itself. `npx evidence-referee doctor` shows where the directory is and how big it has grown. Uninstalling deletes it unless you add `--keep-data`.

evidence-referee never writes your API key anywhere: not to `CLAUDE_ENV_FILE`, receipts, the cache, tool output or project files.

## Retention

TypeSafe's [privacy policy](https://typesafe.ai/legal/privacy-policy) (updated November 19, 2025) says TypeSafe won't train or fine-tune models on your input. Its [data processing addendum](https://typesafe.ai/legal/data-processing) (updated April 24, 2026) keeps customer personal data "for as long as necessary", with no fixed period. Zero data retention is available to enterprise customers; see TypeSafe's [legal page](https://docs.typesafe.ai/legal.md). Check the current versions before you rely on them.

Don't send customer data. Check your employer's policy before using evidence-referee on work code.
