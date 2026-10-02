from movavg import moving_average

assert moving_average([1, 2, 3, 4], 2) == [1.0, 1.5, 2.5, 3.5]
assert moving_average([1, None, 3, 4], 2) == [1.0, 1.0, 3.0, 3.5]
assert moving_average([None, None, 3], 2) == [None, None, 3.0]
assert moving_average([1, None, None, 4], 2) == [1.0, 1.0, None, 4.0]
assert moving_average([1, None, None, None, 5], 3) == [1.0, 1.0, 1.0, None, 5.0]
assert moving_average([None], 1) == [None]
assert moving_average([1, 2, None, 4, 5, None], 3) == [1.0, 1.5, 1.5, 3.0, 4.5, 4.5]
assert moving_average([2, 4, 6], 5) == [2.0, 3.0, 4.0]
assert moving_average([7], 1) == [7.0]
assert moving_average([], 2) == []
out = moving_average([4], 3)
assert out == [4.0] and isinstance(out[0], float)
out = moving_average([1, 2], 2)
assert out == [1.0, 1.5] and all(isinstance(x, float) for x in out)
assert moving_average([0, 0, 0], 2) == [0.0, 0.0, 0.0]
assert moving_average([1.5, None, 2.5], 3) == [1.5, 1.5, 2.0]
original = [1, None, 3]
moving_average(original, 2)
assert original == [1, None, 3]
for bad in [0, -1, 1.5, "2", None, True]:
    try:
        moving_average([1], bad)
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
