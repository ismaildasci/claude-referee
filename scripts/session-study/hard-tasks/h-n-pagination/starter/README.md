# pageList

`pageList(totalItems, perPage, current, siblings = 1)` in `src/pages.mjs` (named export) returns the entries of a pagination bar: page numbers in ascending order, with the string `"…"` (U+2026) standing for skipped pages.

- `totalItems` is an integer of at least 0 and `perPage` an integer of at least 1; the number of pages is `ceil(totalItems / perPage)`, but never below 1
- `current` is clamped into the range of pages (an integer is required, anything else throws a RangeError); `siblings` is the number of pages shown on each side of the current page, an integer of at least 0, otherwise a RangeError
- the bar always shows the first page, the last page, the current page and its siblings; no page appears twice
- between two shown pages that are not next to each other, the skipped pages are replaced by `"…"` only when two or more pages are skipped; when exactly one page would be skipped, that page is shown as a number instead
