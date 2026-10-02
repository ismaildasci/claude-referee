# night_minutes

`night_minutes(start, end, tz, skip=())` in `nightshift.py` counts how long a time window overlaps with night shifts.

- `start` and `end` are timezone-aware `datetime` objects with zero seconds and microseconds (in any time zone); `tz` is an IANA zone name such as `"Europe/Berlin"`; the window is the half-open interval from `start` to `end` and it is a `ValueError` when `end` is before `start` or when a datetime is naive or has seconds
- a night shift starts every evening at 22:00 local time in `tz` and ends at 06:00 local time the next morning; the shift belongs to the date on which it starts
- `skip` is a collection of `datetime.date` objects: no shift is worked on the nights that start on those dates
- the result is the number of minutes of real, elapsed time of the window that lie inside shifts, as an `int`. A shift is as long as the clocks make it: on the night the clocks go forward it is 7 hours, when they go back it is 9 hours
