# Economics: where the money goes

Claude's turns decide the cost, not the Jev bill. A batched Jev judgement costs about $0.0001–0.0003. Every Claude Code request re-reads the whole cached conversation, so one extra Claude turn at 80K tokens of context costs about $0.016 on Opus 5.5 before any output. claude-referee is designed around that gap.

The tables on this page are **modelled** from list prices and the formulas below; they aren't measurements. The last section summarises measurements: our own from before this project, and third parties'. Measure your own numbers with `/usage` in Claude Code and `npx claude-referee receipts --tokens`. From v0.2, the A/B harness in `bench/` runs paired comparisons.

## Prices

US dollars per million tokens, as of September 2026.

| Model | Input | Output | 5-min cache write | 1-hour cache write | Cache read |
|---|---:|---:|---:|---:|---:|
| Claude Opus 5.5 | 4 | 20 | 5 | 8 | 0.20 |
| Claude Sonnet 5.5 | 2 | 10 | 2.5 | 4 | 0.20 |
| Claude Haiku 4.5 | 1 | 5 | 1.25 | 2 | 0.10 |
| Jev (`jev-1.13.0`) | 0.042 | 0 | — | — | — |

Sources: [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Jev models](https://docs.typesafe.ai/models.md). Cache writes cost 1.25× input for the 5-minute TTL and 2× for the 1-hour TTL. Sonnet 5.5 and Haiku 4.5 bill cache reads at 0.1× input. Opus 5.5 bills them at 0.05×, which is why its read price is $0.20 rather than $0.40.

Per 1,000 tokens, an Opus 5.5 cache read costs 4.8× what Jev charges to read them once. Uncached input costs 95×, a 5-minute cache write 119× and output 476×.

## The model

Claude Code resends the full context on every request and caches it by exact prefix. New content is billed as a cache write, and every later request bills it again as a cache read ([prompt caching](https://code.claude.com/docs/en/prompt-caching)).

Notation: `w` = cache write price, `r` = cache read price, `o` = output price, all per token. `N` = how many later requests a token stays in context. `S` = context re-read by one request.

- A token that enters the context and stays: `w + N·r`
- `T` tokens that Claude writes (a command or a request file): `T·(o + w + N·r)`
- One extra tool call that delegates to Jev, with `R` tokens of result coming back: `C_call = S·r + T_out·(o + w + N·r) + R·(w + N·r)`
- Saving per item, when Claude would otherwise judge `K` items inline: `s = t·(w + N·r) + v·(o + w + N·r) − Jev_item`. Here `t` is item tokens that would enter context and `v` is Claude's decision tokens per item. The break-even item count is `K* = C_call / s`.

## Table A: cost of 1,000 tokens entering the context

One write plus `N` later reads, in US dollars.

| Model, cache TTL | N=0 | N=10 | N=30 | N=100 | N=300 |
|---|---:|---:|---:|---:|---:|
| Opus 5.5, 5 min | 0.00500 | 0.00700 | 0.01100 | 0.02500 | 0.06500 |
| Opus 5.5, 1 hour | 0.00800 | 0.01000 | 0.01400 | 0.02800 | 0.06800 |
| Sonnet 5.5, 5 min | 0.00250 | 0.00450 | 0.00850 | 0.02250 | 0.06250 |
| Haiku 4.5, 5 min | 0.00125 | 0.00225 | 0.00425 | 0.01125 | 0.03125 |
| Jev, reading 1,000 tokens once | 0.000042 | | | | |

## Table B: one extra tool call that delegates to Jev

Claude-side cost on Opus 5.5, in US dollars.

| S (context) | T_out (Claude writes) | R (result) | N | 5-min TTL | 1-hour TTL |
|---:|---:|---:|---:|---:|---:|
| 30,000 | 200 | 150 | 10 | 0.0125 | 0.0135 |
| 80,000 | 300 | 400 | 30 | 0.0297 | 0.0318 |
| 80,000 | 500 | 2,000 | 30 | 0.0535 | 0.0610 |
| 150,000 | 300 | 400 | 30 | 0.0437 | 0.0458 |
| 150,000 | 500 | 2,000 | 30 | 0.0675 | 0.0750 |

For comparison, asking every option × question pair of a four-option decision as its own request takes 40 requests of about 3,000 tokens each. Even then, the whole Jev side comes to about $0.005. One batched request costs a fraction of that.

## Table C: break-even item count for delegating a judgement

Opus 5.5, 5-minute cache, N=30, T_out=300 in every row, 60 tokens per item, 20 tokens per inline decision. The last column assumes the inline path pays for its own request too: `(C_call − S·r) / s`.

| Scenario | C_call | Saving per item | Break-even K* | If the inline path also needs its own request |
|---|---:|---:|---:|---:|
| 80K context, 400-token result, items not in context | $0.0297 | $0.00128 | **23** | 11 |
| 80K context, 400-token result, items already in context | $0.0297 | $0.00062 | **48** | 22 |
| 80K context, 2,000-token verbose JSON, items not in context | $0.0473 | $0.00128 | **37** | 24 |
| 150K context, 400-token result, items not in context | $0.0437 | $0.00128 | **34** | 11 |
| 150K context, 400-token result, items already in context | $0.0437 | $0.00062 | **71** | 22 |

Delegating single small judgements loses money, and delegating batches wins. Quality effects, such as fewer wrong turns or less rework, aren't in this model. Only an A/B can measure them.

## Cost per judgement, by integration path

Opus 5.5 with 50K tokens of cached context. This is the table behind the README chart, and it uses a simpler model than `C_call`:

- Each extra request re-reads the context.
- Claude's output is billed at the output price.
- The result enters the context once.
- Later re-reads (N) are left out, and 4 characters count as one token.

| How the judgement reaches Claude | Extra Claude requests | Claude output tokens | Claude-side cost |
|---|---:|---:|---:|
| Hook, nothing found | 0 | 0 | $0 |
| Hook adds a 300-character note | 0 | 0 | ≈$0.0004 |
| Prompt hook on Haiku 4.5 (2K in, 50 out), for comparison | 0 (separate model) | 50 | ≈$0.002 per event |
| CLI call with flags only (150-character command, 800-character result) | 1 | ≈40 | ≈$0.012 |
| CLI call with JSON in a heredoc, as `decide` uses | 1 | ≈40–300 | ≈$0.012–0.017 |
| MCP tool call (1,200-character arguments, 800-character result) | 1 | ≈300 | ≈$0.017, plus ≈$0.011 the first time for tool search |
| CLI call after writing a request file | 2 | ≈340 | ≈$0.028 |
| The Jev request itself (2–7K tokens) | — | — | ≈$0.0001–0.0003 |

## What this means for design

| Situation | Claude-side effect | Why |
|---|---|---|
| Automatic check that stays silent (Stop, pre-commit) | ≈$0 extra; a saving if it prevents a check Claude would have run | No extra request, nothing injected |
| Automatic check that blocks (Stop) | Claude continues instead of stopping; each extra turn costs ≈$0.016 at 80K context on Opus 5.5, plus the check it runs | A blocked stop hands Claude the reason and it carries on |
| Batched check over many items not yet in context | Saves money above ≈23 items at 80K context | One call replaces dozens of inline reads |
| Replacing a Haiku `prompt` hook with Jev | ≈$0.002 → ≈$0.0001 per event | The judgement leaves the Claude bill |
| One small judgement whose content is already in context | Loses money | The extra request re-reads the context |
| Claude writing a long request | Loses money: 500 tokens ≈$0.0155 on Claude vs $0.000021 on Jev | Output, cache write and later reads |
| Verbose output that echoes its input | 1,000 result tokens ≈$0.011 over 30 turns | Every later request re-reads it |
| Asking the same question again | A full extra turn for almost no new information | Jev's answers vary by about 0.01 between runs |
| Switching the main model mid-session | At 300K context, switching to Sonnet 5.5 ≈$0.75 vs staying ≈$0.06 | The new model re-reads everything uncached |

Two consequences shape claude-referee:

- Hooks are silent unless they find something.
- Batched checks replace one-by-one tool calls.

Output is short and never echoes its input. There is no main-model routing, and nothing rewrites your history.

## What the evidence says so far

- In the sessions measured before claude-referee was built, 321 CLI calls ran at a median context of 230–470K tokens, not 50K, and returned a median of 76–221 tokens. At list prices that's roughly $0.10 of Claude-side cost per call, against about $0.0007 on Jev for a whole `decide` decision. The size of the context, not the Jev bill, set the cost ([measurements](measurements.md)).
- Pruning tool output saves little at safe thresholds. The best-calibrated public study hid about 5% of large-output text ([winnow](https://github.com/GhalebDweikat/winnow/blob/51d80b945c74c8384bc47fa817179f668289afd8/docs/DESIGN.md)).
- TypeSafe's skill-suggestion cookbook cut wrong skill loads from 16.8% to 7.3%, with a Haiku 4.5 agent on jev-1.12 ([cookbook](https://docs.typesafe.ai/cookbooks/skill_suggestion.md)).

No one has yet published a repeated Claude Code A/B that counts task success, cache effects and Jev cost together. claude-referee's A/B harness (v0.2) will set out how it does that in `bench/PREREG.md` before its first run, and the results will be published either way.
