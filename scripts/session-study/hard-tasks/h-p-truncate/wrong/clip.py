import unicodedata


def _char_width(ch):
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def _width(text):
    return sum(_char_width(ch) for ch in text)


def truncate(text, width, ellipsis="…"):
    if not isinstance(width, int) or isinstance(width, bool) or width < 0:
        raise ValueError("width must be a non-negative integer")
    if _width(text) <= width:
        return text
    room = width - _width(ellipsis)
    if room < 0:
        raise ValueError("ellipsis is wider than width")
    kept = ""
    used = 0
    for ch in text:
        w = _char_width(ch)
        if used + w > room:
            break
        kept += ch
        used += w
    return kept.rstrip() + ellipsis
