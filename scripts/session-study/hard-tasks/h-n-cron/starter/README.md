# nextRun

`nextRun(expression, from)` in `src/cron.mjs` (named export) returns the next time a cron expression fires, as an ISO 8601 UTC string (`Date.prototype.toISOString` format), or `null`. `from` is an ISO string or a `Date`. All times are UTC.

An expression has 5 fields separated by spaces: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-7, both 0 and 7 are Sunday).

- a field is a comma separated list of items; an item is `*`, a number, a range `a-b` (both ends included), or `*/s` or `a-b/s` (every `s`-th value of the range, starting at its first value)
- the result is strictly after `from`: a `from` that is exactly on a firing time gives the next one; seconds and milliseconds of `from` are ignored (10:07:30 counts as 10:07)
- the result always has seconds and milliseconds at zero
- a day matches when the month matches and the day fields allow it. When day of month and day of week are both restricted (neither field is exactly `*`) a day matches when either of them matches; when one of them is exactly `*` only the other one is applied
- when no firing time exists within the next 5 years the result is `null`
- anything malformed (wrong number of fields, a value out of range, a range whose start is above its end, a step of 0, an unknown character) throws a SyntaxError
