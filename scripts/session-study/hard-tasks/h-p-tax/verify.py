from decimal import Decimal

from taxes import invoice_totals


def check(lines, rate, discount, net, tax, total):
    got = invoice_totals(lines, rate, discount) if discount is not None else invoice_totals(lines, rate)
    assert set(got) == {"net", "tax", "total"}, got
    assert all(isinstance(v, Decimal) for v in got.values()), got
    assert (str(got["net"]), str(got["tax"]), str(got["total"])) == (net, tax, total), (lines, rate, discount, got)


check([("10.00", 1)], "0.19", None, "10.00", "1.90", "11.90")
check([("0.50", 1)], "0.05", None, "0.50", "0.03", "0.53")
check([("0.10", 1)] * 3, "0.05", None, "0.30", "0.03", "0.33")
check([("0.25", 1)], "0", "50", "0.13", "0.00", "0.13")
check([("19.99", 3)], "0.19", None, "59.97", "11.39", "71.36")
check([("1.005", 1)], "0", None, "1.01", "0.00", "1.01")
check([("100.00", 1)], "0.20", "15", "85.00", "17.00", "102.00")
check([], "0.19", None, "0.00", "0.00", "0.00")
check([("2.50", 3), ("0.99", 2)], "0.07", "10", "8.53", "0.59", "9.12")
check([("0.05", 1)] * 10, "0.10", None, "0.50", "0.10", "0.60")
check([("0.15", 1)] * 2, "0.10", None, "0.30", "0.04", "0.34")
check([("1.00", 2)], "0.075", "0", "2.00", "0.15", "2.15")
check([("33.33", 3)], "0.0", "100", "0.00", "0.00", "0.00")
check([("5.00", 1)], "0.19", "0.5", "4.98", "0.95", "5.93")
for bad in [
    ([("-1.00", 1)], "0.1", "0"),
    ([("1.00", 0)], "0.1", "0"),
    ([("1.00", 1.5)], "0.1", "0"),
    ([("1.00", True)], "0.1", "0"),
    ([("1.00", 1)], "0.1", "101"),
    ([("1.00", 1)], "0.1", "-1"),
    ([("abc", 1)], "0.1", "0"),
    ([("1.00", 1)], "-0.1", "0"),
    ([("1.00", 1)], "x", "0"),
    ([("1.00", 1)], "0.1", "ten"),
    ([(1.0, 1)], "0.1", "0"),
]:
    try:
        invoice_totals(*bad)
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
