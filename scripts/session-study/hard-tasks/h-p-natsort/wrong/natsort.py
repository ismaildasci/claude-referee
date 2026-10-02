import re


def natural_key(text):
    return tuple((0, int(t)) if t.isdigit() else (1, t.casefold()) for t in re.split(r"(\d+)", text) if t != "")


def natural_sorted(items):
    return sorted(items, key=natural_key)
