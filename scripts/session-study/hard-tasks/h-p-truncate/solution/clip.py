import unicodedata


def _char_width(ch):
    if unicodedata.combining(ch) > 0 or unicodedata.category(ch) in ("Mn", "Me", "Cf"):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def _width(text):
    return sum(_char_width(ch) for ch in text)


def truncate(text, width, ellipsis="…"):
    if not isinstance(width, int) or isinstance(width, bool) or width < 0:
        raise ValueError("width must be a non-negative integer")
    text = unicodedata.normalize("NFC", text)
    if _width(text) <= width:
        return text
    room = width - _width(ellipsis)
    if room < 0:
        raise ValueError("ellipsis is wider than width")
    clusters = []
    for ch in text:
        if _char_width(ch) == 0 and clusters:
            clusters[-1] += ch
        else:
            clusters.append(ch)
    kept = ""
    used = 0
    for cluster in clusters:
        w = _width(cluster)
        if used + w > room:
            break
        kept += cluster
        used += w
    return kept.rstrip() + ellipsis
