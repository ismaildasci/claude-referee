#!/usr/bin/env bash
# Prints one column of a TSV table read from stdin, selected by header name.
if [ $# -ne 1 ]; then
  echo "usage: tsvcol.sh COLUMN < file.tsv" >&2
  exit 2
fi
COL=$1 awk -F'\t' '
BEGIN { col = ENVIRON["COL"]; idx = 0; failed = 0 }
{ sub(/\r$/, "") }
NR == 1 {
  for (i = 1; i <= NF; i++) if ($i == col) { idx = i; break }
  if (!idx) { failed = 1; exit 3 }
  next
}
$0 == "" { next }
{ print (idx <= NF ? $idx : "") }
END {
  if (failed || NR == 0) { print "no such column: " col > "/dev/stderr"; exit 3 }
}
'
