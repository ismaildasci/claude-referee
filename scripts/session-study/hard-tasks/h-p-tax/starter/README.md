# invoice_totals

`invoice_totals(lines, tax_rate, discount_pct="0")` in `taxes.py` computes the money amounts of an invoice with `decimal.Decimal`; floats are not used anywhere.

- `lines` is a list of `(unit_price, quantity)` tuples; `unit_price` is a string such as `"19.99"` (it may have more than two decimals, such as `"1.005"`) and `quantity` an int of at least 1
- `tax_rate` is a string such as `"0.19"` and `discount_pct` a string such as `"10"` for ten percent, between 0 and 100
- for each line: the gross amount is `unit_price * quantity`; the discount is taken off the gross amount, and the result is the line's net amount, rounded to cents; then the line's tax is net times `tax_rate`, rounded to cents. Every rounding to cents rounds halves up (`0.125` becomes `0.13`, `0.025` becomes `0.03`), which is `decimal.ROUND_HALF_UP`
- tax is computed per line and the line taxes are added up; it is not computed from the sum of the net amounts
- the result is a dict `{"net": ..., "tax": ..., "total": ...}` of `Decimal` values with exactly two decimals (`Decimal("0.00")` for an empty invoice); `net` is the sum of the line nets, `tax` the sum of the line taxes and `total` is `net + tax`
- a `unit_price`, `tax_rate` or `discount_pct` that is not a valid decimal string or is negative, a `discount_pct` above 100, or a `quantity` that is not an int of at least 1 (a bool is not accepted) raises a ValueError
