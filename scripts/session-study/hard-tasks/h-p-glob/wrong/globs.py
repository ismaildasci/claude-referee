import re


def _translate(pattern):
    out = []
    i = 0
    n = len(pattern)
    while i < n:
        c = pattern[i]
        if c == "\\":
            if i + 1 >= n:
                raise ValueError("trailing backslash")
            out.append(re.escape(pattern[i + 1]))
            i += 2
        elif pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        elif c == "[":
            j = pattern.find("]", i + 2)
            if j < 0:
                raise ValueError("unclosed class")
            body = pattern[i + 1 : j]
            if body.startswith("!"):
                body = "^" + body[1:]
            if re.search(r"(.)-(.)", body) and re.search(r"(.)-(.)", body).group(1) > re.search(r"(.)-(.)", body).group(2):
                raise ValueError("reversed range")
            out.append("[" + body + "]")
            i = j + 1
        else:
            out.append(re.escape(c))
            i += 1
    return "".join(out)


def glob_match(pattern, path):
    return re.fullmatch(_translate(pattern), path) is not None
