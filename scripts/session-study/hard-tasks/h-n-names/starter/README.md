# people

Small helpers that print people. A person is `{ first, last, middle?, suffix?, email }`. The code is in `src/`: `person.mjs` (`displayName`), `report.mjs` (`reportLines`), `mail.mjs` (`greeting`, `signature`), `export.mjs` (`csvRow`) and `badge.mjs` (`badgeText`).

## New name format

- the full name is `First M. Last`: when `middle` is a non-empty string, it is shown as its first character in upper case followed by a dot (`Ada B. Lovelace`); without a middle name it is `First Last`
- when `suffix` is a non-empty string it is appended after a comma and a space (`Ada B. Lovelace, Jr.`)
- everywhere the code prints a person's full name it must use this format: the numbered report, the mail signature (`-- <full name>`) and the CSV export
- in the CSV export the name is written as `Last, First M.` (the suffix after it, comma separated: `Lovelace, Ada B., Jr.`), and both fields of a row, the name and the email, are always wrapped in double quotes, with any double quote inside a value doubled
- these stay as they are: the greeting (`Dear <first>,`) and the badge text (`A. Lovelace`, the initial of the first name and the last name)
