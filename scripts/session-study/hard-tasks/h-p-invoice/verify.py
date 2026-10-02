from invoice import build, render
from money import fmt, to_cents
from pricing import price_line

for text, want in [("12.34", 1234), ("12", 1200), ("12.3", 1230), ("0.05", 5), ("-1.50", -150), ("0", 0), ("007.10", 710)]:
    assert to_cents(text) == want, (text, to_cents(text))
for bad in ["", ".5", "1.234", "1,5", "1e3", "+1", "--1", "1.", " 1", "abc", None, 5]:
    try:
        to_cents(bad)
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
for cents, want in [(5, "0.05"), (-5, "-0.05"), (0, "0.00"), (100000, "1,000.00"), (123456789, "1,234,567.89"), (-123456, "-1,234.56"), (99999, "999.99"), (1234, "12.34")]:
    assert fmt(cents) == want, (cents, fmt(cents))

book = {"name": "Book", "price": "9.99", "qty": 3, "category": "reduced"}
assert price_line(book, "DE") == {"name": "Book", "qty": 3, "net": 2997, "tax": 210}
assert price_line({"name": "Pen", "price": "1.50", "qty": 1, "category": "standard"}, "DE") == {"name": "Pen", "qty": 1, "net": 150, "tax": 29}
assert price_line({"name": "Pen", "price": "1.50", "qty": 1, "category": "standard"}, "US")["tax"] == 0
assert price_line({"name": "Cap", "price": "0.01", "qty": 2, "category": "standard"}, "FR") == {"name": "Cap", "qty": 2, "net": 2, "tax": 0}
assert price_line({"name": "Cap", "price": "0.03", "qty": 1, "category": "standard"}, "FR")["tax"] == 1
for item, country in [(book, "XX"), ({**book, "category": "luxury"}, "DE"), ({**book, "qty": 0}, "DE"), ({**book, "qty": 1.5}, "DE"), ({**book, "qty": True}, "DE")]:
    try:
        price_line(item, country)
    except ValueError:
        pass
    else:
        raise AssertionError((item, country))

inv = build([book], "DE")
assert inv == {"lines": [{"name": "Book", "qty": 3, "net": 2997, "tax": 210}], "net": 2997, "shipping": 499, "tax": 305, "total": 3801}, inv
big = {"name": "Monitor", "price": "50.00", "qty": 1, "category": "standard"}
inv2 = build([big], "DE")
assert (inv2["net"], inv2["shipping"], inv2["tax"], inv2["total"]) == (5000, 0, 950, 5950), inv2
just_under = {"name": "Mouse", "price": "49.99", "qty": 1, "category": "standard"}
inv3 = build([just_under], "DE")
assert (inv3["net"], inv3["shipping"], inv3["tax"], inv3["total"]) == (4999, 499, 950 + 95, 4999 + 499 + 950 + 95), inv3
assert build([], "FR") == {"lines": [], "net": 0, "shipping": 499, "tax": 100, "total": 599}
inv4 = build([{"name": "A", "price": "20.00", "qty": 1, "category": "standard"}, {"name": "B", "price": "40.00", "qty": 2, "category": "reduced"}], "FR")
assert (inv4["net"], inv4["shipping"], inv4["tax"], inv4["total"]) == (10000, 0, 400 + 440, 10000 + 840), inv4

assert render(inv) == [
    "Book               3     29.97",
    "-" * 30,
    "Net                      29.97",
    "Shipping                  4.99",
    "Tax                       3.05",
    "Total                    38.01",
]
long_name = {"name": "An extremely long product name", "price": "1234.50", "qty": 2, "category": "standard"}
out = render(build([long_name], "US"))
assert out[0] == "An extremely lon" + "   2" + "  2,469.00", out[0]
assert out[1] == "-" * 30
assert out[-1] == "Total                 2,469.00", out[-1]
