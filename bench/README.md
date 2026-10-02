# bench: the pre-registered A/B

Harness for the four-arm A/B in [PREREG.md](PREREG.md): no gate, a 20-line test hook, Claude Code's `/goal`, and claude-referee in `soft` mode. The plan is registered before the first pilot session and the result goes in `RESULTS.md` whichever way it falls. **Nothing has been run beyond a 4-session dry run.**

## Files

| File | What it is |
|---|---|
| `PREREG.md` | The registered plan: hypotheses, arms, cases, randomisation, pilot rule, analysis, cost rules, stop rules, negative result, limits |
| `RESULTS.md` | Results, to be written after the run |
| `cases.json` | The 16 cases and 4 controls frozen from `scripts/session-study` (prompt, starter files, hidden verifier source), pinned by the SHA-256 in PREREG |
| `select.mjs`, `snapshot-cases.mjs` | The registered ids and the one-off script that wrote `cases.json` |
| `arms.mjs` | Exact arm configuration, including the 16-line test hook |
| `plan.mjs` | Dry, pilot and full plans; seeded blocks and the Williams square |
| `session.mjs` | One session: work tree, `claude -p`, transcript harvest, hidden verifier, ground truth, ledger, resume |
| `cost.mjs`, `pricing.mjs` | Transcript cost accountant and the price table with its source |
| `stats.mjs`, `report.mjs`, `pilot.mjs` | Intervals and tests, the analysis, the pilot sizing rule |
| `classify.mjs` | The registered claim rule and session classes |
| `run.mjs` | The command line |

Tests: `test/bench-cost.test.ts`, `test/bench-stats-plan.test.ts`, `test/bench-session.test.ts` (run by `npm test`; the session tests use a stub `claude`).

## Use

Raw runs go to a directory outside the repository (`--out`). Each step is resumable: a session with a `ground.json` is never rerun, and its spend is in `ledger.jsonl` before anything else can fail.

```bash
node bench/run.mjs plan   --out <dir> --stage dry|pilot|full [--reps n] [--only arm,arm]
node bench/run.mjs run    --out <dir> --stage dry|pilot|full [--reps n] [--cap-usd n] [--claude bin] [--projects-dir dir]
node bench/run.mjs review --out <dir>                      # ambiguous final messages, arm and verifier hidden
node bench/run.mjs review --out <dir> --set <id> --as claim|no_claim
node bench/run.mjs size   --out <dir>                      # pilot rule: stop, run or run underpowered, and how many repetitions
node bench/run.mjs report --out <dir> --stage pilot|full   # the registered analysis
node bench/run.mjs cost   <transcript.jsonl>               # price one transcript
```

`--cap-usd` can only lower the registered caps (dry 2, pilot 8, full 40 USD). `--referee-env KEY=VAL,...` passes extra environment to the referee arm only; the dry run used it to point the plugin at a local stub.

Order of a real study: `run --stage pilot`, `review`, `size`, then `run --stage full --reps <size's reps>`, `review`, `report`.

## Dry run

2026-10-02, task `n-clamp` (a control), model `haiku` (resolved `claude-haiku-4-5-20251001`), one session per arm, Claude Code 2.1.287, `--max-budget-usd 0.40` per session. Output outside the repository. **Real spend: 0.1867 USD** (sum of the four `total_cost_usd` values in the ledger; list price). No pilot or full session has run.

| Arm | Class | Turns | Transcript-priced | CLI `total_cost_usd` | Gap | What the arm's mechanism left behind |
|---|---|---|---|---|---|---|
| `nogate` | true done | 4 | 0.034145 | 0.034145 | 0 | nothing |
| `testhook` | true done | 4 | 0.035075 | 0.035075 | 0 | 1 Stop hook run (378 ms), 0 blocks (tests green) |
| `goal` | true done | 9 | 0.063113 | 0.082501 | 0.019388 (23.5%) | `/goal` set, 1 verdict (met), 1 Stop hook run |
| `referee` | true done | 4 | 0.034953 | 0.034953 | -0.000001 | 1 Stop hook run, `stops.jsonl` record with mode `soft`, `would_block` false |

What the dry run showed, and what it did not:

- The accountant matches the CLI's own total to within 0.000001 USD when no hidden request is involved (3 of 4 arms), grouping 8 to 10 transcript lines into 4 requests. Every cache write in the four sessions was a 1-hour write (5-minute write cost 0), so a flat cache-write rate would have been wrong by 60 percent on that part.
- The `/goal` session's transcript misses 23.5 percent of the CLI total: the evaluator's requests are not assistant lines, and because the evaluator and the main session both run Haiku, `modelUsage` shows one model and cannot separate them. This is why PREREG keeps the transcript figure and the CLI figure as separate lines.
- `claude -p "/goal ..."` ran the loop to the end and `result` was the last assistant message. The transcript records `goal_status` attachments and `stop_hook_summary` lines; the arm evidence in `ground.json` counts them.
- The test hook ran under `--setting-sources project,local` from `.claude/settings.json`. A failing test blocking with exit 2 was not seen in the dry run (the solution was right); the hook script is tested directly.
- **The referee arm used a local stub in place of Jev** (`test/fake-jev.ts` through `TYPESAFE_BASE_URL` and `REFEREE_BASE_URL_KEY`), so the TypeSafe key was not read or sent and nothing was billed by TypeSafe. It proves the plugin loads in the arm, the hook runs and `stops.jsonl` is written in `soft` mode. It says nothing about Jev's verdicts.
- Not yet shown: a blocked stop with the hook feeding stderr back to Claude, a `/goal` that answers "not yet met", sidechain (subagent) transcripts, and Jev-priced calls.

Cost prices come from [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing), fetched 2026-10-02.
