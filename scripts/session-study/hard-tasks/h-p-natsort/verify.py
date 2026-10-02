from natsort import natural_key, natural_sorted

cases = [
    (["a", "A"], ["a", "A"]),
    (["A", "a"], ["a", "A"]),
    (["a1", "a01", "a001", "a1"], ["a1", "a1", "a01", "a001"]),
    (["x10", "X9", "x9"], ["x9", "X9", "x10"]),
    (["a٣", "a2", "a10"], ["a2", "a10", "a٣"]),
    (["1a", "a1", "10a", "2a"], ["1a", "2a", "10a", "a1"]),
    (["file", "file1", "file0", "fil"], ["fil", "file", "file0", "file1"]),
    (["éz", "éa"], ["éa", "éz"]),
    (["b2", "B1", "a10", "A2"], ["A2", "a10", "B1", "b2"]),
    (["img-10", "img-9", "IMG-9"], ["img-9", "IMG-9", "img-10"]),
    (["v1.10", "v1.9", "v1.9.1", "v1"], ["v1", "v1.9", "v1.9.1", "v1.10"]),
    (["007", "7", "07", "8"], ["7", "07", "007", "8"]),
    (["ß", "ss", "st"], ["ß", "ss", "st"]),
    ([], []),
]
for items, want in cases:
    got = natural_sorted(items)
    assert got == want, (items, got, want)
src = ["é", "é"]
assert natural_sorted(src) == src
assert natural_sorted(src[::-1]) == src[::-1]
original = ["b", "a"]
natural_sorted(original)
assert original == ["b", "a"]
assert natural_key("a1") < natural_key("a2") < natural_key("a10")
