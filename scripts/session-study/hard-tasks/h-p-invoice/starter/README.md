# invoices

Four modules; `rates.py` is given and must not change.

## money.py

- `to_cents(text)` parses an amount like `"12.34"`, `"12"`, `"12.3"` (= 1230), `"0.05"` or `"-1.50"` into an int number of cents. Digits only, with at most two decimals and an optional leading `-`; anything else (`""`, `".5"`, `"1.234"`, `"1,5"`, `"1e3"`, `"+1"`) raises a ValueError
- `fmt(cents)` formats cents for display with two decimals and a comma between thousands: `5` is `"0.05"`, `-5` is `"-0.05"`, `100000` is `"1,000.00"`, `123456789` is `"1,234,567.89"`

## pricing.py

- `price_line(item, country)` takes `{"name": str, "price": str, "qty": int, "category": "standard" or "reduced"}` and returns `{"name", "qty", "net", "tax"}` with `net` and `tax` in cents: `net` is the price in cents times `qty`, `tax` is `net` times the rate of the country and category, where `rates.RATES[country][category]` is in hundredths of a percent (1900 is 19%). Tax is rounded to whole cents with halves rounded up (`28.5` cents is `29`); use integer arithmetic. An unknown country or category, or a `qty` that is not an int of at least 1, raises a ValueError

## invoice.py

- `build(items, country)` returns `{"lines": [...], "net": ..., "shipping": ..., "tax": ..., "total": ...}`, all amounts in cents: `lines` are the `price_line` results in order, `net` is the sum of the line nets and the first part of `tax` is the sum of the line taxes
- shipping is `rates.SHIPPING_CENTS`, except that it is 0 when `net` is at least `rates.FREE_SHIPPING_FROM_CENTS`. Shipping is taxed at the standard rate of the country with the same rounding, and that tax is part of `tax`. `total` is `net + shipping + tax`
- `render(invoice)` returns the invoice as a list of strings: one per line, `f"{name[:16]:<16}{qty:>4}{fmt(net):>10}"`, then a line of 30 hyphens, then the rows `Net`, `Shipping`, `Tax` and `Total`, each `f"{label:<20}{fmt(amount):>10}"`
