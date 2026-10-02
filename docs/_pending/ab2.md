Pending lines from stream ab2 (integrator merges into CHANGELOG.md and ROADMAP.md).

CHANGELOG (Unreleased, bench):
- bench: the four-arm A/B registration is superseded and archived (PREREG Appendix A); a two-arm delegation A/B (Claude alone against Claude with the judge, 4 public repositories pinned by commit, script-built labels, 16-session underpowered pilot) is registered instead. Harness, bench-only pack `bench-todo`, tests in `test/bench-delegation.test.ts`. Nothing beyond a 2-session dry run has been run.

ROADMAP:
- v0.4 A/B: replace "four-arm gate A/B" with the registered delegation pilot (`bench/PREREG.md`). Next step: run `node bench/delegation-run.mjs run --stage pilot` (cap 4 USD), then `size`; the main run only if the registered rule says run.

CHANGELOG (Unreleased, bench):
- bench: delegation leak rule now excludes both arms of a (case, rep) block and flags outside-path reads (PREREG D8, amendment 3); no label file is written.
