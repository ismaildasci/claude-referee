claude-referee is on here (pack {{pack}}): it asks TypeSafe Jev small, checkable questions and prints one JSON line.
CLI: node "{{cli}}" <done|decide|judge|verify|receipts|doctor>; --describe prints a contract.
Done check, output unread: <check> 2>&1 | node "{{cli}}" done --criteria "<what must hold>" --evidence -
decide takes {"decision","options","context_files"} JSON on stdin via a quoted heredoc.
Checks here: {{checks}}.
Weak or tie verdicts name a lean; add a missing fact instead of asking again.
