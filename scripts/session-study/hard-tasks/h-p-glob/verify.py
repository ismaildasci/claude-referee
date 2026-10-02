from globs import glob_match

yes = [
    ("*.py", "a.py"), ("src/*.py", "src/a.py"), ("src/**/*.py", "src/a.py"), ("src/**/*.py", "src/x/y/a.py"),
    ("**/a.py", "a.py"), ("**/a.py", "x/y/a.py"), ("a/**", "a"), ("a/**", "a/b/c"), ("*", "a.txt"), (".*", ".env"),
    (".*.txt", ".hidden.txt"), ("**/.git/x", ".git/x"), ("a/?/c", "a/b/c"), ("[abc].txt", "b.txt"), ("[!a-c].txt", "d.txt"),
    ("file[0-9][0-9]", "file42"), ("a\\*b", "a*b"), ("a\\?", "a?"), ("\\.hidden", ".hidden"), ("a*b*c", "aXXbYYc"),
    ("*/*/*", "a/b/c"), ("a/**/**/b", "a/b"), ("**", "a/b/c"), ("**/*.py", "pkg/x.py"), ("a**b", "axxb"), ("a/**/b", "a/b"),
    ("a/**/b", "a/x/y/b"), ("[a-c]x", "cx"), ("*.tar.gz", "backup.tar.gz"), ("a/.b/c", "a/.b/c"), ("a/.*/c", "a/.b/c"),
]
no = [
    ("*.py", "dir/a.py"), ("a/**", "ab"), ("*", ".env"), ("*.txt", ".hidden.txt"), ("**/x", ".git/x"), ("**/x", "a/.git/x"),
    ("a/?/c", "a/bb/c"), ("?.py", "ab.py"), ("[a-c].txt", "d.txt"), ("[!a-c].txt", "b.txt"), ("a\\*b", "axb"), ("A.py", "a.py"),
    ("a*b*c", "ac"), ("*/*", "a/b/c"), ("**", ".a/b"), ("**/*.py", "pkg/.hidden/x.py"), ("*.py", ".x.py"), ("a/*/c", "a/.b/c"),
    ("a/**/b", "a/.x/b"), ("a/b", "a"), ("a", "a/b"), ("a**b", "a/b"), ("?", ".")
]
for p, s in yes:
    assert glob_match(p, s) is True, (p, s)
for p, s in no:
    assert glob_match(p, s) is False, (p, s)
for bad in ["[abc", "[]", "[z-a]", "abc\\", "a/[b", "[!]"]:
    for path in ["abc", "zzz", "q/r"]:
        try:
            glob_match(bad, path)
        except ValueError:
            pass
        else:
            raise AssertionError((bad, path))
