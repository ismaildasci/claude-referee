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
        major, minor, patch, pre = major + 1, 0, 0, []
    elif part == "minor":
        minor, patch, pre = minor + 1, 0, []
    elif part == "patch":
        patch, pre = patch + 1, []
    elif part == "premajor":
        major, minor, patch, pre = major + 1, 0, 0, _base(preid)
    elif part == "preminor":
        minor, patch, pre = minor + 1, 0, _base(preid)
    elif part == "prepatch":
        patch, pre = patch + 1, _base(preid)
    else:
        if not pre:
            patch, pre = patch + 1, _base(preid)
        else:
            pre[-1] = str(int(pre[-1]) + 1) if pre[-1].isdigit() else pre[-1] + ".0"
    out = f"{major}.{minor}.{patch}"
    return out + "-" + ".".join(pre) if pre else out
