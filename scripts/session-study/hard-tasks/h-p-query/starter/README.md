# parse_query

`parse_query(text)` in `query.py` parses a search box string into a dict with exactly these keys: `terms` (list of str), `exclude` (list of str), `filters` (dict of key to list of str), `not_filters` (dict of key to list of str) and `ranges` (dict of key to a `(low, high)` tuple). All five are always present.

Tokens and quoting:

- tokens are separated by whitespace that is not inside double quotes
- double quotes work as in a shell: they can start anywhere in a token, and the quoted text may hold spaces, `:`, `,` and `-` without any special meaning; inside quotes `\"` is a literal quote and `\\` a literal backslash, any other backslash is literal; the quote characters themselves are not part of the result (`ab"c d"` is the one token `abc d`)
- an unterminated quote raises a ValueError

Meaning of a token (looked at before quote characters are removed, so only unquoted characters count):

- an unquoted `-` at the start of a token (when something follows it) marks it as negated; a token that is just `-` is ignored
- a token with an unquoted `:` whose part before it is one of `author`, `tag`, `lang`, `year` (any letter case, stored in lower case) is a filter; the part after the `:` is a list of values separated by unquoted commas; empty values are dropped and when none remain (`tag:`) a ValueError is raised
- every other token is a plain term whose text is the whole token with its quotes removed (so `foo:bar` and `"tag:x"` are terms); a plain term with no text (`""`) is ignored
- plain terms go to `terms`, or to `exclude` when negated, in the order they appear, duplicates kept
- filter values go to `filters[key]`, or `not_filters[key]` when negated, in the order they appear across the whole query with duplicates removed (first one stays); values keep their case except for `lang`, which is lowercased
- `year` is not a list filter: its value is one of `2020` (that year), `2019..2021`, `2019..` or `..2021` (inclusive range, an open end is `None`), with years of exactly 4 digits, and it goes to `ranges["year"]` as `(low, high)`; a later `year` token replaces an earlier one. Anything else (several values, `abc`, `..`, a reversed range) and a negated `year` raise a ValueError
