from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def _check(value):
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("naive datetime")
    if value.second or value.microsecond:
        raise ValueError("seconds are not allowed")


def night_minutes(start, end, tz, skip=()):
    _check(start)
    _check(end)
    if end < start:
        raise ValueError("end before start")
    zone = ZoneInfo(tz)
    skipped = set(skip)
    first = start.astimezone(zone).date() - timedelta(days=1)
    last = end.astimezone(zone).date()
    total = timedelta()
    day = first
    while day <= last:
        if day not in skipped:
            begin = datetime.combine(day, time(22, 0), tzinfo=zone).astimezone(timezone.utc)
            finish = datetime.combine(day + timedelta(days=1), time(6, 0), tzinfo=zone).astimezone(timezone.utc)
            lo = max(begin, start.astimezone(timezone.utc))
            hi = min(finish, end.astimezone(timezone.utc))
            if hi > lo:
                total += hi - lo
        day += timedelta(days=1)
    return int(total.total_seconds() // 60)
