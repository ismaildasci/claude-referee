# allocate

`allocate(total, weights)` in `src/allocate.mjs` (named export) splits a whole amount of money, in cents, between parties in proportion to their weights.

- `total` is a non-negative integer number of cents; `weights` is an array of non-negative integers
- the result is an array of integers with one entry per weight, and its entries always add up to exactly `total`
- the ideal share of party `i` is `total * weights[i] / sum(weights)`; every party gets at least the whole part of its ideal share
- the cents that are left over after that are handed out one by one to the parties with the largest fractional remainder; when remainders are equal the party with the lower index goes first
- a party with weight 0 gets 0
- an empty `weights`, a sum of weights of 0, a negative or non-integer value anywhere throws a RangeError
- the input array is not modified
