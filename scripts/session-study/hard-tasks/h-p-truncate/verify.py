import unicodedata

from clip import truncate

assert truncate("hello world", 8) == "hello w…"
assert truncate("hello world", 7) == "hello…"
assert truncate("hello", 5) == "hello"
assert truncate("hello", 10) == "hello"
assert truncate("", 3) == ""
assert truncate("ab   cd", 5) == "ab…"
assert truncate("  ab   cd", 6) == "  ab…"
assert truncate("abcdefgh", 6, "...") == "abc..."
assert truncate("ab", 2, "...") == "ab"
assert truncate("你好世界", 6) == "你好…"
assert truncate("你好世界", 7) == "你好世…"
assert truncate("你好世界", 8) == "你好世界"
assert truncate("ＡＢＣ", 4) == "Ａ…"
assert truncate("q̣̇yzwv", 4) == "q̣̇yz…"
assert truncate("q̣̇yzwv", 3) == "q̣̇y…"
assert truncate("q̣̇yz", 4) == "q̣̇yz"
assert truncate("ééééé", 4) == "ééé…"
assert truncate("éé", 5) == "éé"
assert unicodedata.is_normalized("NFC", truncate("ééééé", 4))
assert truncate("abcdef", 1) == "…"
assert truncate("abcdef", 1, "") == "a"
assert truncate("ab cd", 3, "") == "ab"
for bad in [("abcdef", 0), ("abcdef", 2, "..."), ("abcdef", -1), ("ab", -1)]:
    try:
        truncate(*bad)
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
