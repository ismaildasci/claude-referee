def moving_average(values, window):
    if isinstance(window, bool) or not isinstance(window, int) or window < 1:
        raise ValueError("window must be an integer of at least 1")
    out = []
    for i in range(len(values)):
        part = [v for v in values[max(0, i - window + 1) : i + 1] if v is not None]
        out.append(sum(part) / len(part) if part else None)
    return out
