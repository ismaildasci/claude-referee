claude-referee is on (pack {{pack}}); it asks TypeSafe Jev small, checkable questions.
CLI: node "{{cli}}" <done|decide|judge|verify|doctor>; --describe prints a contract.
Done check, output unread: <check> 2>&1 | node "{{cli}}" done --criteria "<what must hold>" --evidence -
decide takes {"decision","options","context_files"} JSON on stdin (quoted heredoc).
Checks here: {{checks}}.
Weak or tie verdicts name a lean: add the missing fact, don't re-ask.
