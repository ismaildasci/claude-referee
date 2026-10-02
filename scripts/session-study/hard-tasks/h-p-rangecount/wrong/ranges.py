from bisect import bisect_left, bisect_right


def count_between(values, lo, hi, include_lo=True, include_hi=False):
    start = 0 if lo is None else bisect_left(values, lo)
    stop = len(values) if hi is None else bisect_left(values, hi)
    if include_hi and hi is not None and stop < len(values) and values[stop] == hi:
        stop += 1
    if not include_lo and lo is not None and start < len(values) and values[start] == lo:
        start += 1
    return max(0, stop - start)
