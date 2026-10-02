#!/usr/bin/env bash
# Logic of the claude-referee GitHub Action: done on a log, claims on added doc lines, receipts export. Inputs come in as IN_* env.
# Without TYPESAFE_API_KEY it sends nothing and exits 0. REFEREE_CLI overrides the bundled CLI (tests only). The key is never printed.
set -uo pipefail

: "${OUT_DIR:?OUT_DIR is required}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cli_cmd="${REFEREE_CLI:-node $here/../plugins/claude-referee/dist/cli.mjs}"
read -r -a CLI <<< "$cli_cmd"

mkdir -p "$OUT_DIR"
out() { if [[ -n "${GITHUB_OUTPUT:-}" ]]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; fi; return 0; }
summary() { if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"; fi; return 0; }

if [[ -z "${TYPESAFE_API_KEY:-}" ]]; then
  echo "::notice title=claude-referee skipped::No TypeSafe API key is available (fork pull requests and Dependabot get no secrets). Nothing was sent."
  summary "claude-referee skipped: no TypeSafe API key, nothing was sent."
  out skipped true
  exit 0
fi
out skipped false
unset EVAL_TYPESAFE_API_KEY TYPESAFE_API_KEY_CMD REFEREE_BASE_URL_KEY TYPESAFE_BASE_URL CLAUDE_PLUGIN_DATA

data_dir="$(mktemp -d)"
work="$(mktemp -d)"
trap 'rm -rf "$data_dir" "$work"' EXIT
export REFEREE_DATA_DIR="$data_dir"
results="$OUT_DIR/results.jsonl"
: > "$results"
failed=0

verdict_of() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s.trim().split("\n").pop()).verdict;process.stdout.write(typeof v==="string"?v:"")}catch{}})' <<< "$1"
}

settle() {
  local name="$1" code="$2" line="$3" verdict
  if [[ -n "$line" ]]; then printf '%s\n' "$line" >> "$results"; fi
  verdict="$(verdict_of "$line")"
  out "$name-verdict" "$verdict"
  case "$code" in
    0) echo "claude-referee $name: ${verdict:-no verdict}" ;;
    3)
      echo "::error title=claude-referee $name::verdict ${verdict:-unknown} is in the fail list"
      failed=3
      ;;
    *)
      if [[ "${IN_ON_ERROR:-warn}" == "fail" ]]; then
        echo "::error title=claude-referee $name::CLI error (exit $code)"
        if [[ $failed -eq 0 ]]; then failed=1; fi
      else
        echo "::warning title=claude-referee $name::CLI error (exit $code), not failing"
      fi
      ;;
  esac
  summary "claude-referee $name: ${verdict:-error (exit $code)}"
}

if [[ -n "${IN_LOG:-}" && -s "${IN_LOG}" ]]; then
  args=()
  while IFS= read -r c; do
    if [[ -n "${c// /}" ]]; then args+=(--criteria "$c"); fi
  done <<< "${IN_CRITERIA:-all tests pass}"
  if [[ ${#args[@]} -eq 0 ]]; then args=(--criteria "all tests pass"); fi
  line="$("${CLI[@]}" done "${args[@]}" --evidence "$IN_LOG" --fail-on "${IN_FAIL_ON:-missing}" 2> "$work/done.err")"
  code=$?
  settle done "$code" "$line"
else
  echo "::notice title=claude-referee done skipped::No log file (log-file is empty or missing)."
fi

if [[ -n "${IN_BASE_SHA:-}" ]] && git rev-parse --git-dir > /dev/null 2>&1; then
  git cat-file -e "$IN_BASE_SHA^{commit}" 2> /dev/null || git fetch --quiet --depth=1 origin "$IN_BASE_SHA" 2> /dev/null || true
  specs=()
  while IFS= read -r s; do
    if [[ -n "${s// /}" ]]; then specs+=("$s"); fi
  done <<< "${IN_DOCS:-*.md}"
  if [[ ${#specs[@]} -eq 0 ]]; then specs=("*.md"); fi
  git diff --unified=0 --diff-filter=AM "$IN_BASE_SHA" HEAD -- "${specs[@]}" 2> /dev/null \
    | awk '/^\+\+\+/ {next} /^\+/ {print substr($0,2)}' \
    | sed -E 's/^[[:space:]]*([-*+]|[0-9]+[.)])[[:space:]]+//; s/[[:space:]]+$//' \
    | awk 'length($0) >= 20 && $0 !~ /^(#|```|\||>|<)/ && $0 !~ /^[-=*_ ]+$/' | head -n 100 > "$work/claims.txt"
  in_source="${IN_SOURCE:-}"
  if [[ -n "${in_source// /}" ]]; then
    while IFS= read -r f; do
      if [[ -n "${f// /}" ]]; then printf '%s\n' "$f"; fi
    done <<< "$in_source" > "$work/source.list"
  else
    git diff --name-only --diff-filter=AM "$IN_BASE_SHA" HEAD -- . ':(exclude)*.md' ':(exclude)*lock*' ':(exclude)*.min.js' > "$work/source.list" 2> /dev/null
  fi
  : > "$work/source.txt"
  while IFS= read -r f; do
    if [[ -f "$f" ]] && grep -Iq . "$f" 2> /dev/null; then
      { printf '=== %s ===\n' "$f"; cat "$f"; printf '\n'; } >> "$work/source.txt"
    fi
  done < "$work/source.list"
  head -c 60000 "$work/source.txt" > "$work/source.cut"
  if [[ -s "$work/claims.txt" && -s "$work/source.cut" ]]; then
    line="$("${CLI[@]}" claims --claims "$work/claims.txt" --source "$work/source.cut" --fail-on "${IN_CLAIMS_FAIL_ON:-unsupported}" 2> "$work/claims.err")"
    code=$?
    settle claims "$code" "$line"
  else
    echo "::notice title=claude-referee claims skipped::No added doc lines, or no changed source files to check them against."
  fi
else
  echo "::notice title=claude-referee claims skipped::No base commit (not a pull request) or not a git checkout."
fi

"${CLI[@]}" receipts export --out "$OUT_DIR/receipts.jsonl" > /dev/null 2>&1 || echo "::warning title=claude-referee::Receipts export failed."
exit "$failed"
