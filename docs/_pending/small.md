Pending lines for the integrator (stream: small). Not a published doc.

## CHANGELOG.md, under [Unreleased]

### Added

- More credential formats stop a request before it is sent: Stripe live keys (`sk_live_`, `rk_live_`), npm, PyPI, Hugging Face, SendGrid, Google API and GitLab tokens, Telegram bot tokens, Azure storage `AccountKey=` values, Docker `auths` entries, Slack webhook URLs and `xapp-`/`xoxe` tokens, and PGP and PuTTY private key blocks. Test and publishable Stripe keys are kept. Each format has stop and keep fixtures; which formats were added, why, and which were left out (Twilio, Mailgun, Discord) is in `docs/decisions/redaction-patterns.md`.

### Documentation

- `docs/decisions/decide-policy.md`: `decide` keeps two separate requests (written and reversed order) for 2 to 6 options. One request with two questions and balanced rotations were not adopted: no measured benefit beyond noise, and nothing measured for other than 4 options. Jev decide: keep two requests 0.99, both orders agreeing.

## ROADMAP.md

- Remove the bullet "**More redaction patterns.** **help wanted:** ..." or reword it to: "**More redaction patterns.** Done for the formats in [redaction-patterns.md](docs/decisions/redaction-patterns.md); **help wanted:** formats seen in the wild that have a distinctive prefix, each with stop and keep fixtures."
- Replace the "**`decide` policy.**" bullet with: "**`decide` policy.** Settled: two requests for every option count ([decide-policy.md](docs/decisions/decide-policy.md)). Reopen with a measurement of 3, 5 or 6 options or a lower-noise K3 re-run."
