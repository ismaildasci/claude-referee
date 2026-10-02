def moving_average(values, window):
    if isinstance(window, bool) or not isinstance(window, int) or window < 1:
        raise ValueError("window must be an integer of at least 1")
    out = []
    seen = []
    for v in values:
        if v is not None:
            seen.append(v)
            part = seen[-window:]
            out.append(sum(part) / len(part))
        else:
            out.append(sum(seen[-window:]) / len(seen[-window:]) if seen else None)
    return out
