# evidence-referee demo for VHS (https://github.com/charmbracelet/vhs): vhs assets/demo.tape -> assets/demo.gif
# Prerequisites and the decision.json it expects are in assets/README.md. Never put the key in this file.

Output assets/demo.gif

Require npx
Require cargo

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 640
Set Padding 24
Set TypingSpeed 45ms
Set Theme { "name": "referee-dark", "background": "#0d1117", "foreground": "#e6edf3", "selection": "#264f78", "cursor": "#9085e9", "black": "#484f58", "red": "#ff7b72", "green": "#3fb950", "yellow": "#d29922", "blue": "#58a6ff", "magenta": "#9085e9", "cyan": "#39c5cf", "white": "#b1bac4", "brightBlack": "#6e7681", "brightRed": "#ffa198", "brightGreen": "#56d364", "brightYellow": "#e3b341", "brightBlue": "#79c0ff", "brightMagenta": "#b4abf5", "brightCyan": "#56d4dd", "brightWhite": "#ffffff" }

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type "npx evidence-referee doctor"
Sleep 500ms
Enter
Sleep 3s

Type `cargo nextest run 2>&1 | npx evidence-referee done --criteria "all tests pass" --evidence -`
Sleep 500ms
Enter
Sleep 5s

Type "npx evidence-referee decide < decision.json"
Sleep 500ms
Enter
Sleep 4s

Type "npx evidence-referee receipts --tokens --days 7"
Sleep 500ms
Enter
Sleep 4s
