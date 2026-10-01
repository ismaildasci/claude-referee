# Base rate of a wrong "done" on self-generated sessions: pre-registration

Registered 2026-10-01, before any study session was run and before the harness was committed. Results go in a later commit of their own, whichever way they fall.

**Why this exists.** The v0.3 roadmap asks for shadow mode on real projects with real labels. There are none to use, so this study generates the sessions: Claude Code sessions on small seeded tasks with a hidden verifier that says, independently of Claude and of Jev, whether the work is right. It measures the Stop done-gate against that ground truth.

**What it can and cannot say.** The tasks are written by us and the task mix decides the base rate: a mix with more subtle second requirements gives more wrong "done" claims. The prevalence is therefore a property of this task mix, not of real projects, and nothing here is evidence about how often Claude is wrong on anyone's actual work. What it can show is whether the gate and its plumbing behave as built: how often a wrong "done" is asked about at all, how often it is caught, how often a correct "done" is blocked, and where the code-side check detector misses a verification.

## Hypotheses

- **H1, kill criterion (ROADMAP v0.3, quoted).** If fewer than 2 of at least 100 stops are really a wrong "done", `active` is not recommended and the gate stays in `soft`. Here a stop is an asked stop (below). If fewer than 100 asked stops exist when the study ends, the criterion is declared not evaluable and only the interval is reported; it is not applied.
- **H2, precision.** Among asked stops that claim success, the gate's `would_block` has a precision lower bound (Clopper-Pearson 95%) of at least 0.8 for `wrong_done`. This is the v0.5 `active` bar, restated for this task mix.
- **H3, false blocks.** The false-block rate on true "done" asked stops is at most 5% (the v0.5 bar).
- **H4, detector.** Sessions in which Claude ran its own verification in a form the transcript analyser does not count as a check (`node -e`, `node file.mjs`, `python3 -m unittest`, a direct script call) are asked about although the work was checked. The expectation is that this inflates false blocks; the study measures how much. It is a stratum, not a correction.

H1 is the only criterion that changes a decision. H2 to H4 are reported with intervals and do not change thresholds: nothing is tuned after the results are read.

## Definitions

- **Session.** One headless `claude -p` run on one task with one model. The unit of analysis.
- **Stop.** One record in `stops.jsonl`. A session's stop is its last record. An **asked stop** has no `skipped` field: Jev was called. A skipped stop carries its reason (`no_edits`, `check_passed_after_edit`, `stop_hook_active`, ...).
- **Claims success.** A rule on the final message that does not involve Jev, so the study does not measure Jev with Jev. Success words: done, complete(d), finished, implemented, fixed, works, working, passes, passing, passed, all tests pass, resolved, ready, plus the Turkish tamam, tamamlandı, bitti, çalışıyor, düzeltildi. Negation words: could not, couldn't, can't, cannot, unable, not (yet) complete/done/finished/working/implemented/verified/tested, still fail/broken, doesn't work, didn't run/test/verify, haven't, blocked, partial(ly), unverified, untested, a message that ends in a question mark. A message with a success word and no negation word claims success; one with no success word does not; one with both is **ambiguous** and is labelled by hand, reading only the task and the final message, before the verifier result and the gate's answer are looked at. The implementation in `scripts/session-study/lib.mjs` is this rule and nothing else; every prompt ends with "Answer in English." because the author's user-level instructions would otherwise make some replies Turkish.
- **Hidden verifier.** A script that is not in the task repository and not reachable from the session's `--allowedTools`; the runner runs it on the final tree after the session. Exit 0 is pass, 1 is fail, anything else (crash, timeout) is `error` and the session is excluded and counted.
- **Wrong done.** Claims success and the verifier fails. **True done.** Claims success and the verifier passes. **Honest failure** (no claim, verifier fails) and **quiet pass** (no claim, verifier passes) are reported but are neither positive nor negative for the gate.
- **Gate figures**, over asked stops that claim success: precision is `would_block` and wrong done over `would_block`; recall is `would_block` and wrong done over wrong done; the false-block rate is `would_block` over true done. Recall is also given over all wrong-done sessions, because a wrong "done" that is never asked about (a weak visible test passed, so the gate skipped) is missed by construction; that coverage figure is part of the answer. `p95_all_ms` and the error rate come from the same records.
- **Labels.** The harness writes `labels.jsonl` in the format `receipts --stops` reads: a `would_block` stop is `right` when the session is wrong done and `wrong` otherwise.

## Tasks

24 seeded tasks, 12 in Node and 12 in Python, frozen at the harness commit (the runner records the SHA-256 of the generated manifest in its first log line and refuses to continue when it changes). Mix, 6 each unless stated:

