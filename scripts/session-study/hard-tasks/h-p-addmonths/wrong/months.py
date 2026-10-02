import calendar
from datetime import date


def add_months(d, n):
    index = d.year * 12 + (d.month - 1) + n
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def recurring(start, step, count):
    if not isinstance(step, int) or step < 1 or not isinstance(count, int) or count < 0:
        raise ValueError("bad step or count")
    out = []
    current = start
    for i in range(count):
        out.append(current)
        current = add_months(current, step)
    return out


def months_between(a, b):
    months = (b.year - a.year) * 12 + (b.month - a.month)
    if months > 0 and b.day < a.day:
        months -= 1
    if months < 0 and b.day > a.day:
        months += 1
    return months
