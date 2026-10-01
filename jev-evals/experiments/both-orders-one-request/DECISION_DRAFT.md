# Both option orders in one request: pre-registration (draft decision record)

Status: Pre-registered in the scratchpad before any fresh request; results in REPORT.md. Draft text for a future `docs/decisions/decide-one-request.md`; nothing in the repo is changed.

## Question

`decide` asks `decide.best` twice, as two separate requests: the written order (id `written`) and the reversed order (id `reversed`), run in parallel by the Session (default concurrency 6). K3 in `decide-order.md` passed for the `same_request_pair` policy (one request, two question keys `best_written` and `best_reversed`, state sent once). Can `decide` send both orders in one request instead, without changing what it answers?

## Design

- Set: the 39 close decisions of `jev-evals/decide-close/cases.jsonl` (same set as the registered run; this is a replication with fresh draws, not a new hold-out; the pair and two-request data of `order-2026-10-01.json` have been seen and are used only as arm E below).
- Question format: the CLI's own, verified with `decide --dry-run`: state `{decision, context}`; questions `{best: {...decide.best from the generic pack, criteria: {name: text, ...in the asked order}}}`; model `jev-1.13.0`. The one-request variant sends state once and two keys, `best_written` (written order) and `best_reversed` (reversed order), exactly as in the registered run. The variant lives in the experiment script only.
- No tuning: every threshold below is fixed here. No dev/hold-out split exists for this pilot because nothing is tuned; everything is scored once.
- Arms (per decision; "mean" = mean of the written and reversed probability vectors, as `decide` computes it):
  - E: existing two-request answers from the 24-order run (the draws whose order is the written / the reversed order), one draw each.
  - T1, T2: fresh two-request path, rounds 1 and 2: two separate requests (`best` question each) sent in parallel, as the CLI does.
  - P1, P2, P3: fresh one-request variant, rounds 1 to 3.
  - CLI: one fresh end-to-end `node plugins/evidence-referee/dist/cli.mjs decide --fresh --data-dir <scratch>` run per decision (validates that the T arm of the script is what the CLI does).
- Order of work: decisions run one at a time (concurrency 1 across decisions) so latency is not confounded by rate limits. Within a round, the arm run first alternates by decision index (round 1: pair first on even index, two-request first on odd; round 2 reversed). Round 3 is pair only. Planned requests: 117 + 117 + 39 + 78 = 351; hard stop at 550 including retries.
- Probabilities are the API's own (two decimals). All numbers are produced by `analyze.mjs`, never by eye. All comparisons use unrounded values.

## Metrics and fail conditions

Definitions. delta(X, Y) per decision = max over options of |mean_X - mean_Y|. Noise N = nearest-rank 95th percentile over the 39 decisions of delta(T1, T2). Threshold T = max(0.04, N). Decisive decision = existing 24-order margin (from `order-2026-10-01.json`) at least 0.08 AND the margins of the P1 mean and the T1 mean both at least max(0.08, 2N). Leader = argmax of the mean. Verdict = the `decide` rule (clear: p1 >= 0.85, margin >= 0.1, no leader disagreement between the two orders; weak: margin >= 0.1, no disagreement; else tie).

Noise gate: if N > 0.10 the result is "inconclusive (noise)"; two requests stay.

Validity conditions (any FAIL means two requests stay; FAIL means "equivalence not shown", not "worse"):

- A1 leader: on decisive decisions, leader(P1) == leader(T1) in every one. If fewer than 15 decisions are decisive, A1 is "not assessable" and the others decide.
- A2 leader, all 39: agreement count of leader(P1) with leader(T1) must be at least the agreement count of leader(T1) with leader(T2) minus 3.
- B1 p shift: the number of decisions with delta(P1, T1) > T must be at most 11 (the c(39) of the K3 record, borrowed, not re-calibrated).
- B2 mean p shift: mean delta(P1, T1) must not exceed mean delta(T1, T2) by more than 0.02.
- C1 bias: with L = the 24-order leader, mean over decisions of (mean of P1..P3 mean)[L] - (mean of E, T1, T2 mean)[L]; |that| must be at most 0.03.
- C2 anchoring (the second question copying the first): per answer pair, gap = max over options of |written - reversed|. The mean gap of the pair arm (P1..P3) must not be smaller than the mean gap of the two-request arms (E, T1, T2) by more than 0.03; and the rate of "orders pick different leaders" per draw in the pair arm must not be lower than in the two-request arms by more than 0.10.
- D verdict: verdict agreement of P1 with T1 must be at least the agreement of T1 with T2 minus 4; and the number of decisions where P1 is `clear` but none of E, T1, T2 is `clear` must be at most 2.
- G integrity: every one-request answer has both keys, both of type choice, probabilities over exactly the option names; failures must be 0.
- V script validity: delta(CLI mean, T1) > T in at most 11 decisions. If it fails, the script's two-request arm is not representative of the CLI and that is reported; the verdict above is then read with that caveat.

Benefit conditions (reported separately; they do not change validity):

- Tokens: input tokens summed over rounds 1 and 2 for the pair arm versus the two-request arm. The one-request path is worth it only if the saving is at least 25%.
- Latency: per decision and round, wall time of the pair request versus the wall time of the two parallel requests (the slower one). A latency claim is allowed only if the pair is faster in at least 60% of the 78 paired observations and the median saving is at least 150 ms. If the median pair wall time exceeds 1.25 times the two-request median, a latency regression is reported.
- Requests: 1 instead of 2 per decision (by construction; not a measurement).

Consequences: all validity conditions pass (or not assessable) and tokens benefit met: a decision record may propose the code change with a PASS-with-limits wording. Validity passes but benefit not met: no change recommended. Any validity FAIL or noise gate: `decide` keeps two requests.

## Not claimed

That the all-orders mean is ground truth; anything about non-close decisions, other questions, other models or other option counts; that PASS means identical; that FAIL means the one-request path is worse; any dollar claim beyond the measured input tokens at the published price.

## Limits (known before the run)

- Invented cases written by a model; one model version; one question; 4 options.
- 13 of 39 cases come from 5 source decisions; independence is optimistic.
- The pair always puts the written question first and the reversed second; position within the request is not varied, so a first/second effect would be confounded with order. C2 partly guards this.
- Probabilities are rounded to two decimals by the API.
- B1's cutoff is borrowed from a different calibration; T1-vs-T2 and P1-vs-T1 have the same noise structure only if there is no effect.
- The redaction layer of the CLI is not part of the script's arms (invented public text, `replaced: 0` expected).

## Deviations (before the first fresh request)

- `run.mjs` retry loop was fixed (a recursive retry could ignore the 5-attempt bound) and one counted warm-up request (written order of the first case, excluded from analysis) was added so connection setup does not land on the first pair observation. Both are mechanics, not criteria. The analysis script and every threshold are unchanged; sha256 values in `PREREG.sha256` (second block) were taken before the first request.
- Before registering the final hash, `analyze.mjs` was smoke-tested on the existing (already seen) data of `order-2026-10-01.json` (arm E as the two-request arms, its stored pair as the pair arm). That showed the pair arm flagging order disagreement in 7 of 39 decisions against 12 of 39 for the separate requests, which is the C2 rate component failing on seen data. No threshold was changed after seeing it.
- Verdict thresholds checked in `plugins/evidence-referee/packs/generic/thresholds.json`: decide.best clear 0.85, margin 0.1, the values used.
