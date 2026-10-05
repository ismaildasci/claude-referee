CHANGELOG [Unreleased] / Added:

- Stop gate state study (`docs/decisions/stop-state-design.md`, `docs/measurements-stop-state.md`, harness `scripts/stop-state/`, recorded answers `jev-evals/stop-state/`): giving Jev the edit contents and a question about the task's requirements separates wrong from true dones (hold-out AUC 0.867, task-clustered interval 0.748 to 0.959, against 0.553 for the current gate state), but at the threshold frozen on dev recall is 6 of 9 (bar 0.8) and the hard-task-only AUC is 0.643, so the registered adoption rule fails on recall: separates, but not usefully. 2 674 Jev requests, about 0.11 USD. Nothing shipped changes; the experimental questions are in a pack that is not shipped.

ROADMAP, table of the status section (after the "Stop gate on hard tasks" row):

| Stop gate state design (edit contents and a requirements question) | measured, adoption rule failed | hold-out 95 sessions, 9 wrong dones: AUC 0.867 (0.748 to 0.959) against 0.553 for the current state, recall 6 of 9 at the dev threshold (bar 0.8), hard-only AUC 0.643 ([result](docs/measurements-stop-state.md)) |

ROADMAP, v0.3 bullet list (after the base-rate study bullet):

- **State design study.** The gate's state carries no change content, so Jev cannot tell a wrong done from a true one (`claims_verified` AUC 0.3 to 0.4 in every variant that keeps the existing questions, even with edit contents, parsed check output and the README added). A new question about the task's requirements, with edit contents capped at 2 000 characters, separates them on a task-split hold-out (AUC 0.867) but misses 3 of 9 wrong dones at the dev threshold and is weaker within hard tasks (0.643); registered in [stop-state-design.md](docs/decisions/stop-state-design.md). Not built: sending edit contents to TypeSafe would be a privacy change and would have to be opt-in. Open: more wrong dones per task type to narrow the intervals.
