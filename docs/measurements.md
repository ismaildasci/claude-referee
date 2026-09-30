# What we measured before building this

claude-referee grew out of a private kit that one team used with Claude Code in September 2026. The numbers below come from that kit and shaped this design. They come from one team, one author and one codebase, so read them as leads rather than general results. The raw data can't be published because it contains private code and decisions; each section says how the numbers were taken.

Labels match the rest of the repository: **measured** means a script produced the number; **observed** means it was seen in sessions but no raw record was kept.

## Option order can move Jev's pick

Setup: 20 real decisions with 4 options each, asked in all 24 orders, twice. No request failed. (Measured)

- One option's probability moved by 0.20 on average between orders, and by up to 0.52. In 6 of the 20 decisions the spread was 0.24 or more.
- Position bias was small: 0.02 per slot on average, 0.08 at most. The effect seems to come from how option content interacts with order, which we haven't tested separately.
- The written order alone matched the all-orders leader in 18 of 20 decisions. Written plus reversed matched it in 20 of 20, with 2 requests. Four rotations matched 19 of 20.

The comparison is with the average over all orders, not with a known right answer.

**What changed:** `decide` asks the choice twice, in the written and the reversed order, and averages the two.

## Asking again barely changes the answer

- Repeating the same request moved the average probability by at most 0.01. Fresh re-runs that bypassed the cache moved it by at most 0.02. (Measured)
- Before the change, 4 of 15 `decide` calls were fresh re-runs.

**What changed:** nothing tells Claude to retry. A tie comes back with the leading option and a next step: add the missing fact, or go with the leader if the choice is easy to undo.

## Extra per-option questions: ask them separately, keep them out of the verdict

- Asking every option's extra questions in one request kept the leader in 20 of 20 decisions, but moved those extra scores by up to 0.23, against 0.03 when each option was asked on its own. It also flipped the leaning option of one tie and saved only 7% of input tokens. (Measured)
- Generic extra questions didn't separate options: every option scored 0.3–0.7. Seven project rules added as questions scored 0.7–0.85 for every option and resolved none of the ties. Of 27 calibration decisions, 14 were clear, 5 weak and 8 ties. (Observed)

**What changed:** extra questions are optional, asked once per option, and reported as flags. The verdict comes from the choice question alone.

## Real sessions: small results, large context

Setup: 321 CLI calls counted from session transcripts, 118 of them (37%) in subagent transcripts. (Measured)

- The median result was 76–221 tokens, depending on the command.
- The median context at call time was between 230K and 470K tokens.
- At list prices that's roughly $0.10 of Claude-side cost per call ($33.18 over 321 calls; the prices are assumptions). One `decide` decision cost about $0.0007 on the Jev side.

**What changed:** nothing new. It confirms the rule the design is built on: count Claude's turns, not Jev's requests. The README's cost chart assumes only 50K tokens of context, so real sessions cost several times more per extra turn.

Counting correctly took four rules: count a command only in command position, catch calls made through an absolute path, include subagent transcripts, and deduplicate by tool-use ID. An earlier counter over-counted and missed absolute-path calls.

## Redaction: what patterns catch and what they don't

- Test fixtures: 11 replaced, 10 stopped, 37 kept, 0 failures. (Measured)
- On about 10,400 strings the kit actually sent: 0 stops and 0 replacements. (Measured)
- On 12,166 Bash outputs from 14 days of transcripts: 3 values (0.025%) looked like credentials, and 2,048 values were replaced (UUIDs 1,490, IP addresses 190, emails 178, other identifiers 190). Neither group was reviewed by hand. The slowest output took 14 ms. (Measured)
- A rule that matched variable names like KEY or PASSWORD, without checking the value, flagged type annotations, translation keys, pagination tokens and SSH algorithm names. Checking the assignment form and the value's shape cut stops from 48 to 12, then to 3, on an earlier scan of about 19,500 outputs. (Observed)
- The IP pattern also matched four-part version strings. No pattern can catch sensitive details written as prose, such as a customer's name.

**What changed:** a request with something shaped like a credential isn't sent at all; personal details are replaced; one false positive skips one item instead of stopping a whole batch.

## An evidence check nobody calls doesn't help

- Before the session briefing pointed to it, the `done` command ran once in 14 days. (Measured)
- The briefing's own wording mattered: one sentence claimed a tool was blocked when it wasn't, and a one-line heredoc example failed when copied. Both were fixed. (Observed)

**What changed:** the done-gate (v0.2) runs when Claude stops, instead of waiting to be called. Every command example in the briefing runs in the tests.

## Not measured yet

- Whether claude-referee lowers the total cost of a task. The v0.2 A/B will be pre-registered in `bench/PREREG.md` before its first run.
- How the done-gate performs on held-out cases. The `done` threshold was chosen on the same 25 cases it was scored on, so its 24 of 25 is in-sample. At least 40 new labelled cases are needed.
- Whether flipping the order inside a single request can replace the second request.
