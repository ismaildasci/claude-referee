# natural sorting

`natsort.py` provides `natural_key(text)`, a sort key, and `natural_sorted(items)`, which returns a new list of strings sorted by it (`sorted(items, key=natural_key)`).

Order of two strings:

1. both are first normalized to Unicode NFC
2. each is split into tokens: runs of the ASCII digits `0-9` and runs of everything else (so `٣`, an Arabic-Indic digit, is ordinary text)
3. tokens are compared left to right. A number token is lower than a text token; two numbers compare by value; two texts compare case-insensitively (`str.casefold`); when all shared tokens are equal the string with fewer tokens is lower
4. strings that are still equal after that are ordered by a second comparison of the same tokens: texts compare with upper and lower case swapped (so `a` comes before `A`), and numbers of equal value compare by their length, so fewer leading zeros come first (`a1`, `a01`, `a001`)
5. strings that are equal after all of this keep their input order (the sort is stable)
