---
name: jev
description: Hand small, checkable judgements to TypeSafe Jev through the evidence-referee CLI instead of judging them yourself. done checks test or lint output against criteria, decide scores 2-6 options against context files, judge runs one yes/no rule over many items, claims (old name verify) checks claims against a source. Use when a check's output decides "done", or when 20+ items need the same rule.
---

# evidence-referee

The CLI is `node "${CLAUDE_PLUGIN_ROOT}/dist/cli.mjs" <command>`. Every command prints one JSON line: `ok`, `verdict`, a few numbers, a `next_step` when there is one, and a `receipt`. `--describe` prints a command's contract. `--dry-run` shows the redacted request without sending it.

## When Jev pays off

- A check ran and its output decides whether the task is done. Pipe the output to `done` without reading it first.
- A choice between 2-6 options whose facts live in files. `decide` reads the files itself.
- One yes/no rule over many items. In the cost model this pays off from about 20 items that aren't in context yet, or about 50 that are (modelled, not measured).
- A single small judgement about text already in context doesn't pay off. Decide it yourself.

## Calls

```bash
npm test 2>&1 | node "${CLAUDE_PLUGIN_ROOT}/dist/cli.mjs" done --criteria "all tests pass" --evidence -
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/cli.mjs" decide <<'EOF_JSON'
{"decision": "Where should rate-limit counters live?",
 "options": [{"name": "redis", "text": "Redis, already deployed"}, {"name": "memory", "text": "In-process LRU on each instance"}],
 "context_files": ["docs/adr/0007-scaling.md"]}
EOF_JSON
```

```bash
git diff -U0 --no-ext-diff | grep '^+[^+]' | node "${CLAUDE_PLUGIN_ROOT}/dist/cli.mjs" judge --question line.risky --items -
```

## Rules

- A weak or tie verdict is settled by adding the missing fact, or by going with `lean` when the choice is easy to undo. Asking the same question again moves the answer by about 0.01.
- Make evidence explicit. A command that prints nothing on success shows nothing; add its exit code to the output. `done` only returns `met` for output from a recognised runner or with an exit code line (`trust` in the result); anything else comes back `unsure`.
- Pass paths through `context_files` instead of retyping file contents.
- Input shaped like a credential stops the request. Remove it; don't work around it.
- The referee can be overruled. It answers narrow questions and stays silent below its thresholds.

TypeSafe facts, limits and data handling are in [references/core.md](references/core.md).
