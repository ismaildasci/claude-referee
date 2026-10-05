# TypeSafe Jev: facts the referee relies on

Verified: 2026-10-01 against docs.typesafe.ai and typesafe.ai/legal; model jev-1.13.0.

## Questions

- **Noul**: a yes/no question; the answer is the probability of yes.
- **Choice**: one label from a named set of up to 255 options; the answer has the label, a probability per label and a confidence. Add an `other` or `none of the above` option when the list might not cover every input.
- **Score**: a level on an ordered rubric of 2 to 10 descriptions; the answer is an expected score.
- All questions in one request are answered against the same `state`, in parallel. Ask everything about one state in one request.

Source: https://docs.typesafe.ai/primitives.md

## Model, price and limits

- `jev-1.13.0`; the aliases `jev-latest` and `jev-preview` point to it today. Pin the versioned id when thresholds were tuned on it.
- $0.042 per million input tokens; output tokens are free.
- 64K tokens per request; 32K for `state` plus the longest question.
- Rate limits: 100K tokens and 80 requests per second, adjusted without notice while demand is high. A request over a limit gets HTTP 429.
- English is the primary language; other languages work less well.
- Documented errors: 401 (missing or invalid key), 422 (invalid request body), 429 (rate limit), 529 (overloaded).
- Live probe on 2026-09-30 (UTC), not in the docs:
  - The upper limits are enforced with HTTP 400: 11 Score levels ("Must have at most 10 levels") and 256 Choice options ("Must have at most 255 choices").
  - A one-level Score was accepted with 200, although the docs say a Score should have at least two levels.
  - An unknown model name gets a 400 with `Unknown model: <name>`.
  - `state: null` and a `null` Score level get a 422.

Sources: https://docs.typesafe.ai/models.md, https://docs.typesafe.ai/api.md, https://docs.typesafe.ai/primitives/choice.md, https://docs.typesafe.ai/primitives/score.md; the live probe: https://github.com/ismaildasci/claude-referee/blob/main/docs/measurements.md#measured-with-claude-referee-itself

## Data handling

- The service is hosted in the United States.
- TypeSafe doesn't train or fine-tune models on input.
- Customer personal data is kept as long as necessary; there is no fixed period in the Data Processing Agreement.
- Zero data retention is offered to enterprise customers through sales@typesafe.ai.

Sources: https://docs.typesafe.ai/legal.md, https://typesafe.ai/legal/privacy-policy, https://typesafe.ai/legal/data-processing

## Measured by the referee's author, not by TypeSafe

Leads, not general results. The first two come from one private codebase in September 2026.

- Reordering a Choice's options moved one option's probability by up to 0.52 (0.20 on average) across 20 decisions. Asking the same request again moved it by at most 0.01.
- The written order plus its reverse found the same leader as all 24 orders in 20 of 20 decisions; the written order alone in 18 of 20.
- On claude-referee's own public set of 20 decisions (2026-09-30; 19 with a leader at 0.9 or more), reordering moved one option's probability by up to 0.13, and asking the same request again by up to 0.04.

## Writing TypeSafe code

To build your own TypeSafe integration, TypeSafe's official Claude Code plugin helps:

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

Source: https://docs.typesafe.ai/agent-skill.md
