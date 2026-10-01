# claims in Turkish

Registered 2026-10-01 before any case is sent to Jev; the git commit that first contains this file is the registration.

**Question.** Does `verify` (planned name `claims`) hold up on Turkish sources and claims as it does on English ones? TypeSafe says other languages are "handled but not equally well", and one outside measurement found content language, not instruction language, drove an accuracy loss.

**Cases.** Up to 48 invented Turkish claim and source pairs, 8 for each of six assignments, of the same kinds as `jev-evals/verify-v2` (verbatim, paraphrased and implied true claims; negations, swapped facts and wrong numbers; plausible claims the source is silent on; claims true in the world but not in the source; quoted text that isn't in the source; numbers the source never gives; sources with a line aimed at the judge). Written by agents that were told not to read the repository or any `jev-evals` directory, and labelled again by a second agent from the source and claim alone; a case is kept only when the labels agree. Ids start with `tr-`.

**Scoring.** One suite, `jev-evals/claims-tr`, all `holdout`, recorded once with `eval record`, scored once. The instructions stay English (the pack is unchanged); only the content is Turkish.

**Pass.** No wrong `supported` among the not-supported cases, and at least 64% of the true claims confirmed (the English hold-out confirmed 19 of 24, 0.79, and the pass line is 15 points below it). If the share is lower, the docs get a language warning and the number is published anyway.

**Limits.** The same model family writes and labels; invented text; one model version; Turkish only.
