import re
from functools import lru_cache


def _literal_dot(segment):
    return segment.startswith(".") or segment.startswith("\\.")


def _compile(segment):
    out = []
    i = 0
    n = len(segment)
    while i < n:
        c = segment[i]
        if c == "\\":
            if i + 1 >= n:
                raise ValueError("trailing backslash")
            out.append(re.escape(segment[i + 1]))
            i += 2
        elif c == "*":
            while i < n and segment[i] == "*":
                i += 1
            out.append("[^/]*")
        elif c == "?":
            out.append("[^/]")
            i += 1
        elif c == "[":
            j = i + 1
            negate = j < n and segment[j] == "!"
            if negate:
                j += 1
            items = []
            while j < n and segment[j] != "]":
                if j + 2 < n and segment[j + 1] == "-" and segment[j + 2] != "]":
                    lo, hi = segment[j], segment[j + 2]
                    if lo > hi:
                        raise ValueError("reversed range")
                    items.append(re.escape(lo) + "-" + re.escape(hi))
                    j += 3
                else:
                    items.append(re.escape(segment[j]))
                    j += 1
            if j >= n:
                raise ValueError("unclosed class")
            if not items:
                raise ValueError("empty class")
            out.append("[" + ("^" if negate else "") + "".join(items) + "]")
            i = j + 1
        else:
            out.append(re.escape(c))
            i += 1
    return re.compile("".join(out))


def glob_match(pattern, path):
    pattern_segments = pattern.split("/")
    path_segments = path.split("/")
    compiled = [None if s == "**" else _compile(s) for s in pattern_segments]

    @lru_cache(maxsize=None)
    def match(i, j):
        if i == len(pattern_segments):
            return j == len(path_segments)
        if pattern_segments[i] == "**":
            if match(i + 1, j):
                return True
            return j < len(path_segments) and not path_segments[j].startswith(".") and match(i, j + 1)
        if j >= len(path_segments):
            return False
        segment = path_segments[j]
        if segment.startswith(".") and not _literal_dot(pattern_segments[i]):
            return False
        return compiled[i].fullmatch(segment) is not None and match(i + 1, j + 1)

    return match(0, 0)
