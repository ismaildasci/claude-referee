# roundDecimal

`roundDecimal(value, scale, mode)` in `src/round.mjs` (named export) rounds a decimal number given as a string and returns a string.

- `value` is a string of the form `-?\d+(\.\d+)?` with any number of digits (no exponent, no `+`, no bare `.5` or `5.`); the result must be exact for any length, so it cannot go through `Number`
- `scale` is the number of digits after the decimal point in the result, an integer of at least 0; the result always has exactly that many (`roundDecimal("1", 3, ...)` is `"1.000"`) and no decimal point when `scale` is 0
- `mode` is one of:
  - `half-even`: to the nearest, a tie goes to the neighbour whose last digit is even
  - `half-up`: to the nearest, a tie goes away from zero
  - `half-down`: to the nearest, a tie goes toward zero
  - `floor`: toward negative infinity
  - `ceil`: toward positive infinity
  - `trunc`: toward zero
- the integer part of the result has no leading zeros (except a single `0`), and a result that is zero is written without a minus sign (`"0.00"`, never `"-0.00"`)
- a malformed `value` throws a TypeError; a `scale` that is not an integer of at least 0, or an unknown `mode`, throws a RangeError
