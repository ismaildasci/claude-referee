#!/usr/bin/env bash
# Keeps the KEEP newest *.log files of a directory and deletes the rest, oldest first.
usage() {
  echo "usage: rotate.sh DIR KEEP [--dry-run]" >&2
  exit 2
}
[ $# -ge 2 ] && [ $# -le 3 ] || usage
dir=$1
keep=$2
dry=0
if [ $# -eq 3 ]; then
  [ "$3" = "--dry-run" ] || usage
  dry=1
fi
[ -d "$dir" ] || usage
case $keep in '' | *[!0-9]*) usage ;; esac
keep=$((10#$keep))
if stat -c %Y / > /dev/null 2>&1; then
  mtime() { stat -c %Y -- "$1"; }
else
  mtime() { stat -f %m "$1"; }
fi
tab=$(printf '\t')
list=$(
  find "$dir" -maxdepth 1 -type f -name '*.log' ! -name '.*' -print0 | while IFS= read -r -d '' f; do
    printf '%s\t%s\n' "$(mtime "$f")" "${f##*/}"
  done | LC_ALL=C sort -t "$tab" -k1,1n -k2,2
)
[ -n "$list" ] || exit 0
total=$(printf '%s\n' "$list" | wc -l | tr -d ' ')
drop=$((total - keep))
[ "$drop" -gt 0 ] || exit 0
printf '%s\n' "$list" | head -n "$drop" | while IFS="$tab" read -r _ name; do
  if [ "$dry" -eq 1 ]; then
    echo "would remove $name"
  else
    rm -f -- "${dir%/}/$name" && echo "removed $name"
  fi
done
exit 0
