import re
import unicodedata

_TOKEN = re.compile(r"[0-9]+|[^0-9]+")


def natural_key(text):
    tokens = _TOKEN.findall(unicodedata.normalize("NFC", text))
    primary = tuple((0, int(t)) if t[0] in "0123456789" else (1, t.casefold()) for t in tokens)
    secondary = tuple((0, len(t)) if t[0] in "0123456789" else (1, t.swapcase()) for t in tokens)
    return primary, secondary


def natural_sorted(items):
    return sorted(items, key=natural_key)
