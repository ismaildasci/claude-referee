#!/usr/bin/env bash
# Keeps the KEEP newest *.log files of a directory and deletes the rest.
dir=$1
keep=$2
cd "$dir" || exit 2
for f in $(ls -t *.log | tail -n +$((keep + 1))); do
  rm "$f"
  echo "removed $f"
done
