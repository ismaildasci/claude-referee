# moving_average

`moving_average(values, window)` in `movavg.py` returns the trailing moving average of a series as a list of floats of the same length.

- the entry at position `i` is the mean of the entries at positions `i - window + 1` through `i`; near the start there are fewer than `window` positions, and the mean is taken over those that exist
- an entry that is `None` is a missing value: it is skipped, and does not count in the divisor
- the window is made of positions, not of non-missing values: with `window=2` the entry right after a `None` is the mean of just itself
- when a window holds no value at all, the result at that position is `None`
- `window` must be an integer of at least 1, otherwise a ValueError is raised; `values` is not modified
- results are plain floats: the mean of `[1, 2]` is `1.5`, and of `[4]` it is `4.0`
