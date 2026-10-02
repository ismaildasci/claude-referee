from bisect import bisect_left, bisect_right


def count_between(values, lo, hi, include_lo=True, include_hi=False):
    if lo is not None and hi is not None:
        if lo > hi:
            return 0
        if lo == hi and not (include_lo and include_hi):
            return 0
    start = 0 if lo is None else (bisect_left(values, lo) if include_lo else bisect_right(values, lo))
    stop = len(values) if hi is None else (bisect_right(values, hi) if include_hi else bisect_left(values, hi))
    return max(0, stop - start)
