#!/usr/bin/env bash
# Sorts semantic versions from stdin; invalid lines go to stderr and make the exit status 1.
tmp=$(mktemp) || exit 3
trap 'rm -f "$tmp"' EXIT
LC_ALL=C awk -v out="$tmp" '
function pad(s) { while (length(s) < 20) s = "0" s; return s }
function isnum(s) { return s ~ /^[0-9]+$/ }
BEGIN { bad = 0; term = sprintf("%c", 1) }
{
  line = $0
  if (line == "") next
  if (line !~ /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/) {
    print "invalid: " line > "/dev/stderr"
    bad = 1
    next
  }
  rest = line
  sub(/\+.*$/, "", rest)
  pre = ""
  dash = index(rest, "-")
  if (dash > 0) { pre = substr(rest, dash + 1); rest = substr(rest, 1, dash - 1) }
  split(rest, n, ".")
  key = pad(n[1]) "." pad(n[2]) "." pad(n[3]) " "
  if (pre == "") key = key "1"
  else {
    ok = 1
    count = split(pre, ids, ".")
    enc = "0"
    for (i = 1; i <= count; i++) {
      if (isnum(ids[i])) {
        if (ids[i] !~ /^(0|[1-9][0-9]*)$/) ok = 0
        enc = enc "0" pad(ids[i]) term
      } else enc = enc "1" ids[i] term
    }
    if (!ok) { print "invalid: " line > "/dev/stderr"; bad = 1; next }
    key = key enc
  }
  printf "%s\t%d\t%s\n", key, NR, line > out
}
END { exit bad }
' 
status=$?
LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k2,2n "$tmp" | cut -f3-
exit $status
