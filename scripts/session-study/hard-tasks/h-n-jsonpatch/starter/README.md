# applyPatch

`applyPatch(doc, ops)` in `src/patch.mjs` (named export) applies a list of JSON Patch operations (a subset of RFC 6902) to a JSON document and returns the new document.

- operations are `{ op, path, value }` or `{ op, from, path }`; `op` is one of `add`, `remove`, `replace`, `move`, `copy`, `test`
- `path` and `from` are JSON Pointers: `""` is the whole document, otherwise a `/` followed by reference tokens separated by `/`; in a token `~1` means `/` and `~0` means `~` (decode `~1` first); a `~` followed by anything else is an error
- an array index token is a decimal number without leading zeros (`0`, `7`, never `01` or `-1`)
- `add` sets an object member (replacing an existing one) or inserts into an array at the index, shifting the later elements; the index may equal the array length, and `-` means append; an `add` with path `""` replaces the whole document
- `remove` and `replace` need the target to exist, otherwise they fail; `remove` on an array shifts the later elements; removing the whole document fails
- `move` is a `remove` of `from` followed by an `add` at `path`; moving a value into one of its own children fails
- `copy` adds a deep copy of the value at `from`
- `test` compares the value at `path` with `value` for deep equality (object key order does not matter, `1` and `"1"` differ) and fails when they differ
- the patch is atomic: when any operation fails the function throws an Error whose message starts with `op N:` (N is the zero-based position of the operation) and nothing has changed
- the input document is never modified, also when the patch succeeds
