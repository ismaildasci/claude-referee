# Recipe: claude-referee in GitHub Actions

A composite action that runs `done` on the test log of a pull request and `claims` on the doc lines it adds, then uploads the receipts as an artifact. It is for pull requests where an agent says "tests pass" and the log is the evidence.

The action installs nothing. It runs the committed bundle `plugins/claude-referee/dist/cli.mjs` from the action's own checkout, so it needs Node 20.3 or later (hosted runners have it) and no npm package. Pin it to a commit SHA, not a branch.

## Wire it

```yaml
# example-workflow
name: referee
on:
  pull_request:
permissions:
  contents: read
jobs:
  referee:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Run the tests and keep the log
        run: |
          set +e
          { npm test; echo "exit code: $?"; } > test.log 2>&1
          cat test.log
          exit 0
      - uses: ismaildasci/claude-referee@<commit-sha>
        with:
          typesafe-api-key: ${{ secrets.TYPESAFE_API_KEY }}
          log-file: test.log
          criteria: |
            all tests pass
          fail-on: missing
```

Keep your real test step failing the job as before; the log step above only captures output so the exit code line lands in the file. `done` needs that line (or a recognised runner summary) to ever say `met`.

## How it is tested

`test/action.test.ts` runs `action/run.sh` against a stub CLI: the skip path without a key, the key reaching the CLI only as `TYPESAFE_API_KEY` and never printed, `--fail-on` exit codes, the claims source rules and the outputs. This repository's self-test workflow runs the action on a GitHub-hosted runner without a key, so only the skip path has run there. A real request from a hosted runner (the path with a key) has not been run: this repository keeps no TypeSafe key. Your first run with your own key is that test; check that `done-verdict` and the receipts artifact appear.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `typesafe-api-key` | empty | The TypeSafe key, from a secret. Empty means skip |
| `log-file` | empty | The test or lint output. Missing or empty skips `done` |
| `criteria` | `all tests pass` | One criterion per line, at most 10 |
| `fail-on` | `missing` | `done` verdicts that fail the step. Add `unsure` once your logs are recognised |
| `docs` | `*.md` | Pathspecs of markdown files whose added lines become claims |
| `claims-source` | changed files | Files the claims must be supported by. Default: text files the PR changed, except markdown and lockfiles, first 60,000 characters |
| `claims-fail-on` | `unsupported` | `claims` verdicts that fail the step |
| `base-sha` | PR base | Commit to diff against |
| `on-error` | `warn` | A CLI error such as a Jev outage warns; `fail` fails the step |
| `artifact-name` | `claude-referee-receipts` | Name of the uploaded artifact |

Outputs: `skipped`, `done-verdict`, `claims-verdict`. Exit code 3 means a verdict was in the fail list.

## What `claims` checks

The claims are the lines the PR adds to markdown files: one per line, list markers removed, headings, tables, quotes, code fences and lines under 20 characters dropped, at most 100. The source is the text files the same PR changed, except markdown, lockfiles (`*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `go.sum` and similar), minified files and files that look sensitive (`.env*`, `.npmrc`, `*.pem`, `*.key`, `*.p12`, `*.tfstate`, `id_rsa*`, names containing `secret` or `credential`). The filter is by file name only; a secret inside an ordinary file is still sent, so keep secrets out of the PR or set `claims-source` yourself. A `claims-source` list is used exactly as given. A sentence in a doc that the changed code doesn't support comes back `unsupported` or `unsure`. A PR that changes docs only has no source and `claims` is skipped with a notice; set `claims-source` to the files that should back the docs.

## Fork pull requests

Secrets are not passed to workflows triggered by a pull request from a fork, nor to Dependabot. There the input is empty and the action prints a notice, exits 0, writes `skipped=true` and sends nothing, so a fork PR still gets a green check. The tests cover this path (`test/action.test.ts`: no key, key unset, and ignoring `EVAL_TYPESAFE_API_KEY` or `TYPESAFE_API_KEY_CMD` that are present in the environment).

Do not switch to `pull_request_target` to get the secret into fork runs: that runs with write access in the context of the base repository while checking out untrusted code. The action never needs it, and its inputs reach the shell only through environment variables, never through `${{ }}` inside script text. This repository does not run the action on its own pull requests for the same reason: a workflow here would skip on every fork PR, and would send each internal PR's docs and code to TypeSafe. Use the example above in your repository.

## Cost

`done` is one Jev request per run (all criteria together), `claims` is one request when the claims fit, at $0.042 per million input tokens and free output. A typical PR is a fraction of a cent. Identical requests inside one run come from the cache, but the cache is not kept between runs. Modelled from list prices, not measured in CI yet; see [economics](../economics.md).

## What is sent to TypeSafe

Exactly what [privacy](../privacy.md) lists for these commands, and nothing when the key is absent:

- `done`: your criteria and the log. A recognised runner's output is parsed in code and only counts, exit code and failing test names are sent; other output is sent as text, its first 2,000 and last 12,000 characters.
- `claims`: the added doc lines and the text of the changed source files (up to 60,000 characters), after the file-name filter above. Files the filter does not catch are sent in full.

Requests that contain something shaped like a secret are not sent (the step warns with `credential_in_state`), and emails, IP addresses and your home directory are replaced. Do not run this on code you may not send to a US-hosted service.

## Receipts

The artifact holds `results.jsonl` (one line per command: verdict, probabilities, no input text) and `receipts.jsonl` (the local receipts of this run: request counts, tokens, estimated cost, no request text). The key is never written to either. The runner's data directory and answer cache are discarded with the job.
