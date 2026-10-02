# diff_lines

`diff_lines(a, b)` in `linediff.py` compares two lists of lines and returns an edit script: a list of `(op, line)` tuples, where `op` is `"="` (the line is in both), `"-"` (only in `a`) or `"+"` (only in `b`). Applying the script in order to `a` gives `b`. Do not use `difflib`.

Comparison of lines: two lines are equal when they are equal after removing trailing spaces and tabs from both. For an `"="` entry the line from `a` is reported.

The script is the one this procedure produces, so that the result is deterministic. Let `L(i, j)` be the length of the longest common subsequence (with the equality above) of `a[i:]` and `b[j:]`. Start at `i = 0, j = 0` and repeat until both lists are used up:

- if `a[i]` and `b[j]` are equal: emit `("=", a[i])` and move both on
- otherwise, if `a` is used up emit `("+", b[j])` and move `j`; if `b` is used up emit `("-", a[i])` and move `i`
- otherwise, if `L(i + 1, j) >= L(i, j + 1)` emit `("-", a[i])` and move `i`; else emit `("+", b[j])` and move `j`

Neither input is modified.
