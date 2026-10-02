import re

_VERSION = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$")
_PREID = re.compile(r"^[0-9A-Za-z-]+$")
_PARTS = {"major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease"}


def _base(preid):
    return [preid, "0"] if preid else ["0"]


def bump(version, part, preid=None):
    m = _VERSION.fullmatch(version) if isinstance(version, str) else None
    if not m or part not in _PARTS:
        raise ValueError("bad version or part")
    if preid is not None and (not isinstance(preid, str) or not _PREID.fullmatch(preid)):
        raise ValueError("bad preid")
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    pre = m.group(4).split(".") if m.group(4) else []
    if part == "major":
        if not (pre and minor == 0 and patch == 0):
            major, minor, patch = major + 1, 0, 0
        pre = []
    elif part == "minor":
        if not (pre and patch == 0):
            minor, patch = minor + 1, 0
        pre = []
    elif part == "patch":
        if not pre:
            patch += 1
        pre = []
    elif part == "premajor":
        major, minor, patch, pre = major + 1, 0, 0, _base(preid)
    elif part == "preminor":
        minor, patch, pre = minor + 1, 0, _base(preid)
    elif part == "prepatch":
        patch, pre = patch + 1, _base(preid)
    else:
        if not pre:
            patch, pre = patch + 1, _base(preid)
        elif preid and preid != pre[0]:
            pre = [preid, "0"]
        else:
            for i in range(len(pre) - 1, -1, -1):
                if pre[i].isdigit():
                    pre[i] = str(int(pre[i]) + 1)
                    break
            else:
                pre.append("0")
    out = f"{major}.{minor}.{patch}"
    return out + "-" + ".".join(pre) if pre else out
