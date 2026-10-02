from linediff import diff_lines

assert diff_lines(["a", "b", "c"], ["a", "x", "c"]) == [("=", "a"), ("-", "b"), ("+", "x"), ("=", "c")]
assert diff_lines(["a", "b"], ["b", "a"]) == [("-", "a"), ("=", "b"), ("+", "a")]
assert diff_lines(["x", "y"], ["y", "x"]) == [("-", "x"), ("=", "y"), ("+", "x")]
assert diff_lines(["a", "a"], ["a"]) == [("=", "a"), ("-", "a")]
assert diff_lines(["a"], ["a", "a"]) == [("=", "a"), ("+", "a")]
assert diff_lines(["1", "2", "3"], ["4", "5"]) == [("-", "1"), ("-", "2"), ("-", "3"), ("+", "4"), ("+", "5")]
assert diff_lines(["a  ", "b\t"], ["a", "b"]) == [("=", "a  "), ("=", "b\t")]
assert diff_lines(["a", "b"], ["a  ", "c\t"]) == [("=", "a"), ("-", "b"), ("+", "c\t")]
assert diff_lines(["  a"], ["a"]) == [("-", "  a"), ("+", "a")]
assert diff_lines(["a b"], ["a  b"]) == [("-", "a b"), ("+", "a  b")]
assert diff_lines(["p", "q", "r", "s"], ["q", "s", "t"]) == [("-", "p"), ("=", "q"), ("-", "r"), ("=", "s"), ("+", "t")]
assert diff_lines(["a", "b", "c", "d"], ["b", "a", "d", "c"]) == [("-", "a"), ("=", "b"), ("-", "c"), ("+", "a"), ("=", "d"), ("+", "c")]
a = ["same", "old1", "old2", "tail"]
b = ["same", "new", "tail"]
assert diff_lines(a, b) == [("=", "same"), ("-", "old1"), ("-", "old2"), ("+", "new"), ("=", "tail")]
a1, b1 = ["a", "b"], ["b", "c"]
diff_lines(a1, b1)
assert a1 == ["a", "b"] and b1 == ["b", "c"]
def apply(script):
    return [line for op, line in script if op in "=+"]
import random
random.seed(7)
for _ in range(60):
    x = [random.choice("abcd") for _ in range(random.randint(0, 8))]
    y = [random.choice("abcd") for _ in range(random.randint(0, 8))]
    script = diff_lines(x, y)
    assert [l for op, l in script if op in "=-"] == x
    assert apply(script) == y
