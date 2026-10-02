import rates
from money import fmt
from pricing import price_line


def build(items, country):
    lines = [price_line(item, country) for item in items]
    net = sum(line["net"] for line in lines)
    shipping = 0 if net >= rates.FREE_SHIPPING_FROM_CENTS else rates.SHIPPING_CENTS
    tax = sum(line["tax"] for line in lines)
    return {"lines": lines, "net": net, "shipping": shipping, "tax": tax, "total": net + shipping + tax}


def render(invoice):
    out = [f"{line['name'][:16]:<16}{line['qty']:>4}{fmt(line['net']):>10}" for line in invoice["lines"]]
    out.append("-" * 30)
    for label, key in (("Net", "net"), ("Shipping", "shipping"), ("Tax", "tax"), ("Total", "total")):
        out.append(f"{label:<20}{fmt(invoice[key]):>10}")
    return out
