# import pipeline

Four modules that turn a CSV text of orders into a short report. The first line of the text is the header and must be exactly `name,qty,price,date`.

## parse.py

`parse_lines(text)` returns a list of `{"line": N, "fields": [...]}`, one per data line, in order.

- lines end at `\n` or `\r\n`, and only there (a name may contain other separator characters such as U+2028 and still be one line)
- `N` is the 1-based line number in the original text, the header being line 1; blank lines (only whitespace) and comment lines (the first non-blank character is `#`) are skipped, but they are counted
- fields follow the usual CSV rules (`csv` module): a field can be wrapped in double quotes and then holds commas, and `""` inside quotes is one quote. Every field is stripped of surrounding whitespace
- a header that is not exactly `name,qty,price,date` (after removing a trailing `\r`), including an empty text, raises a ValueError

## validate.py

`validate(rows)` takes that list and returns `(valid, errors)`.

- the first rule a row breaks gives its one error, in this order: not 4 fields (`expected 4 fields, got K`); empty name (`name is empty`); `qty` not an integer of at least 1 written in digits (`qty must be a positive integer`); `price` not digits with an optional point and at most 2 decimals (`price must be a non-negative amount with at most 2 decimals`); `date` not a real calendar date written `YYYY-MM-DD` (`date is not a valid ISO date`); a row with the same name (compared case-insensitively) and date as an earlier valid row (`duplicate of line N`, N being the line of that earlier row)
- an error is `{"line": N, "error": message}`; a valid row is `{"line": N, "name": str, "qty": int, "price": Decimal, "date": datetime.date}`; both lists are in line order

## report.py

`summarize(valid, errors)` returns a list of strings:

- `rows: V valid, E invalid`
- `total: T` where T is the sum of `price * qty` over the valid rows with exactly two decimals (`0.00` when there are none)
- one `line N: message` per error, in line order
- `latest: D`, the latest date of the valid rows in ISO form, or `latest: -` when there are none

## pipeline.py

`run(text)` runs the three steps on a CSV text and returns the report lines.
