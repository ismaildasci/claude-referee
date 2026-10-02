# Redaction patterns: which credential formats stop a request

Status: Decided, implemented in `src/engine/redact.ts` (the `STOP` list), fixtures in `test/redact.test.ts`.

Date: 2026-10-02.

## Rule for adding a format

A format is added only when it has a distinctive prefix or fixed structure, so that ordinary text, identifiers and version strings do not stop a request. A format that is only a run of random hex or base64 with no marker is not added; the name-based `secret_assignment` rule already covers those when they sit next to a name such as `token`. Every format has a stop fixture and at least one keep fixture (a look-alike that must pass). Fixtures are synthetic and assembled from parts at test time, so no literal in the repository is a valid or scanner-flagged key. Documentation URLs live here, not in the code.

The structural details (lengths, character sets) follow the vendors' public documentation where it states them, and otherwise the format list that GitHub secret scanning publishes ([supported patterns](https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns)). Vendors can change a format without notice, and the exact lengths were not re-checked against each vendor's live service. A miss means one credential goes through; this list narrows that, it does not remove it.

## Added

| Kind | Shape | Source |
|---|---|---|
| `slack_token` (extended) | `xoxe-` and app-level `xapp-<n>-...` next to the existing `xox[abposr]-` | https://docs.slack.dev/authentication/tokens |
| `slack_webhook` | `hooks.slack.com/services/T.../B.../<secret>` | https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks |
| `gitlab_token` | `glpat-` plus 20 or more URL-safe characters | https://docs.gitlab.com/user/profile/personal_access_tokens/ |
| `stripe_key` | `sk_live_` or `rk_live_` plus 20 or more alphanumerics. Test keys (`sk_test_`) and publishable keys (`pk_live_`) are kept: test keys move no money and publishable keys are meant to be public | https://docs.stripe.com/keys |
| `npm_token` | `npm_` plus exactly 36 alphanumerics | https://docs.npmjs.com/about-access-tokens |
| `pypi_token` | `pypi-AgEIcHlwaS5vcmc` (the base64 of the macaroon header for pypi.org) plus 50 or more characters | https://pypi.org/help/#apitoken |
| `google_api_key` | `AIza` plus exactly 35 URL-safe characters | https://cloud.google.com/docs/authentication/api-keys |
| `huggingface_token` | `hf_` plus 34 or more alphanumerics | https://huggingface.co/docs/hub/security-tokens |
| `sendgrid_key` | `SG.<22>.<43>` | https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys |
| `telegram_bot_token` | `<8-10 digits>:<35 URL-safe characters>`, not preceded by a digit, letter, `_` or `:` | https://core.telegram.org/bots/api#authorizing-your-bot |
| `azure_storage_key` | `AccountKey=` plus 86 base64 characters and `==` (storage connection string) | https://learn.microsoft.com/en-us/azure/storage/common/storage-account-keys-manage |
| `docker_auth` | `"auths": { ... "auth": "<base64>" }` as in `~/.docker/config.json` | https://docs.docker.com/reference/cli/docker/login/ |
| `private_key` (extended) | `-----BEGIN PGP PRIVATE KEY BLOCK-----` and the `PuTTY-User-Key-File-<n>:` header, next to the existing `PRIVATE KEY` blocks (PKCS#1, PKCS#8, EC, OpenSSH, encrypted) | https://datatracker.ietf.org/doc/html/rfc4880#section-6.2 and https://the.earth.li/~sgtatham/putty/latest/htmldoc/AppendixC.html |

Already covered before this record: JWT, GitHub classic and fine-grained tokens (`github_pat_`), AWS access keys, Anthropic, OpenAI, TypeSafe, connection-string credentials.

## Considered and not added

- **Twilio.** The API key SID (`SK` + 32 hex) is an identifier, not a secret, and the auth token is 32 plain hex characters with no marker. Neither can be told from a git hash or an id.
- **Mailgun.** The legacy `key-` + 32 hex is short and shares its shape with many identifiers; no vendor page specifies it.
- **Discord bot tokens.** Three dot-separated base64 parts with no fixed prefix. They would stop long dotted identifiers such as member chains.
- **Plain 32-hex or 40-hex secrets in general.** Indistinguishable from hashes and ids.

## Checks

- Stop and keep fixtures for every row above (`test/redact.test.ts`); the keep fixtures include test and publishable Stripe keys, short `hf_`/`npm_`/`AIza` look-alikes, clock times, a bare `"auth"` entry outside `auths`, an empty `auth`, a PGP public key block and a certificate.
- The new patterns were run over every tracked text file of this repository (452 files, bundles and lock files excluded): no stop outside the fixtures.
- Not measured: false-stop rate on real sessions. The existing measurement ([docs/measurements.md](../measurements.md#redaction-what-patterns-catch-and-what-they-dont)) was taken before these patterns.
