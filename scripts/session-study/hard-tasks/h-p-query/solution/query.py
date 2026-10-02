import re

_KEYS = {"author", "tag", "lang", "year"}
_YEAR = re.compile(r"^(\d{4})$|^(\d{4})?\.\.(\d{4})?$")


def _scan(text):
    tokens = []
    current = None
    quoted = False
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if quoted:
            if c == "\\" and i + 1 < n and text[i + 1] in '"\\':
                current.append((text[i + 1], True))
                i += 2
                continue
            if c == '"':
                quoted = False
            else:
                current.append((c, True))
        elif c == '"':
            quoted = True
            if current is None:
                current = []
        elif c.isspace():
            if current is not None:
                tokens.append(current)
                current = None
        else:
            if current is None:
                current = []
            current.append((c, False))
        i += 1
    if quoted:
        raise ValueError("unterminated quote")
    if current is not None:
        tokens.append(current)
    return tokens


def _text(chars):
    return "".join(c for c, _ in chars)


def parse_query(text):
    result = {"terms": [], "exclude": [], "filters": {}, "not_filters": {}, "ranges": {}}
    for token in _scan(text):
        negated = False
        if token and token[0] == ("-", False):
            if len(token) == 1:
                continue
            negated = True
            token = token[1:]
        colon = next((i for i, (c, q) in enumerate(token) if c == ":" and not q), None)
        key = _text(token[:colon]).lower() if colon is not None else None
        if colon is not None and all(not q for _, q in token[:colon]) and key in _KEYS:
            items = [[]]
            for c, q in token[colon + 1 :]:
                if c == "," and not q:
                    items.append([])
                else:
                    items[-1].append((c, q))
            values = [v for v in (_text(item) for item in items) if v != ""]
            if not values:
                raise ValueError("empty filter")
            if key == "year":
                if negated or len(values) != 1:
                    raise ValueError("bad year filter")
                m = _YEAR.match(values[0])
                if not m or (m.group(0) == ".."):
                    raise ValueError("bad year")
                if m.group(1):
                    low = high = int(m.group(1))
                else:
                    low = int(m.group(2)) if m.group(2) else None
                    high = int(m.group(3)) if m.group(3) else None
                if low is not None and high is not None and low > high:
                    raise ValueError("reversed range")
                result["ranges"]["year"] = (low, high)
                continue
            target = result["not_filters" if negated else "filters"].setdefault(key, [])
            for v in values:
                v = v.lower() if key == "lang" else v
                if v not in target:
                    target.append(v)
            continue
        word = _text(token)
        if word == "":
            continue
        result["exclude" if negated else "terms"].append(word)
    return result
