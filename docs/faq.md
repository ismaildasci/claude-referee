# FAQ

## Is this an official TypeSafe or Anthropic project?

No. It's an independent open-source project and isn't affiliated with, endorsed by or sponsored by either company. The name says what it works with, not who made it. To write your own code against Jev, use TypeSafe's official plugin, `typesafe@typesafe-ai` ([typesafe-ai/skills](https://github.com/typesafe-ai/skills)); claude-referee doesn't need it.

## Does it replace Claude's judgement?

No. It answers narrow questions with probabilities and stays out of the way below its thresholds. Claude and you keep the final say. The done-gate is off by default; start it in `shadow`, where it only logs what it would have done.

## Will it break my prompt cache?

It shouldn't. Claude Code caches the conversation by prefix, and the hooks only append short notes; nothing rewrites earlier turns. We haven't measured cache misses with the plugin on yet. The cache guard exists because switching models mid-session re-reads everything uncached.

## What if TypeSafe is slow or down?

The v0.1 hook doesn't call Jev, so sessions never wait on it. A CLI call gives up after 30 seconds and reports `timeout`, which is an unknown, not a "no". From v0.2, hooks that call Jev get a short time budget of a few seconds and fail open: you lose the check, not the session.

## What does it cost to keep installed?

While enabled, claude-referee's skill listing adds at most 250 tokens to every session, even in projects without `.claude/referee.json`. Hooks start a short Node process at the events they handle. `claude plugin details claude-referee` shows the always-on token count.

## Can I use it without Claude Code?

Yes. The CLI is a single bundled file with the TypeSafe SDK inside, so it needs nothing from npm at runtime and also works in scripts and CI.

## Why is the model pinned?

Thresholds are tuned per model version, so claude-referee defaults to `jev-1.13.0`. You can override it with `TYPESAFE_MODEL` or the `model` setting, but the pack's thresholds were tuned on the default. Moving to a new Jev model means re-checking the thresholds on labelled cases; the eval harness that makes this cheap is on the [roadmap](../ROADMAP.md).

## How do I update or uninstall?

- **Update:** third-party marketplaces don't auto-update by default. Run `claude plugin marketplace update claude-referee`, then `claude plugin update claude-referee@claude-referee`.
- **Uninstall:** uninstalling deletes receipts and the cache unless you run `claude plugin uninstall claude-referee@claude-referee --keep-data`.
- **Keep your receipts:** export them first with `npx claude-referee receipts export --out receipts.jsonl`.

## When isn't claude-referee a fit?

- **You can't send code, prompts or test output to a US-hosted API.** claude-referee works by sending small, redacted pieces of them.
- **Your sessions are short and your checks are cheap.** Delegation pays off in batches, from about 23 items at 80K context (modelled).
- **Your content is mostly not in English.** TypeSafe says other languages are "handled but not equally well", so test on your own content first.
- **You need a security boundary.** The referee's gates fail open and can be switched off. Permission rules and branch protection enforce.

## What else is built on Jev for coding agents?

- [jev-belay](https://github.com/valentynkit/jev-belay): an evidence-first Stop gate for Claude Code. claude-referee's done-gate follows the same shape.
- [claude-jev](https://github.com/buchmark/claude-jev): scores review findings, debug hypotheses and design options with Jev.
- [kylerhenry/jevgate](https://github.com/kylerhenry/jevgate): ticket and delivery gates as a Claude Code plugin.
- [thevibeworks/jevgate](https://github.com/thevibeworks/jevgate): a Bash allowlist, with Jev judging only unknown commands.
- [jevlin](https://github.com/designmon/jevlin): judgement calls and a drift watchdog for coding agents.
- [winnow](https://github.com/GhalebDweikat/winnow): tool-output garbage collection, with its measurements published in the design notes.
