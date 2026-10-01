# Experiments of 2026-10-01

Four measurements run with the built CLI against `jev-1.13.0`, each pre-registered in its own folder before the first live request (`PREREG.md` or `DECISION_DRAFT.md`), scored by the scripts next to it and reviewed by a separate skeptical pass that recomputed the numbers. They are kept as run: scripts mention `<scratchpad>` and `<repo>` where the original absolute paths were, so they are a record, not a runnable suite. Cases are invented. The Jev key is never stored. About 1,000 requests in all (a few cents).

| Folder | Question | Result |
|---|---|---|
| `both-orders-one-request` | Can `decide` send both option orders in one request? Pilot on the 39 close-call decisions. | Leaders within re-ask noise (4 vs 3 of 39 differ), 33% fewer input tokens, no latency gain (median 12 ms), no `clear` verdict in any arm. Not adopted: about $0.000015 saved per decision. |
| `p-floor-near-bands` | Does flooring p to two decimals change a verdict, and how big is re-ask noise? | 0 verdict changes at any pack threshold over 370 recorded answers. Re-ask noise on near-band cases is 0.03 to 0.10, not 0.01. The floor stays. Separate finding: a margin or `1 - band` exactly on a band was moved by float arithmetic (fixed). |
| `done-v2-met-misses` | Why does `done` v2 still miss 3 true `met` cases? | One was a parser bug (a PHPUnit `Tests:` line read as jest; fixed). Two are question and evidence side; a note change recovered both on dev and hold-out but was chosen after reading hold-out, so it was not adopted. |
| `risky-and-env-evals` | Do `line.risky` and `failure.env` produce wrong positives at 0.9? | None in 62 cases each; coverage 52% and 81% on hold-out. The cases became the `judge-risky` and `judge-env` suites. A Choice form of `line.risky` raised coverage to about 92% in this experiment; it would need `judge` to accept Choice questions and is not built. |

Caveats the reviews raised and the reports state:

- `both-orders-one-request`: `analyze.mjs` hashes to a different value than the one in `PREREG.sha256`; its output was re-run and equals `results.json`, and an independent script gives the same numbers, but "the analysis script did not change" is not proven. The false-`clear` check cannot fail on this set (the largest leader probability was 0.735), and registration order rests on file times only.
- `p-floor-near-bands`: the near-band cases were picked from recorded data, so the noise figure applies to uncertain cases, not to confident ones.
- `done-v2-met-misses`: hold-out was read before the note text was chosen, so its hold-out run is a regression check, not an unbiased estimate.
- `risky-and-env-evals`: one session wrote and labelled the cases; the 5 cases at exactly p = 0.10 followed the CLI's `1 - 0.9` rule at the time, which is why coverage numbers there are slightly lower than under a literal 0.1.
