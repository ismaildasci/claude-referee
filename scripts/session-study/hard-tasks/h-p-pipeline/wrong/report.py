from decimal import Decimal


def summarize(valid, errors):
    total = sum((r["price"] * r["qty"] for r in valid), Decimal("0"))
    out = [f"rows: {len(valid)} valid, {len(errors)} invalid", f"total: {total:.2f}"]
    out += [f"line {e['line']}: {e['error']}" for e in sorted(errors, key=lambda e: e["line"])]
    out.append(f"latest: {max(r['date'] for r in valid).isoformat()}" if valid else "latest: -")
    return out
