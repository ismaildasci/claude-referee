from ranges import count_between

v = [1, 2, 2, 2, 3, 5, 5, 8]
assert count_between(v, 2, 5) == 4
assert count_between(v, 2, 5, include_hi=True) == 6
assert count_between(v, 2, 5, include_lo=False) == 1
assert count_between(v, 2, 5, include_lo=False, include_hi=True) == 3
assert count_between(v, 5, 5) == 0
assert count_between(v, 5, 5, include_lo=True, include_hi=True) == 2
assert count_between(v, 5, 5, include_lo=True, include_hi=False) == 0
assert count_between(v, 5, 5, include_lo=False, include_hi=True) == 0
assert count_between(v, 4, 4, include_lo=True, include_hi=True) == 0
assert count_between(v, 6, 2) == 0
assert count_between(v, None, 3) == 4
assert count_between(v, None, 3, include_hi=True) == 5
assert count_between(v, 3, None) == 4
assert count_between(v, 3, None, include_lo=False) == 3
assert count_between(v, None, None) == 8
assert count_between(v, None, None, include_lo=False, include_hi=False) == 8
assert count_between(v, 0, 100) == 8
assert count_between(v, 9, 100) == 0
assert count_between(v, 2, 2, True, True) == 3
assert count_between(v, 1.5, 5.0, True, True) == 6
assert count_between([2, 2, 2], 2, 2, True, True) == 3
assert count_between([2, 2, 2], 2, 3) == 3
assert count_between([2, 2, 2], 2, 3, include_lo=False) == 0
assert count_between([2, 2, 2], 1, 2) == 0
assert count_between([2, 2, 2], 1, 2, include_hi=True) == 3
assert count_between([], None, None) == 0
big = list(range(0, 2000000, 2))
assert count_between(big, 10, 20, True, True) == 6
snapshot = list(v)
count_between(v, 1, 5)
assert v == snapshot
