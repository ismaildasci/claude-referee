#!/usr/bin/env bash
# Sorts semantic versions from stdin with sort -V; lines that are not versions go to stderr.
status=0
valid=$(mktemp)
while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  if printf '%s\n' "$line" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'; then
    printf '%s\n' "$line" >> "$valid"
  else
    echo "invalid: $line" >&2
    status=1
  fi
done
sort -V "$valid"
rm -f "$valid"
exit $status
