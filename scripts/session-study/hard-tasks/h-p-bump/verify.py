from versions import bump

cases = [
    ("1.2.3", "major", None, "2.0.0"),
    ("1.2.3", "minor", None, "1.3.0"),
    ("1.2.3", "patch", None, "1.2.4"),
    ("1.2.9", "patch", None, "1.2.10"),
    ("1.9.9", "minor", None, "1.10.0"),
    ("2.0.0-rc.1", "major", None, "2.0.0"),
    ("1.0.0-rc.1", "major", None, "1.0.0"),
    ("1.2.0-rc.1", "major", None, "2.0.0"),
    ("1.3.0-rc.1", "minor", None, "1.3.0"),
    ("1.3.1-rc.1", "minor", None, "1.4.0"),
    ("1.2.4-rc.1", "patch", None, "1.2.4"),
    ("1.2.3-rc.1", "major", "beta", "2.0.0"),
    ("1.2.3", "premajor", None, "2.0.0-0"),
    ("1.2.3", "premajor", "beta", "2.0.0-beta.0"),
    ("1.2.3", "preminor", "beta", "1.3.0-beta.0"),
    ("1.2.3", "prepatch", None, "1.2.4-0"),
    ("1.2.3-beta.1", "prepatch", "rc", "1.2.4-rc.0"),
    ("1.2.3-beta.1", "premajor", None, "2.0.0-0"),
    ("1.2.3", "prerelease", None, "1.2.4-0"),
    ("1.2.3", "prerelease", "beta", "1.2.4-beta.0"),
    ("1.2.3-beta.1", "prerelease", None, "1.2.3-beta.2"),
    ("1.2.3-beta.1", "prerelease", "beta", "1.2.3-beta.2"),
    ("1.2.3-beta.9", "prerelease", None, "1.2.3-beta.10"),
    ("1.2.3-alpha.5", "prerelease", "beta", "1.2.3-beta.0"),
    ("1.2.3-beta", "prerelease", None, "1.2.3-beta.0"),
    ("1.2.3-beta", "prerelease", "beta", "1.2.3-beta.0"),
    ("1.2.3-0", "prerelease", None, "1.2.3-1"),
    ("1.2.3-0", "prerelease", "beta", "1.2.3-beta.0"),
    ("1.2.3-alpha.1.x", "prerelease", None, "1.2.3-alpha.2.x"),
]
for version, part, preid, want in cases:
    got = bump(version, part, preid)
    assert got == want, (version, part, preid, got, want)
for args in [("1.2", "patch"), ("v1.2.3", "patch"), ("1.2.3+build", "patch"), ("1.2.3-", "patch"), ("1.2.3", "foo"), ("1.2.3", "prepatch", ""), ("1.2.3", "prepatch", "a b"), ("", "major"), (None, "major")]:
    try:
        bump(*args)
    except ValueError:
        pass
    else:
        raise AssertionError(args)
