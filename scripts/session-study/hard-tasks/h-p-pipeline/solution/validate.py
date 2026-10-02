import re
from datetime import date
from decimal import Decimal


def _check(fields):
    if len(fields) != 4:
        return None, f"expected 4 fields, got {len(fields)}"
    name, qty, price, day = fields
    if name == "":
        return None, "name is empty"
    if not re.fullmatch(r"[1-9][0-9]*", qty):
        return None, "qty must be a positive integer"
    if not re.fullmatch(r"[0-9]+(\.[0-9]{1,2})?", price):
        return None, "price must be a non-negative amount with at most 2 decimals"
    try:
        if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", day):
            raise ValueError
        parsed = date.fromisoformat(day)
    except ValueError:
        return None, "date is not a valid ISO date"
    return {"name": name, "qty": int(qty), "price": Decimal(price), "date": parsed}, None


def validate(rows):
    valid, errors, seen = [], [], {}
    for row in rows:
        record, error = _check(row["fields"])
        if record is not None:
            key = (record["name"].casefold(), record["date"])
            if key in seen:
                record, error = None, f"duplicate of line {seen[key]}"
            else:
                seen[key] = row["line"]
        if record is None:
            errors.append({"line": row["line"], "error": error})
        else:
            valid.append({"line": row["line"], **record})
    return valid, errors
