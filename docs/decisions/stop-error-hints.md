# Credential stops and size errors that say where and how much

Registered 2026-10-09, before any code change. Third of the four usage fixes the owner approved in order.

## Why

In the local receipts (4 days, aggregate counts), 22 runs failed with `credential_in_state` and 10 with `too_large`, each cluster mostly inside one long session of the owner's other projects: the same input was sent again and failed again. The credential message names the kind and the field (`secret_assignment in state.context_files...`) but not the line, and its next step does not say what the rule matches. The size messages say the context is too large without a size, the limit or the biggest file.

## The rule

- A credential stop in a multi-line field also carries `line` (1-based, the first match). The message reads `kind in field, line N`; a single-line field keeps today's text. The value is never printed.
- The `next_step` for `secret_assignment` says what it matches: a name with key, token, secret or password and a long mixed-character value; remove the line or shorten the value. Other kinds keep the generic next step.
- `too_large` for decide context and verify source says the estimated tokens and the limit; decide also names the largest context file.

## Bars

- **B1 (no value):** a test shows the message and next step contain no part of the secret.
- **B2 (line):** a two-line evidence with the secret on line 2 reports line 2; a single-line field has no line text; existing `stopped` shapes for single-line fields are unchanged.
- **B3 (hint):** `secret_assignment` gets its own next step; an `aws_access_key` stop keeps the generic one.
- **B4 (size):** decide over the limit names tokens, limit and the largest file; verify names tokens and limit.
- **B5 (gates):** `npm run check` and `ci:local` green.

## Limits

- Nothing becomes less strict: the same inputs stop for the same reasons.
- The line is the first match only.
