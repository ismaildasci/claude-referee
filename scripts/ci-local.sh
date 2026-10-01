#!/usr/bin/env bash
# Runs the steps of .github/workflows/ci.yml locally, as close to CI as one machine allows: no API key, a foreign HOME, a clean bundle check.
# Run it after committing and before pushing. Not covered: Node 20.3, 22 and 24 (this machine's Node is used) and macOS vs Linux.
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$1"; }

fakehome="$(mktemp -d)"
clean_env() { env -u TYPESAFE_API_KEY -u EVAL_TYPESAFE_API_KEY -u TYPESAFE_API_KEY_CMD -u REFEREE_DATA_DIR HOME="$fakehome" "$@"; }

step "typecheck"; npm run typecheck --silent
step "tests without a key, under a foreign HOME"; clean_env npm test --silent 2>&1 | grep -E "^ℹ (tests|pass|fail)"; test "${PIPESTATUS[0]}" -eq 0
step "build, then the committed bundle and npm copy must match"; npm run build --silent >/dev/null
git diff --exit-code HEAD -- plugins/claude-referee/dist npm >/dev/null || { echo "bundle or npm copy differs from HEAD: commit the rebuilt files"; exit 1; }

step "bundle runs without node_modules"
tmp="$(mktemp -d)"; cp -R plugins/claude-referee "$tmp/"; cli="$tmp/claude-referee/dist/cli.mjs"
for c in done decide judge claims verify receipts doctor eval; do
  clean_env node "$cli" "$c" --describe | node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))' || { echo "describe failed: $c"; exit 1; }
done
echo 'not json' | clean_env node "$tmp/claude-referee/dist/hook.mjs" session-start
echo '{}' | clean_env node "$tmp/claude-referee/dist/hook.mjs" stop
test "$(wc -c < "$tmp/claude-referee/dist/cli.mjs")" -lt 280000
test "$(wc -c < "$tmp/claude-referee/dist/hook.mjs")" -lt 200000

step "recorded evals score offline with CI's HOME"
env -u TYPESAFE_API_KEY -u EVAL_TYPESAFE_API_KEY -u TYPESAFE_API_KEY_CMD HOME=/home/runner node plugins/claude-referee/dist/cli.mjs eval score --suite all --fail-on violated | cut -c1-200

step "plugin validation"
claude plugin validate --strict . | tail -1
claude plugin validate --strict plugins/claude-referee | tail -1

step "private terms"; bash scripts/check-no-private.sh
step "secrets in git history (gitleaks, when installed)"
if command -v gitleaks >/dev/null; then gitleaks git --redact --no-banner . 2>&1 | tail -1; test "${PIPESTATUS[0]}" -eq 0; else echo "gitleaks not installed here; CI runs it"; fi
printf '\nci-local: all steps passed\n'
