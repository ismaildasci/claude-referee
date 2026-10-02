import re

_AMOUNT = re.compile(r"^(-?)(\d+)(?:\.(\d{1,2}))?$")


def to_cents(text):
    m = _AMOUNT.match(text) if isinstance(text, str) else None
    if not m:
        raise ValueError(f"bad amount {text!r}")
    cents = int(m.group(2)) * 100 + int((m.group(3) or "").ljust(2, "0") or 0)
    return -cents if m.group(1) else cents


def fmt(cents):
    sign = "-" if cents < 0 else ""
    whole, frac = divmod(abs(cents), 100)
    return f"{sign}{whole:,}.{frac:02d}"