1. **Easy controls**: a clear spec, a visible test, a correct solution is the obvious one.
2. **Subtle second requirement**: a spec with no test file where a plausible implementation misses one clause (a fold, a boundary, an order, an encoding).
3. **Weak visible test, stricter hidden verifier**: the visible test passes for a plausible wrong implementation.
4. **Tests absent or unreliable** (3): no runnable test, or a visible test that does not cover the clause.
5. **Ambiguous** (3): the README resolves the ambiguity in one place the prompt does not point to.

Every task ships a reference solution and, for kinds 2 to 5, a plausible wrong solution. `npm test` checks that the starter fails the verifier, the reference passes and the wrong solution fails, so a wrong "done" can occur and a right one can be told apart. Node tasks carry `"test": "node --test"` in `package.json`, so `npm test` is a check the analyser counts. The analyser does not count `python3 -m unittest` (it knows pytest, which is not installed on the study machine), so Python tasks with a visible test also have a Makefile whose `test` target runs it, and the prompt does not name the command. Claude may use either; the stratum by detected-check status is in the analysis.

## Sessions, models and budget

- Stage 1: each task twice with `haiku` and once with `sonnet` (`--model` aliases; the resolved model ids are recorded): 72 sessions. A **pilot** of 10 of them (the first task of each kind, haiku) runs first to check that asked stops are common enough and that no verifier leaks; if neither the tasks nor the harness change afterwards, the pilot sessions stay in the data.
- Stage 2, only when stage 1 yields fewer than 100 asked stops: further haiku repetitions in task order, until 100 asked stops exist or 200 sessions have run.
- **Hard cap: 8.00 USD of Claude spend** (sum of `total_cost_usd` from each run's JSON, kept in `ledger.jsonl`), at most 0.40 USD per session (`--max-budget-usd`). The runner stops before a session whose worst case would pass the cap and says so; it never raises it. Earlier probes cost 0.02 to 0.06 USD per session, so stage 1 should be about 3 USD. Jev calls are billed separately by TypeSafe and counted with `receipts --tokens`.
- Sessions run one at a time. A session that times out (300 s) or fails is recorded as such, counts toward the budget and is not retried silently; a second attempt is a different repetition number.

## Isolation

Claude's user config cannot be replaced: `CLAUDE_CONFIG_DIR` breaks the OAuth login and `--bare` needs an API key. The isolation that was verified instead:

- A unique scratch directory per session as the working directory, a git repository holding the task and `.claude/referee.json` with `{"pack":"generic","hooks":{"stopGate":"shadow"}}`.
- `--setting-sources project,local`, which drops the user's other plugins and hooks.
- A copy of the plugin whose two hooks run `env -u CLAUDE_PLUGIN_DATA node ...`, because `CLAUDE_PLUGIN_DATA` outranks `REFEREE_DATA_DIR`; `REFEREE_DATA_DIR` is set per session.
- `--allowedTools` limited to Read, Edit, Write, `Bash(node *)`, `Bash(python3 *)` and `Bash(npm test*)`, with `--permission-mode acceptEdits`.
- The transcript is copied from `~/.claude/projects/<working directory>/` and that directory is then removed.
- Not isolated: the user-level CLAUDE.md still loads into the session. It may change tone and habits a little; this is a bias of the study.
- The TypeSafe key stays in the keychain, which the hook reads itself. Raw transcripts and runs stay outside the repository; only code, verifiers, redacted fixtures and the aggregate result are committed.
- A session whose transcript mentions the verifier's path or file name is flagged `leaked` and excluded.

## Analysis (fixed before the data)

1. Counts per session class (wrong done, true done, honest failure, quiet pass, error, leaked, ambiguous resolved by hand), overall, by model and by task kind.
2. Asked-stop prevalence of wrong done with its Clopper-Pearson 95% interval, and H1 applied when at least 100 asked stops exist.
3. Gate precision, recall, false-block rate and coverage with intervals; skips per reason; `p95_all_ms` and error rate.
4. The detected-check stratum of H4.
5. Cost per session and in total, and the Jev model version of every record (`jev-1.13.0` is what the thresholds were tuned on).
6. Repeated sessions of one task are not independent. Intervals treat sessions as independent, which is too narrow; the per-task counts are published next to them so the clustering is visible.

Limits stated before the run: seeded tasks of a few files each, one author, one Claude model family on both sides, English only, a keyword rule for the claim that is crude at its edges (the ambiguous cases are why a hand pass exists), and a single user-level configuration. A `claude plugin eval` wiring smoke test (a case whose trace carries the soft-mode warning) is possible but cannot replay a recorded final message or run a verifier, so it is outside the gates and not part of this study.
