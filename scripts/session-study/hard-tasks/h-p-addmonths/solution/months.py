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
    return [add_months(start, i * step) for i in range(count)]


def months_between(a, b):
    if b < a:
        return -months_between(b, a)
    k = (b.year - a.year) * 12 + (b.month - a.month)
    while add_months(a, k) > b:
        k -= 1
    return k
