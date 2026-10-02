# count_between

`count_between(values, lo, hi, include_lo=True, include_hi=False)` in `ranges.py` counts how many entries of a sorted list lie between two bounds, in O(log n) (use `bisect`, no loop over the list).

- `values` is a list of ints and floats sorted in ascending order and may hold duplicates, which are all counted
- by default the range is half-open: `lo <= x < hi`; `include_lo` and `include_hi` choose whether each end is part of the range
- `lo` or `hi` may be `None`, which means that side is unbounded (and its include flag does not matter)
- when `lo > hi` the result is 0; when `lo == hi` it is the number of entries equal to that value if both flags are true, else 0
- the list is not modified
