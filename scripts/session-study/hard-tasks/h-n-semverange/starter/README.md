# satisfies

`satisfies(version, range)` in `src/range.mjs` (named export) tells whether a semantic version matches a version range, in the style of npm.

Versions are `MAJOR.MINOR.PATCH`, optionally followed by `-PRERELEASE` (dot separated identifiers) and `+BUILD`. Build metadata is ignored everywhere. A malformed version or range throws a TypeError.

Precedence of versions (semver 2.0): compare major, minor, patch as numbers; a version with a prerelease is lower than the same version without one; two prereleases compare identifier by identifier, numeric identifiers as numbers, other identifiers as ASCII strings, a numeric identifier is lower than a non-numeric one, and when all shared identifiers are equal the one with fewer identifiers is lower.

Ranges:

- a range is one or more sets separated by `||`; it is satisfied when any set is satisfied
- a set is comparators separated by spaces; it is satisfied when all of them are
- a comparator is `*` (any version), a version (exactly that version), or one of `=`, `>`, `>=`, `<`, `<=` followed by a version, or `^` or `~` followed by a version
- `~1.2.3` means `>=1.2.3 <1.3.0`
- `^1.2.3` means `>=1.2.3 <2.0.0`; `^0.2.3` means `>=0.2.3 <0.3.0`; `^0.0.3` means `>=0.0.3 <0.0.4`
- a version that has a prerelease satisfies a set only when, besides satisfying all of its comparators, at least one comparator of that set has a prerelease on the same `MAJOR.MINOR.PATCH` (so `1.2.3-beta.2` satisfies `>=1.2.3-beta.1 <2.0.0` but `1.2.4-beta.1` does not, and no prerelease satisfies `*` or `^1.2.3`); the comparators that `^` and `~` expand to count for this with the prerelease of the version written after the operator
