# wrapText

`wrapText(text, width)` in `src/wrap.mjs` (named export) wraps text into lines for a fixed-width terminal and returns an array of strings.

Display width of a character:

- code points U+0300 to U+036F (combining marks) take 0 columns
- code points in U+1100-U+115F, U+2E80-U+A4CF, U+AC00-U+D7A3, U+F900-U+FAFF, U+FE30-U+FE6F, U+FF00-U+FF60 and U+FFE0-U+FFE6 take 2 columns
- every other code point takes 1 column

Rules:

- words are separated by spaces; runs of spaces count as one separator and no line starts or ends with a space
- a line is filled greedily: a word goes on the current line when the line plus one space plus the word fits in `width` columns
- a newline in the text ends the paragraph; each paragraph is wrapped on its own and an empty paragraph gives an empty string line
- a word wider than `width` is split into pieces that each fit; it is never split between a base character and the combining marks that follow it
- `width` must be an integer of at least 2, otherwise a RangeError is thrown
