# Dropped and postponed

One line each, decided 2026-10-01 together with the 0.1.x to 1.0 plan. Numbers from other people's projects are theirs, linked, and were not reproduced here.

| Item | Why | Source |
|---|---|---|
| Model and effort routing | An outside A/B (3 runs per arm, one task type) found a Jev router 61% more expensive than a fixed Opus model; the area is crowded | [lucadidomenico/jev-router-esperimento](https://github.com/lucadidomenico/jev-router-esperimento) |
| Output pruning, compaction | Another outside study found that cheap search did not lower the total cost of the whole task | [dzhng/jevgrep](https://github.com/dzhng/jevgrep/blob/main/evals/results/combined-cost-research-2026-09-28.md) |
| A file briefing on the first prompt, skill suggestions | Crowded, and only loosely tied to checking claims against evidence; code excerpts would also leave the machine | none |
| A risk gate for Bash commands | Many tools already do it, and Claude Code's auto mode has its own classifier | none |
| A model-switch cache guard | Claude Code already asks before a `/model` switch while the cache is warm (since 2.1.108), and a `PreModelSwitch` hook that times out blocks the switch | [Claude Code docs: prompt caching](https://code.claude.com/docs/en/prompt-caching) |
| An MCP server | Postponed to after 1.0; the product is a CLI and hooks | none |
| PR review | An outside evaluation on 983 PRs found no better than a constant guess (AUROC 0.57 and 0.62) | [luc-pimentel/system-one-code-review](https://github.com/luc-pimentel/system-one-code-review/blob/main/reports/jev-swrbench.md) |
| Test selection | Kept as a low-priority experiment; it is never used as evidence for `done` | none |
| `--engine v1`, migration from the earlier private kit | v1 never existed in this repository, and the kit's data directory is not ours | none |
