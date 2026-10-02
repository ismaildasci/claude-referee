# months

Calendar month arithmetic on `datetime.date`, in `months.py`.

- `add_months(d, n)` returns the date `n` months after `d` (`n` may be negative or 0): same year-and-month arithmetic, and the same day of the month, except that when the target month is shorter the last day of that month is used (`add_months(date(2024, 1, 31), 1)` is `date(2024, 2, 29)`)
- `recurring(start, step, count)` returns a list of `count` dates: the date at position `i` (starting at 0) is `add_months(start, i * step)`, so a series that starts on the 31st comes back to the 31st whenever the month has one. `step` must be an integer of at least 1 and `count` an integer of at least 0, otherwise a ValueError is raised
- `months_between(a, b)` is the number of whole months from `a` to `b`: for `b >= a` it is the largest integer `k` with `add_months(a, k) <= b`; for `b < a` it is `-months_between(b, a)`
