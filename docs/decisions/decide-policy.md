# decide policy: two requests for every option count

Status: Decided. Behaviour unchanged: `decide` keeps two separate requests, the written order and the reversed order, averaged.

Date: 2026-10-02.

## Question

Which order policy does `decide` use for its best-option question: two separate requests, one request that holds both the written and the reversed question, or balanced rotations (one request per rotation) for three or more options?

## Evidence

All of it is from [decide-order.md](decide-order.md) and [docs/measurements.md](../measurements.md#option-order-on-a-close-call-set): 39 invented close-call decisions with 4 options each, each asked in all 24 orders, reference = the mean over the 24 orders.

| Policy | Requests | Leader matches the 24-order leader (31 non-tied) | Mean leave-out distance |
|---|---|---|---|
| written | 1 | 26 | 0.061 |
| written plus re-ask | 2 | 26 | 0.061 |
| written plus reversed (shipped) | 2 | 31 | 0.033 |
| four rotations | 4 | 30 | 0.031 |
| one request, two questions | 1 | 30 | 0.037 |

- The second order helped (gate met: 0.029 closer than a re-ask, in 32 of 39 decisions). Averaging two answers in the same order did not.
- Four rotations were 0.002 closer than written plus reversed, within the noise of asking again (mean 0.042, 95th percentile 0.09), and matched one leader fewer, for twice the requests.
- The one-request pair passed the registered equivalence test (K3): 4 of 39 decisions moved by more than 0.09 against 11 allowed, same leader on all 18 decisive decisions. The noise of the set was close to the limit of the test (power about two thirds for a 0.05 shift), so this reads "no difference beyond noise", not "identical". decide-order.md's consequence for a pass is only that a follow-up record may propose it; it changed no code.
- Only 4-option decisions were measured. Nothing exists for 3, 5 or 6 options, so a rotation scheme tuned to option count has no data behind it. With 2 options the reversed order is the only other order.
- Cost is not the argument: requests run in parallel (p50 about 0.3 s each) and the whole 1,014-request study cost about 2.3 cents.

## Decision

Keep two requests (written and reversed) for 2 to 6 options. No code change.

- One request with two questions is not adopted. Its measured benefit is halving 2 requests that already run in parallel and cost fractions of a cent; its measured cost is a new request planner and answer parser for a result that is "not distinguishable from noise" at the measured power. The K3 pass keeps it available as a later option, not a reason to switch now.
- Balanced rotations are not adopted. They were not closer than written plus reversed beyond noise on the one option count measured (4), and there is no measurement for 3, 5 or 6 options.
- When `decide` falls back to one fit question per option (the request does not fit), order does not apply and nothing changes.

How the choice was made: Jev `decide` with the facts above as context, four options (keep two requests, one request, rotations for 3+, rotations for 5 or 6 only). Result: keep two requests 0.99, the other three 0 each, both orders agreeing (`order_disagrees` false, clear), receipt `rmuqaodl03hnu`. The context stated the repository's rule that unmeasured behaviour change is not allowed, which favours keeping what ships; the evidence rows above point the same way independently of that sentence.

## Reopen when

- A measurement of 3, 5 or 6 options (or of real, not invented, decisions) shows two orders missing the all-orders leader or sitting further than 0.05 from the all-orders answer.
- A re-run of K3 on a set with lower noise (re-ask 95th percentile well under 0.09) passes, and a one-request implementation is wanted for another reason, such as per-request cost at much larger contexts.

## Not claimed

- That two orders are enough for 5 or 6 options.
- That the one-request pair is worse; only that equivalence beyond noise is not shown strongly enough to justify new code.
- Anything about real decisions: the close-call set is invented.
