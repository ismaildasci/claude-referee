# A positive marker for `cargo build` and `cargo check`

2026-10-05. The largest miss among parsed expected-`met` real-log cases was `cargo build` (6 cases, 3 in the dev half): the parser counted warnings and errors but gave Jev no completion marker, so Jev saw an exit code and answered `missing`. Designed from the three dev logs (`rl-eb1fb33d`, `rl-d7a72aa4`, `rl-548710af`) and cargo's own source; the frozen hold-out half was not read for the design.

## Source of the format

cargo `src/compiler/job_queue/mod.rs` prints the status `Finished` only on the branch where the job queue is empty and `errors.to_error()` is `None`, as `` `{profile}` profile [{opt_type}] target(s) in {time} `` (older cargo: `Finished dev [unoptimized + debuginfo] target(s) in ...`); `src/compiler/mod.rs` builds `could not compile {name} due to N previous errors; M warnings emitted`; a failing job prints `warning: build failed, waiting for other jobs to finish...` (<https://github.com/rust-lang/cargo>, files fetched 2026-10-05). Status words are right-aligned to 12 columns, so after ANSI stripping the line starts with exactly four spaces.

## Rule

`cargo build` / `cargo check` facts carry `summary_line` = the `Finished` line (the positive marker) only when all of these hold; otherwise `incomplete: true` (no error) and `done` caps `met` at `unsure`:

- the last `Finished` line matches the strict shape (four spaces, a profile name with `` ` `` or none, `[...]`, `target(s) in <time>`; custom profile names with `-` or `.` are accepted);
- no `error:`/`error[E....]`/`could not compile`/failed build script anywhere (these count as errors; a Finished line after an error does not help);
- nothing but blank lines, `warning:`/`note:`/`help:` lines and exit-code lines follows the last `Finished` line (cargo prints a future-incompat notice there; test or script output after the build is not the build);
- the command echo is not chained (`&&`, `;`, `|`): a build followed by other work, or piped through `tee`, is `incomplete` (known recall cost, not measured on dev logs).

Warnings are counted exactly as before (`generated N warnings` lines, `warning:` headers; the larger wins); `done` already caps `met` on a lint or clean criterion with parsed warnings and does not on "the build succeeds"; nothing was loosened.

Not claimed (stay with their own parser or the exit line): any log with `Executable `, `Doc-tests`, `Running unittests`/`benches`/`tests/` or a `running N tests` line; an echo of `cargo test|t|bench|nextest|llvm-cov|tarpaulin|miri`; nextest and clippy logs (as before).

## A second change: the clippy mark

`CLIPPY_MARK` matched `clippy::` anywhere, so a verbose `cargo build` or `cargo test` (rustc invocations carry `--warn=clippy::...` lint flags from `[lints]`) was claimed by the clippy parser. Both dev logs of that shape (`rl-eb1fb33d`, `rl-565048a3`) were wrongly claimed. Lint-level flags (`--warn|allow|deny|forbid|force-warn=clippy::x`, `-W|A|D|F clippy::x`) are now removed before the mark is tested; `cargo clippy` and `clippy::` in diagnostics (`#[warn(clippy::x)]`) still mark clippy. Dev evidence: 2 logs, both false claims; no real clippy log exists in the dev half, so no clippy parser change beyond this.

## Not done, and why

- `clippy` parser: the dev half has no real clippy log (the two clippy-labelled rows were `cargo build` and `cargo test` logs); fewer than 3 real examples, so no new clippy parser.
- `cmake build`: the dev expected-`met` cmake logs are cut by 300 to 540 KB, so the clip (first 2,000 and last 12,000 characters) drops the status lines (`rl-c87b1e72` is already ninja-claimed and `incomplete`; `rl-0e95a217` has no recognised shape). A property of the clip, not a parser gap; no parser from fewer than 3 examples.

## Receipts and replay

Replayed over every recorded suite and the dev half before recording: changed facts for 3 synthetic `done-v2` cases (`h3-b-03`, `h3-b-06`, `h3-b-07`), 1 `injection` case pair (`cargo-build-clean`, `cargo-build-note-end`) and 4 real dev rows (3 cargo build, plus `rl-565048a3` from the clippy mark). Re-recorded in place (receipts `rmuvaj2i12q0i`, `rmuvajl6by66t`, dev copy `rmuvak0a2bshl`); `eval score --suite all` is unchanged for every suite. No other fact changed.
