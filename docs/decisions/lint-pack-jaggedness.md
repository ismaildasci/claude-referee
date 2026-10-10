# lint-pack: two rules from the jaggedness page

Written 2026-10-10, after the code (the registration came second; the bars below were checked by the tests).

## Why

TypeSafe's "Jev 1.13 jaggedness" page says a Noul where `true` maps to no and `false` to yes performs worse, and that hex or RGB values are not judged reliably. `lint-pack` checked neither.

## The rules

- `negated_true` (warn): a Noul whose `true` criterion starts with no, not, never or none.
- `numeric_value` (warn): a question text with a `#rrggbb` colour, an `rgb(`/`rgba(` call or a `0x` hex literal.

Not added: a double-negative rule. The page names no such failure mode, so it would be a guess.

## Bars

- **B1:** each rule has a violating fixture in `test/lint-pack.test.ts` and a clean fixture next to it.
- **B2:** the `generic` and `i18n` packs still lint clean.
- **B3:** `npm run check` and `ci:local` green.

## Limits

- The negation test looks only at the first word of `true`; "The log does not show errors" is not caught.
- A hex literal in a question about code (`0x` addresses) also warns; it is advice, not an error.
