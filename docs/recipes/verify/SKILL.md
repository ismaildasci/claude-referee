---
name: verify
description: Check that the work is really done before committing. Runs the project's test command and pipes its output to claude-referee done, so the verdict comes from the evidence and not from a summary.
allowed-tools: Bash
---

# verify

Run this right before committing code changes.

1. Run the project's check command and pipe all of its output, including stderr and the exit code, to the referee. Replace `npm test` with the project's own command (for example `cargo nextest run`, `pytest`, `go test ./...`). The exit code line keeps the real status (a failing run is `missing`); for a runner the referee does not recognise, a passing run comes back `unsure` or `missing`, not `met`:

```bash
{ npm test; echo "exit code: $?"; } 2>&1 | npx claude-referee done --criteria "all tests pass" --evidence - --fail-on missing,unsure
```

   Until the package is on npm (early October 2026), `npx claude-referee` fails with a 404. If it does, use `claude-referee` instead of `npx claude-referee` when the user has the alias from the README install note.

2. Read only the one-line JSON it prints.
   - `met`: commit.
   - `missing` or `unsure`: do not commit. Follow `next_step`, fix the cause, and run step 1 again.
   - No JSON line (an npx 404, a missing key, a crash): there is no verdict. Do not retry in a loop and do not claim success. Tell the user the check could not run and why.
3. Do not paraphrase the test output to claim success. The verdict line is the evidence.
