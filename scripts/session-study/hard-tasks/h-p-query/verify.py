from query import parse_query


def q(text, terms=(), exclude=(), filters=None, not_filters=None, ranges=None):
    want = {"terms": list(terms), "exclude": list(exclude), "filters": filters or {}, "not_filters": not_filters or {}, "ranges": ranges or {}}
    got = parse_query(text)
    assert got == want, (text, got, want)


q("")
q("   ")
q("hello world", terms=["hello", "world"])
q('"hello world" again', terms=["hello world", "again"])
q('say "hi there" now', terms=["say", "hi there", "now"])
q("-spam", exclude=["spam"])
q('-"bad words" ok', terms=["ok"], exclude=["bad words"])
q("- alone", terms=["alone"])
q('-', )
q('"-not excluded"', terms=["-not excluded"])
q('"tag:x"', terms=["tag:x"])
q("foo:bar", terms=["foo:bar"])
q('foo:"a b"', terms=["foo:a b"])
q('ab"c d"', terms=["abc d"])
q('""', )
q('"" x', terms=["x"])
q("author:Jane", filters={"author": ["Jane"]})
q('author:"Jane Doe"', filters={"author": ["Jane Doe"]})
q("AUTHOR:Jane Tag:Ml", filters={"author": ["Jane"], "tag": ["Ml"]})
q("tag:a,b,c", filters={"tag": ["a", "b", "c"]})
q('tag:a,"b,c",d', filters={"tag": ["a", "b,c", "d"]})
q("tag:a,,b,", filters={"tag": ["a", "b"]})
q("tag:a tag:b tag:a", filters={"tag": ["a", "b"]})
q("lang:EN,Tr lang:en", filters={"lang": ["en", "tr"]})
q("-tag:spam,ads", not_filters={"tag": ["spam", "ads"]})
q("tag:x -tag:x", filters={"tag": ["x"]}, not_filters={"tag": ["x"]})
q("year:2020", ranges={"year": (2020, 2020)})
q("year:2019..2021", ranges={"year": (2019, 2021)})
q("year:2019..", ranges={"year": (2019, None)})
q("year:..2021", ranges={"year": (None, 2021)})
q("year:2019 year:2022..2023", ranges={"year": (2022, 2023)})
q("YEAR:2020..2020", ranges={"year": (2020, 2020)})
q('tag:"a:b" x:y', terms=["x:y"], filters={"tag": ["a:b"]})
q('a\\b "c\\"d" "e\\\\f"', terms=["a\\b", 'c"d', "e\\f"])
q("same same", terms=["same", "same"])
q("-x -x", exclude=["x", "x"])
q('tag:"x y" "tag:z"', terms=["tag:z"], filters={"tag": ["x y"]})
q('"tag":x', terms=["tag:x"])
q('"-"', terms=["-"])
for bad in ['"open', 'a "b', "tag:", "tag:,", 'tag:""', "year:abc", "year:2021..2019", "year:..", "year:2020,2021", "-year:2020", "year:20", "year:", "year:20200"]:
    try:
        parse_query(bad)
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
