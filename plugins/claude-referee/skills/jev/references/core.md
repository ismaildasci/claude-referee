# TypeSafe Jev: facts the referee relies on

Verified: 2026-09-30 against docs.typesafe.ai and typesafe.ai/legal; model jev-1.13.0.

## Questions

- **Noul**: a yes/no question; the answer is the probability of yes.
- **Choice**: one label from a named set; the answer has the label, a probability per label and a confidence.
- **Score**: a level on an ordered rubric of at least two descriptions; the answer is an expected score.
- All questions in one request are answered against the same `state`, in parallel. Ask everything about one state in one request.

Source: https://docs.typesafe.ai/primitives.md

## Model, price and limits

- `jev-1.13.0`; the aliases `jev-latest` and `jev-preview` point to it today. Pin the versioned id when thresholds were tuned on it.
- $0.042 per million input tokens; output tokens are free.
- 64K tokens per request; 32K for `state` plus the longest question.
- Rate limits: 100K tokens and 40 requests per second, adjusted without notice while demand is high. A request over a limit gets HTTP 429.
- English is the primary language; other languages work less well.

Source: https://docs.typesafe.ai/models.md

## Data handling

- The service is hosted in the United States.
- TypeSafe doesn't train or fine-tune models on input.
- Customer personal data is kept as long as necessary; there is no fixed period in the Data Processing Agreement.
- Zero data retention is offered to enterprise customers through sales@typesafe.ai.

Sources: https://docs.typesafe.ai/legal.md, https://typesafe.ai/legal/privacy-policy, https://typesafe.ai/legal/data-processing

## Measured by the referee's author, not by TypeSafe

One private codebase, September 2026; leads, not general results.

- Reordering a Choice's options moved one option's probability by up to 0.52 (0.20 on average) across 20 decisions. Asking the same request again moved it by at most 0.01.
- The written order plus its reverse found the same leader as all 24 orders in 20 of 20 decisions; the written order alone in 18 of 20.

## Writing TypeSafe code

To build your own TypeSafe integration, TypeSafe's official Claude Code plugin helps:

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

Source: https://docs.typesafe.ai/agent-skill.md
