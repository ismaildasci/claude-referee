from money import to_cents
from rates import RATES


def price_line(item, country):
    if country not in RATES or item.get("category") not in RATES[country]:
        raise ValueError("unknown country or category")
    qty = item["qty"]
    if isinstance(qty, bool) or not isinstance(qty, int) or qty < 1:
        raise ValueError("bad qty")
    net = to_cents(item["price"]) * qty
    return {"name": item["name"], "qty": qty, "net": net, "tax": round(net * RATES[country][item["category"]] / 10000)}
