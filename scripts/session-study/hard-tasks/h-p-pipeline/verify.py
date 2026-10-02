from datetime import date
from decimal import Decimal

from parse import parse_lines
from pipeline import run
from report import summarize
from validate import validate

A = "\n".join([
    "name,qty,price,date",
    "Widget,3,2.50,2024-01-05",
    "# a comment",
    "",
    '"Gadget, large",1,10.00,2024-02-29',
    "widget,2,1.00,2024-01-05",
    "Bolt,x,1.00,2024-01-01",
    "Nut,2,1.005,2024-01-01",
    "Gear,1,3.00,2024-02-30",
    "Cog,1,3.00",
    "Spring,2,0.50,2024-03-01",
    " Spring , 1 , 0.25 , 2024-03-02",
])
want_a = [
    "rows: 4 valid, 5 invalid",
    "total: 18.75",
    "line 6: duplicate of line 2",
    "line 7: qty must be a positive integer",
    "line 8: price must be a non-negative amount with at most 2 decimals",
    "line 9: date is not a valid ISO date",
    "line 10: expected 4 fields, got 3",
    "latest: 2024-03-02",
]
assert run(A) == want_a, run(A)

B = "name,qty,price,date\r\nLine Break,1,1.00,2024-01-01\r\nBad,0,1.00,2024-01-01\r\n"
rows = parse_lines(B)
assert rows == [{"line": 2, "fields": ["Line Break", "1", "1.00", "2024-01-01"]}, {"line": 3, "fields": ["Bad", "0", "1.00", "2024-01-01"]}], rows
valid, errors = validate(rows)
assert valid == [{"line": 2, "name": "Line Break", "qty": 1, "price": Decimal("1.00"), "date": date(2024, 1, 1)}], valid
assert errors == [{"line": 3, "error": "qty must be a positive integer"}], errors
assert summarize(valid, errors) == ["rows: 1 valid, 1 invalid", "total: 1.00", "line 3: qty must be a positive integer", "latest: 2024-01-01"]
assert run(B) == ["rows: 1 valid, 1 invalid", "total: 1.00", "line 3: qty must be a positive integer", "latest: 2024-01-01"]

assert run("name,qty,price,date\r\n") == ["rows: 0 valid, 0 invalid", "total: 0.00", "latest: -"]
assert run("name,qty,price,date") == ["rows: 0 valid, 0 invalid", "total: 0.00", "latest: -"]
assert run("name,qty,price,date\n\n# only comments\n   \n") == ["rows: 0 valid, 0 invalid", "total: 0.00", "latest: -"]
assert parse_lines('name,qty,price,date\n"say ""hi""",1,1.00,2024-01-01')[0]["fields"] == ['say "hi"', "1", "1.00", "2024-01-01"]
assert parse_lines("name,qty,price,date\n\n\n  # c\nx,1,1,2024-01-01")[0]["line"] == 5
assert parse_lines("name,qty,price,date\n  x , 1 ,\t2 , 2024-01-01 ")[0]["fields"] == ["x", "1", "2", "2024-01-01"]

C = "name,qty,price,date\n,1,1.00,2024-01-01\nA,01,1.00,2024-01-01\nB,1,.5,2024-01-01\nC,1,1.00,2024-1-1\nD,1,1.00,20240101\nE,1,-1.00,2024-01-01\nF,1,1.00,2024-01-01,extra\nG,1,0,2023-02-29\nH,10,0.10,2024-12-31\nh,1,9.99,2024-12-31\nH,1,9.99,2025-01-01"
valid, errors = validate(parse_lines(C))
assert [(e["line"], e["error"]) for e in errors] == [
    (2, "name is empty"),
    (3, "qty must be a positive integer"),
    (4, "price must be a non-negative amount with at most 2 decimals"),
    (5, "date is not a valid ISO date"),
    (6, "date is not a valid ISO date"),
    (7, "price must be a non-negative amount with at most 2 decimals"),
    (8, "expected 4 fields, got 5"),
    (9, "date is not a valid ISO date"),
    (11, "duplicate of line 10"),
], errors
assert [v["line"] for v in valid] == [10, 12]
assert summarize(valid, errors)[:2] == ["rows: 2 valid, 9 invalid", "total: 10.99"]
assert summarize(valid, errors)[-1] == "latest: 2025-01-01"

for bad in ["", "name,qty,price", "Name,qty,price,date", "name,qty,price,date,extra", "x\nname,qty,price,date", " name,qty,price,date", "name, qty,price,date"]:
    for fn in (parse_lines, run):
        try:
            fn(bad)
        except ValueError:
            pass
        else:
            raise AssertionError((fn.__name__, bad))
