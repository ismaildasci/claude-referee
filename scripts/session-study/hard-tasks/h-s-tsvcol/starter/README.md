# tsvcol.sh

`bash tsvcol.sh COLUMN` reads a tab separated table from standard input and writes the values of one column to standard output, one per line. It runs on macOS and Linux and uses only POSIX tools.

- the first line is the header; `COLUMN` is matched against the header names exactly (case sensitive; the name may contain spaces and backslashes); when several columns have that name, the first one is used
- one output line per data row, in order, with the value of that column exactly as it is in the file: empty values give empty lines, leading and trailing spaces are kept, backslashes are not interpreted
- a row with fewer fields than the header has an empty value for the missing ones; extra fields are ignored
- a line may end in `\r\n`; the `\r` is not part of the last value. The last line is handled even when it has no trailing newline
- lines that are completely empty are not rows and are skipped (a line with only spaces is a row)
- when the header has no such column, or there is no input at all, nothing is written to standard output, `no such column: ` followed by `COLUMN` is written to standard error and the exit status is 3
- anything but exactly one argument prints a line starting with `usage:` to standard error and exits with status 2
- otherwise the exit status is 0 (also for a table that has only a header)
