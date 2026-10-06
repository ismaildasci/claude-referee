# Candidate wordings for `string.translatable`

Committed before any of them was recorded (docs/decisions/i18n-real-2.md). Each folder is a pack loaded with `REFEREE_PACKS_DIR=docs/data/i18n-real-2/wordings`; thresholds and model are those of the shipped `i18n@0.1.0`, only the question text, note and criteria differ. `SHA256SUMS` pins the files.

| Pack | Question | Change against `i18n@0.1.0` |
|---|---|---|
| `i18n-w1` | unchanged | the `false` criterion adds strings that are shown but have nothing to translate (numbers, units, versions, brand or product names, text made only of run-time values) |
| `i18n-w2` | "Would a translator localising this interface need to translate this string?" | both criteria rewritten around wording for people; `false` also names strings already passed to a translation function |
| `i18n-w4` | as `i18n-w2` | plus a note that text inside `{...}`, `{{ ... }}` or `${...}` is filled in at run time and not translated (the sentence the blind labellers were given) |
| `i18n-w5` | unchanged | `i18n-w1` plus the note of `i18n-w4` |

A fifth draft (`i18n-w3`, "Is this string both shown to end users and made of words that change with the language ...") was dropped before any request because `lint-pack` flags its question as compound (one Noul question should ask one thing).
