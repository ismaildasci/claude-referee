#!/usr/bin/env bash
# Prints one column of a TSV table read from stdin, selected by header name.
if [ $# -ne 1 ]; then
  echo "usage: tsvcol.sh COLUMN < file.tsv" >&2
  exit 2
fi
IFS=$'\t' read -r -a header
idx=-1
for i in "${!header[@]}"; do
  if [ "${header[$i]}" = "$1" ]; then
    idx=$i
    break
  fi
done
if [ "$idx" -lt 0 ]; then
  echo "no such column: $1" >&2
  exit 3
fi
while IFS=$'\t' read -r -a row; do
  [ ${#row[@]} -eq 0 ] && continue
  echo "${row[$idx]}"
done
