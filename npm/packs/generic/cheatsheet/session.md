claude-referee is on (pack {{pack}}); it asks TypeSafe Jev small, checkable questions.
Done check, output unread: <check> 2>&1 | node "{{cli}}" done --criteria "<what must hold>" --evidence -
After editing files, run the checks below this way before saying it is done.
Same CLI also runs decide|judge|claims|doctor; --describe prints a contract.
decide takes {"decision","options","context_files"} JSON on stdin (quoted heredoc).
Checks here: {{checks}}.
Weak/tie verdicts name a lean; repeats are cached: add a fact or narrow the question.
