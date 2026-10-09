# A concrete next step for weak and tie decisions

Registered 2026-10-09, before any code change. Fourth of the four usage fixes the owner approved in order.

## Why

In the local receipts (4 days, all projects, aggregate counts), 208 of 569 `decide` runs are `weak` (176) or `tie` (32). Where the session is known, 135 decides in a session had a verdict, 89 of them not `clear`. After a non-clear verdict the next `decide` of the same session within 10 minutes was `clear` in 24 of 83 cases (29%); the 28 chains of such re-asks run up to 14 long. The current next step already says "add the missing fact" and "asking the same question again won't change it", but it does not say what kind of fact separates the options, so the re-asks reword the same facts.

## The rule

The `next_step` of a `weak` or `tie` result keeps its two sentences and names the lean and the runner-up (the option with the next highest mean): the missing fact is one that separates them, such as what each costs, what it breaks or how easily it is undone, not only what it gives. Verdict, `lean`, `p`, `order_disagrees` and `orders` do not change.

## Bars

- **B1 (verdict unchanged):** the recorded decide suites score the same (`eval score` in `ci:local`); the existing decide tests keep passing.
- **B2 (text):** a weak and a tie result name the lean and the runner-up in `next_step`; a clear result has none.
- **B3 (gates):** `npm run check` and `ci:local` green.
- **Report (not a bar):** after the next release, the same re-ask measure on new receipts: the share of non-clear decides whose re-ask within 10 minutes is `clear`, against the 29% above.

## Limits

- This is wording; whether it changes behaviour is only known from the report.
- The runner-up is the second highest mean, which for a tie can be equal to the lean's.
