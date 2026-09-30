#!/usr/bin/env bash
# Fails when a private term appears in tracked or untracked files; prints file:line only, never the match.
# Terms are Perl-compatible regexes, one per line, read from .private-terms (gitignored) or REFEREE_PRIVATE_TERMS.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

terms="${REFEREE_PRIVATE_TERMS:-}"
if [[ -z "$terms" && -f .private-terms ]]; then
  terms="$(cat .private-terms)"
fi

pattern="$(printf '%s\n' "$terms" | sed -e 's/[[:space:]]*$//' -e '/^#/d' -e '/^$/d' | paste -sd '|' -)"
if [[ -z "$pattern" ]]; then
  echo "check-no-private: no terms configured (.private-terms or REFEREE_PRIVATE_TERMS)" >&2
  exit 2
fi

hits="$(git grep --untracked -nIiP -e "$pattern" -- . ':!.private-terms' | cut -d: -f1,2 || true)"
if [[ -n "$hits" ]]; then
  echo "check-no-private: private terms found at:" >&2
  printf '%s\n' "$hits" >&2
  exit 1
fi

echo "check-no-private: clean"
