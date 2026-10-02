from decimal import Decimal, InvalidOperation

_CENT = Decimal("0.01")


def _dec(value, name):
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    try:
        d = Decimal(value)
    except InvalidOperation:
        raise ValueError(f"{name} is not a decimal") from None
    if not d.is_finite() or d < 0:
        raise ValueError(f"{name} must be a non-negative number")
    return d


def invoice_totals(lines, tax_rate, discount_pct="0"):
    rate = _dec(tax_rate, "tax_rate")
    discount = _dec(discount_pct, "discount_pct")
    if discount > 100:
        raise ValueError("discount above 100")
    net = Decimal("0.00")
    for price, quantity in lines:
        unit = _dec(price, "unit_price")
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
            raise ValueError("bad quantity")
        net += (unit * quantity * (Decimal(100) - discount) / Decimal(100)).quantize(_CENT)
    tax = (net * rate).quantize(_CENT)
    return {"net": net, "tax": tax, "total": net + tax}
