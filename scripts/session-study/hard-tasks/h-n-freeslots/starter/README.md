# freeSlots

`freeSlots(day, busy, minMinutes)` in `src/slots.mjs` (named export) lists the free gaps of a working day.

- `day` is `{ start: "HH:MM", end: "HH:MM" }` (24-hour clock, `end` may be `"24:00"`); `busy` is an array of `{ start, end }` in the same format; `minMinutes` is an integer of at least 1
- a busy interval covers its start minute and not its end minute, so one meeting that ends at 10:00 and another that starts at 10:00 leave no gap between them
- busy intervals may come in any order, may overlap, may contain each other and may be repeated
- the parts of a busy interval that lie outside the day do not matter; an interval completely outside the day is ignored
- the result is an array of `{ start, end }` in the same format, in time order, one entry per maximal free gap that is at least `minMinutes` long (a gap of exactly `minMinutes` is kept)
- a busy interval whose end is not after its start, or a `minMinutes` that is not an integer of at least 1, throws a RangeError
- the inputs are not modified
