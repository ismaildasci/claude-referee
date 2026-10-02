# vsort.sh

`vsort.sh` reads version strings from standard input, one per line, and writes them to standard output sorted from the lowest to the highest version. It runs with `bash vsort.sh` on macOS and Linux, uses only POSIX tools and has no arguments.

A valid line is a semantic version, `MAJOR.MINOR.PATCH`, optionally followed by `-PRERELEASE` and then `+BUILD`: the three numbers are digits without leading zeros (`0` itself is fine), the prerelease is dot separated identifiers of `[0-9A-Za-z-]` where an all-digit identifier has no leading zero, and the build is dot separated identifiers of `[0-9A-Za-z-]`. There is no leading `v` and no surrounding whitespace.

Order (semantic versioning 2.0):

- major, minor and patch compare as numbers
- a version with a prerelease is lower than the same version without one
- two prereleases compare identifier by identifier from the left: all-digit identifiers compare as numbers, other identifiers compare as ASCII strings, an all-digit identifier is lower than any other identifier, and when all shared identifiers are equal the version with fewer identifiers is lower
- build metadata does not take part: versions that differ only in it are equal and keep their input order (the sort is stable)

Output and exit status:

- every valid line is written exactly as it was read (build metadata included); duplicates are kept
- empty lines are ignored
- every other line is not written to standard output; it is reported on standard error as `invalid: ` followed by the line, in input order, and the exit status is then 1 (it is 0 when every non-empty line was valid, also for empty input)
- the last line is handled even when it has no trailing newline
