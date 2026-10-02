import re
import shlex

_KEYS = {"author", "tag", "lang", "year"}


def parse_query(text):
    result = {"terms": [], "exclude": [], "filters": {}, "not_filters": {}, "ranges": {}}
    for token in shlex.split(text):
        negated = token.startswith("-") and len(token) > 1
        if negated:
            token = token[1:]
        if token == "-":
            continue
        key, sep, value = token.partition(":")
        if sep and key.lower() in _KEYS:
            key = key.lower()
            values = [v for v in value.split(",") if v]
            if not values:
                raise ValueError("empty filter")
            if key == "year":
                m = re.fullmatch(r"(\d{4})?(?:\.\.)?(\d{4})?", values[0])
                if negated or len(values) != 1 or not m or not any(m.groups()):
                    raise ValueError("bad year")
                low = int(m.group(1)) if m.group(1) else None
                high = int(m.group(2)) if m.group(2) else None
                if ".." not in values[0]:
                    high = low
                result["ranges"]["year"] = (low, high)
                continue
            target = result["not_filters" if negated else "filters"].setdefault(key, [])
            for v in values:
                v = v.lower() if key == "lang" else v
                if v not in target:
                    target.append(v)
            continue
        if token:
            result["exclude" if negated else "terms"].append(token)
    return result
