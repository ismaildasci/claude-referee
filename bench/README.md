# bench: the pre-registered A/B

The registered A/B in [PREREG.md](PREREG.md) is a two-arm **delegation** study: when a task applies one rule to many items, does Claude spend less if it hands the per-item judgement to claude-referee's judge (`delegate`) than if it reads and judges every item itself (`alone`), at no lower accuracy. It runs on four public repositories pinned by commit SHA, with labels built by a script (no human review), as an explicit **pilot** of 16 sessions that is underpowered for any cost claim. The plan is registered before the first pilot session and the result goes in `RESULTS.md` whichever way it falls. **The pilot has not run; only a 2-session dry run of the new design (section "Dry run, delegation") and the 4-session dry run of the old design exist.**

The earlier four-arm registration (no gate, a 20-line test hook, `/goal`, claude-referee in `soft` mode) is superseded and archived as Appendix A of PREREG.md: the Stop gate does not separate a right "done" from a wrong one, so that design would have measured the cost of blocking everything. Its harness files are kept and still run.

## Files (delegation study)

| File | What it is |
|---|---|
| `PREREG.md` | The registered plan (top), the amendments, and the archived four-arm registration (Appendix A) |
| `cases-delegation.json` | The 4 cases: repository, commit, path pattern, strata caps, counts and the label hash; no item texts |
| `snapshot-delegation.mjs`, `delegation-items.mjs` | The one-off that wrote the file, and the fetch, extraction and label rule |
| `pack/bench-todo` | A data-only pack with the one question `todo.tracked`, copied into the delegate arm's plugin copy |
| `arms.mjs` | `DELEGATION_ARMS` (`alone`, `delegate`: files, prompt text) next to the archived `ARMS` |
| `delegation-session.mjs`, `delegation-run.mjs` | One session (work tree, `claude -p`, transcript, receipts, scoring) and the command line |

## Dry run, delegation

2026-10-02, case `d-pytest` (30 items, 4 tracked), model `haiku`, one session per arm, `--max-budget-usd 0.40`, the real judge (`jev-1.13.0`, the maintainer's key from the keychain, reachable from the `claude -p` subprocess). Output outside the repository. **Real spend: 0.0831 USD for Claude** (sum of the two `total_cost_usd` values in the ledger, list price) **and 0.00054 USD for Jev** (receipts). This is a harness check, not data, and one session per arm says nothing about either hypothesis.

| Arm | Turns | Wall | Claude USD (transcript = CLI) | Jev USD | Claude tokens | Found (tp/fp/fn) | Tool calls |
|---|---|---|---|---|---|---|---|
| `alone` | 3 | 23.0 s | 0.040831 | 0 | 74,761 | 4/0/0 | Read 1, Write 1 |
| `delegate` | 6 | 20.5 s | 0.042284 | 0.00054 (28 requests, 12,852 input tokens) | 100,658 | 4/0/0 | Read 1, Write 1, Bash 3 |

- The pipeline ran end to end: items and labels rebuilt from the pinned commit and checked against the file hash, plugin copy with the `bench-todo` pack, `findings.json` scored, transcript priced by request id (all cache writes were 1-hour writes, so the split mattered), Jev cost read from the session's receipts, transcript and CLI totals agreed to 0.000001 USD.
- The delegate session called the judge on both chunks (2 calls): 4 yes, 25 no, 1 review, 0 unanswered, 0 stopped; the review item was not counted as found, and recall was still 4 of 4. The `alone` session read the file and wrote the answer without a script.
- On this single case delegation was not cheaper (combined ratio 1.049, Claude tokens ratio 1.346: the delegate arm adds turns and tool results to a 30-item file that Claude reads in one `Read`). One session each carries no interval; it is a reason the pilot's stop rule (combined ratio of 1.00 or more) is a real possibility, not a result.

## Files (archived four-arm study)

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

## Use (archived four-arm study)

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
| `testhook` | true done | 4 | 0.035075 | 0.035075 | 0 | 1 Stop hook run (378 ms), 0 blocks (tests green; a block is a summary with hookErrors or preventedContinuation) |
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
