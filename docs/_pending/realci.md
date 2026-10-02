# Pending from stream `realci`

Details: [docs/measurements-real-logs.md](../measurements-real-logs.md), registration [docs/decisions/done-v2-real-logs.md](../decisions/done-v2-real-logs.md), data `docs/data/done-v2-real/`.

## CHANGELOG lines (unreleased, docs and tooling only)

- Registered a real-log hold-out for `done` v2 with metrics that do not conflict with the safety rule (wrong `met` 0, parsed coverage, `met` recall among parsed logs only); `done` v2 stays "not measured" on the old bar.
- Added `scripts/real-ci/` (fetch real GitHub Actions step logs with `gh`, label, score) and the sample: 229 cases from 94 repositories in 13 language buckets (after the registered 8-per-bucket selection and the ambiguous and silent-`met` drops).

## measurements.md entry (for the owner of that file)

Real CI logs, parsed coverage measured: 68 of 199 succeeded steps (34.2%, 95% interval 27.6% to 41.2%); tests 62.2%, lint 16.7%, build 13.3%. Wrong `met` and `met` recall among parsed: **not measured**, the Jev answers were not recorded (the recording step was refused by the permission system; one command remains). Offline ceiling: code caps allow `met` for 42 of 44 parsed expected-`met` cases, and for 43 of 52 expected-`missing` cases in the exit-code-only bucket, so those depend on Jev alone. The wrong-`met` bar is weaker than its 3.9% bound: of 76 expected-`missing` steps only 29 ran the check and only 9 of those reach Jev past the code caps. Labels: 15 silent `met` labels (command echo and exit 0 only) were dropped as ambiguous, selection restricted to the registered 8 per bucket; the sample under-represents silent and truncated evidence.

## ROADMAP edits

- Real-log hold-out: data and labels done; **record the Jev answers** (`eval record --suite done-v2-real`, see the measurements file), then score and set the suite allowance if a wrong `met` occurs.
- Data-driven parser backlog (ranked in the measurements file): `cmake --build`/`msbuild`, `docker build`, `go build`, `dotnet build`, `swift test`, `make`, `phpcs`, `rubocop`; plus the VSTest summary format of `dotnet test` (`Test Run Successful.`), which the existing parser does not read. No parser was added in this stream.
- Failed-step share of the sample is 13.1%, under the registered 20%: a second sample with more failing steps (or a different step-mapping rule for composite actions, which dropped 2,429 jobs) is the open data gap.
