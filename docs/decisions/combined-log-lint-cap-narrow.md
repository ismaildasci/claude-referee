# A narrower lint cap for combined logs

Registered 2026-10-07, after the [first version](combined-log-lint-cap.md) was replayed and not shipped ([result](combined-log-lint-cap-result.md)): it lost 6 true `met` on real use and caught no linter warning, because it reused the exit-code-only word check, and clean test summaries ("ℹ fail 0", "0 failed", "Skipped: 0", deprecation notices) contain those words.

## Rule

Same scope as the first version: a criterion that matches the lint or clean pattern, `trust: parsed`, and no parsed runner covering the lint kind. The trigger is narrower: `met` is capped at `unsure` (`reason: "warning_in_log"`) only when the log has a line shaped like a linter diagnostic that reports a warning or an error:

- `path:line:col: warning ...` or `path:line:col: error ...` (the compiler-style shape many linters print);
- `path:line:col: CODE message` with a rule code such as `E501`, `F401` or `W291` (flake8 and pycodestyle style);
- an indented `line:col  warning|error  message` row under a file header (the eslint and stylelint stylish shape);
- a linter summary with a positive count (`✖ N problems`, `N warnings`, `N errors` with N above 0 in a summary line);
- the diagnostic heads of oxlint's agent format, which oxlint 1.87 prints by itself inside Claude Code sessions (to be taken from real captures).

Counts of zero never trigger (`0 warnings`, `fail 0`, `0 failed`, `Skipped: 0`), and neither do test runner summaries, deprecation notices from npm or Node, file names, or command echo lines. Exit-code-only evidence keeps its existing check unchanged.

## What will be reported, and the bar

Replayed on the same data as the first version, with the same scripts:

- the 6 real-use true `met` that the first version lost must all stay `met`;
- of the 60 recorded passing test logs from other runners that the first version capped 25 of under a lint criterion, at most 2 may be capped;
- the one combined test and lint call from real use whose linter printed a `file:line:col: warning` line must be capped (stubbed answer 0.98);
- recorded eval suites: no verdict, reason or fact changes.

If any of these fails, the rule is not shipped and the result is recorded. A fix fitted to cases already seen, not a clean test.
