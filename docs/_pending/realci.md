# Pending from stream `realci`

Details: [docs/measurements-real-logs.md](../measurements-real-logs.md), registration [docs/decisions/done-v2-real-logs.md](../decisions/done-v2-real-logs.md), data `docs/data/done-v2-real/`.

## CHANGELOG lines (unreleased, docs and tooling only)

- Registered a real-log hold-out for `done` v2 with metrics that do not conflict with the safety rule (wrong `met` 0, parsed coverage, `met` recall among parsed logs only); `done` v2 stays "not measured" on the old bar.
- Added `scripts/real-ci/` (fetch real GitHub Actions step logs with `gh`, label, score) and the sample: 256 cases from 102 repositories in 13 language buckets.

## measurements.md entry (for the owner of that file)

Real CI logs, parsed coverage measured: 78 of 226 succeeded steps (34.5%, 95% interval 28.3% to 41.1%); tests 65.6%, lint 13.5%, build 14.3%. Wrong `met` and `met` recall among parsed: **not measured**, the Jev answers were not recorded (the recording step was refused by the permission system; one command remains). Offline ceiling: code caps allow `met` for 52 of 54 parsed expected-`met` cases, and for 44 of 53 expected-`missing` cases in the exit-code-only bucket, so those depend on Jev alone.

## ROADMAP edits

- Real-log hold-out: data and labels done; **record the Jev answers** (`eval record --suite done-v2-real`, see the measurements file), then score and set the suite allowance if a wrong `met` occurs.
- Data-driven parser backlog (ranked in the measurements file): `cmake --build`/`msbuild`, `docker build`, `go build`, `dotnet build`, `swift test`, `make`, `phpcs`, `rubocop`; plus the VSTest summary format of `dotnet test` (`Test Run Successful.`), which the existing parser does not read. No parser was added in this stream.
- Failed-step share of the sample is 11.7%, under the registered 20%: a second sample with more failing steps (or a different step-mapping rule for composite actions, which dropped 2,429 jobs) is the open data gap.
