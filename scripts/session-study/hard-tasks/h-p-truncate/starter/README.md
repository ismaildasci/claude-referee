# truncate

`truncate(text, width, ellipsis="…")` in `clip.py` shortens text to a number of terminal columns. Only the standard library is available (`unicodedata`).

- the text is first normalized to Unicode NFC, and the normalized text is what is returned and measured
- the column width of a character is 0 for combining marks and format characters (`unicodedata.combining(ch) > 0`, or a general category of `Mn`, `Me` or `Cf`), 2 when `unicodedata.east_asian_width(ch)` is `W` or `F`, and 1 for everything else; the width of a string is the sum
- a text whose width is at most `width` is returned as it is (normalized)
- otherwise the result is a prefix of the text followed by the ellipsis, and the whole result is at most `width` columns wide: the prefix is the longest one that fits next to the ellipsis, made of whole characters, where a character together with the zero-width characters that follow it is never split; trailing whitespace is removed from the prefix before the ellipsis is added
- the ellipsis is measured like any text; when shortening is needed but the ellipsis alone is wider than `width`, a ValueError is raised; a negative `width` always raises a ValueError
