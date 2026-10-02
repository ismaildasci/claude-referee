# nextOccurrence

`nextOccurrence(time, timeZone, from)` in `src/occurrence.mjs` (named export) returns the next instant at which the wall clock of an IANA time zone shows a given time of day, as an ISO 8601 UTC string (`Date.prototype.toISOString` format).

- `time` is `"HH:MM"` on a 24-hour clock; `timeZone` is an IANA name such as `America/New_York`; `from` is an ISO string or a `Date`
- the result is strictly after `from`: if `from` is exactly such an instant, the answer is the next one
- every local calendar day has one occurrence of `time`, with these two exceptions:
  - when the clock jumps forward and `time` does not exist on that day (a spring-forward gap), the occurrence for that day is the wall time read with the UTC offset that was in force just before the jump (`02:30` on a day when the clocks go from 02:00 to 03:00 is `03:30` local time)
  - when the clock goes back and `time` occurs twice, only the earlier of the two instants is an occurrence
- the zone may use any offset, including half-hour shifts and positive offsets
- a malformed `time`, an unknown `timeZone` or an invalid `from` throws a RangeError
