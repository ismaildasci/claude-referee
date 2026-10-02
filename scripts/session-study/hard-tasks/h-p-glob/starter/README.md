# glob_match

`glob_match(pattern, path)` in `globs.py` tells whether a relative path matches a glob pattern. Both are `/` separated; they are split into segments and matched segment by segment. It returns a bool and never looks at the file system.

Inside a segment:

- `*` matches any run of characters (including none), `?` matches exactly one character
- `[abc]` matches one of the listed characters, `[a-z]` a range (both ends included), `[!abc]` and `[!a-z]` any character that is not listed; a class has at least one item, a range whose start is above its end is an error
- a backslash makes the next character literal (`\*`, `\?`, `\[`, `\\`)
- matching is case sensitive

A whole segment that is exactly `**` matches zero or more whole path segments (`a/**/b` matches `a/b` and `a/x/y/b`, `**/x` matches `x`, and `a/**` matches `a` itself and everything below it). A `**` inside a longer segment (`a**b`) is the same as one `*`.

Hidden files: a path segment that starts with `.` is matched by a pattern segment only when that pattern segment itself starts with a literal `.` (a plain `.` or `\.`). So `*` does not match `.env` but `.*` does, and `**` never covers a segment that starts with `.` (`**/x` does not match `.git/x`, while `**/.git/x` matches `.git/x`).

An unclosed `[`, an empty class `[]`, a reversed range and a pattern that ends in a lone backslash raise a ValueError, also when the path would not have got that far.
