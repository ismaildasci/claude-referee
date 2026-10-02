# rotate.sh

`bash rotate.sh DIR KEEP [--dry-run]` removes old log files from `DIR` and keeps the `KEEP` newest. It runs on macOS and Linux and uses only POSIX tools plus what both systems ship (`find`, `sort`, `stat`, ...).

- the candidates are the regular files directly inside `DIR` whose name ends in `.log`; directories, symbolic links, files in subdirectories and files whose name starts with `.` are never candidates and are never touched
- candidates are ordered by modification time, newest first; files with the same modification time (to the second) are ordered by name in byte order (`LC_ALL=C`), and the name that sorts later counts as newer
- the `KEEP` newest candidates stay; every other candidate is deleted. `KEEP` is a non-negative integer (`0` deletes every candidate); when there are not more than `KEEP` candidates nothing happens
- file names may contain spaces, glob characters (`*`, `?`, `[`) and may start with `-`; they never contain a newline
- for every deleted file one line `removed NAME` is written to standard output, with `NAME` the file name without the directory, oldest file first (ties in the order of the name, the earlier name first)
- with `--dry-run` nothing is deleted and the lines are `would remove NAME` instead
- a wrong number of arguments, a third argument other than `--dry-run`, a `DIR` that is not a directory, or a `KEEP` that is not a non-negative integer written in digits prints a line starting with `usage:` to standard error and exits with status 2, before anything is deleted; otherwise the exit status is 0
