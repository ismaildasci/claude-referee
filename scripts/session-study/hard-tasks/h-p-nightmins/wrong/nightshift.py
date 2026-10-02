from datetime import date, datetime, time, timedelta
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
    local_start = start.astimezone(zone).replace(tzinfo=None)
    local_end = end.astimezone(zone).replace(tzinfo=None)
    total = timedelta()
    day = local_start.date() - timedelta(days=1)
    while day <= local_end.date():
        if day not in skipped:
            begin = datetime.combine(day, time(22, 0))
            finish = datetime.combine(day + timedelta(days=1), time(6, 0))
            lo = max(begin, local_start)
            hi = min(finish, local_end)
            if hi > lo:
                total += hi - lo
        day += timedelta(days=1)
    return int(total.total_seconds() // 60)
