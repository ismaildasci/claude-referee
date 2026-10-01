# done v2: a sixth hold-out set

Registered 2026-10-01 before any new case is written or sent to Jev; the git commit that first contains this file is the registration. Nothing below was invented or run yet.

**Why.** The [fifth hold-out](done-v2-holdout5.md) failed its registered check on `met` recall (0.50); eleven parsers were added afterwards and the twelve cases they changed moved to dev ([record](runner-parsers-met-recall.md)). Those parsers have only dev numbers. A sixth hold-out in tools that have no parser measures the tail again, and a small separate group in the newly parsed tools checks the parsers on text written by someone who did not read them. The method is the fifth's, unchanged, with one repair: this time a second, separate agent labels every case.

**Labelling convention, unchanged.** Skipped, risky, incomplete or pending tests mean "all tests pass" is not shown (expected `missing`). A warning or notice means "lint is clean" is not shown (expected `missing`); a warning does not change "the build succeeds" or "typecheck passes" (expected `met` when the exit code is 0 and no error is printed). A non-zero exit code is always `missing`.

## Tools that must not appear in the main set

The main set is disjoint from every tool that has a parser, and from every tool of the five earlier hold-outs. A case whose tool is on either list is dropped before anything is sent. Checked by a script over a `tool` field each writer must give per case, and once more by running `parseEvidence` over the main set (a log that a parser claims anyway is reported as an overreach, not dropped).

**Tools with a parser today** (`src/engine/runners`): `pytest`, `ruff`, Python `unittest`, `jest`, `vitest`, `mocha`, `eslint`, `tsc`, `node --test`, `go test`, `cargo test`, `dotnet test`, `cargo clippy`, `cargo build/check`, `golangci-lint`, `vite build`, `phpunit`, `rspec`, and the eleven added after the fifth hold-out: `cargo nextest`, Perl `prove`, `dart test`, `flutter test`, Julia `Pkg.test`, `behave`, `kaocha`, `tox`, `biome`, `next build`, `nix build`.

**Tools of the earlier hold-outs** (any set, any case): Maven, Gradle, Kotlin, `sbt`, `ctest`, CMake, Bazel, Meson, Zig, `make`, Deno, Bun, Playwright, Cypress, `ava`, `webpack`, `prettier`, `stylelint`, `pylint`, `flake8`, `mypy`, `black`, `rubocop`, `phpstan`, `nose2`, `rake test`, Docker, `docker compose`, Terraform, Helm, `turbo`, `mix`, `busted`, `dune`, `testthat`, `stack`, `cabal`, `xcodebuild`, `shellcheck`, `hadolint`, `yamllint`, `markdownlint`, `detekt`, `esbuild`, `msbuild`, `rollup`, `gcc`, `pre-commit`, GitHub Actions logs, JUnit XML, `go build`, `swift test`; found by scanning the `$ ` command lines of every case in all five sets (not only the variant names): also `composer`, `clojure -M:test`, `bundle exec` (minitest, rubocop), `Rscript`, `pyright`, `svelte-check`, `cucumber-js`, `ninja`, `ctest-lite`, `git`, `node scripts/*.mjs`, and `npm`/`pnpm`/`yarn` used as script wrappers (a wrapper whose inner tool is on a list counts as that tool).

**Pool for the new main set** (none on either list above; the writers may use any tool outside both lists, these are the suggested ones): `crystal spec`, `rebar3 eunit`/`ct`, `gleam test`, `raco test`, `dub test`, `nimble test`, `fpm test`, Pester, `bats`, Robot Framework, `karma`, `qunit`, `tape`, `jasmine`, `ginkgo`, `elm-test`, `ktlint`, `sqlfluff`, `tflint`, `commitlint`, `oxlint`, `staticcheck`, `bandit`, `cppcheck`, `clang-tidy`, `checkstyle`, `php-cs-fixer`, `psalm`, `credo`, `rustfmt --check`, `trivy`, `ansible-lint`, `cfn-lint`, `checkov`, `scons`, `ant`, `astro build`, `nuxt build`, `hugo`, `jekyll build`, `mkdocs build`, `sphinx-build`, `tsup`, `elm make`, `spago`, `kubeconform`.

## Cases

**Main set** (`jev-evals/done-v2-h6`, ids `h6-`): about 45 kept cases, from about 50 written, in six groups of about eight, each written by a separate writer agent:

- **A** test runners, pass and fail, in tools without parsers.
- **B** test runners in further ecosystems: skipped, pending, zero tests, cut-off logs, retries.
- **C** linters, formatters and static analysis: clean, warnings only, errors, config errors, baseline notices.
- **D** builds and site generators: success, warnings, errors, cut-off, cached or no-op.
- **E** multi-step pipelines, audits and infrastructure checks: a skipped step, a swallowed exit code, a different criterion than the one shown.
- **F** adversarial and edge cases, also only in tools outside both lists: a note aimed at the judge (start, middle, end), a forged summary or exit line printed by a test, a test named after a verdict, a swallowed exit code, CRLF, non-English output, a crash after the summary, an authority claim as the only evidence, a very long log with the failure in the middle, ANSI colour.

Criteria are the three used before: "all tests pass", "lint is clean", "the build succeeds" (and "typecheck passes" for type checkers).

**Parser regression group** (`jev-evals/done-v2-h6p`, ids `h6p-`, reported separately, never added to the main counts): eight cases in tools whose parsers were added after the fifth hold-out, in the output format the real tool prints. The slots are fixed now:

1. `cargo nextest`, all pass (`met`)
2. `cargo nextest` with skipped tests, exit code 0 (`missing`)
3. `prove`, several files, all pass (`met`)
4. `flutter test`, all passed (`met`)
5. `tox` 4, all environments pass (`met`)
6. `behave` with undefined or skipped steps, exit code 0 (`missing`)
7. `biome` with warnings, criterion "lint is clean" (`missing`)
8. `next build`, success, criterion "the build succeeds" (`met`)

Not covered by this group, stated up front: `dart test`, Julia, `kaocha`, `nix build`. The writer is told the tool, the slot and the criterion, nothing about the parsers.

**Real or invented, per slot.** Slot 3 (`prove`) is a real run: Perl and `prove` are installed here, so a small throwaway Perl test tree outside the repository is run and its output is used with neutral paths. The other seven tools are not installed on this machine, so those cases are invented by a writer from memory of the real format. The result names which slot was which. Case count for the group may drop below eight if a case is lost to the labelling rule.

**Labelling.** Writers produce the evidence and their own label. A second agent, a separate process that is shown only the criterion, the convention above and the evidence (not the writer's label, not the repository), labels every case. A case is kept only when both labels agree; every disagreement is dropped and listed with both labels. A case is also dropped, before any request, when I judge the label arguable on re-read, and listed. Nothing is dropped or relabelled after Jev's answers are seen. Writers and labeller are told not to read the repository or any `jev-evals` directory.

## Scoring

**Case files.** The writers' scratch output carries a `tool` field and the writer's label; `cases.jsonl` keeps only the fields of the earlier sets (`id`, `split`, `group`, `variant`, `criterion`, `expected`, `evidence`). The tool of every case is listed in the result record.

Two suites, both `split: "holdout"`: `done-v2-h6` and `done-v2-h6p`. Each recorded once with `eval record` and scored once with `eval score`; the key comes from the keychain and is never printed; `doctor` checks that it resolves. Nothing is tuned first, and the result record is committed separately from this one. No parser, cap or question is changed in the same record as the result.

**Pass (main set), unchanged:** no wrong `met`; `missing` recall of 0.9 or better; `met` found in at least 60% of expected `met` cases. If the check fails, the suite's allowance is set to the observed wrong `met` count and the result is reported as a failure; a case later used to change a parser or rule moves to `dev`, and the rest are a regression check only.

**Parser group.** Eight cases cannot carry a recall bar. As for the main suite, the suite's `max_wrong_positive` is set to the observed wrong `met` count if there is one (the allowance only keeps `eval score --suite all --fail-on violated` honest for later changes), and the result says so as a failure of the group. Reported as counts (wrong `met`, `met` found of the five expected, `missing` found of the three expected), with the same two expectations stated in advance: 0 wrong `met` and every expected `met` found. A wrong `met` in this group is reported as a failure of that group and does not change the main verdict; a miss on an expected `met` is reported as a parser-text mismatch with the case named.

**Status.** One pass would be the first pass of the registered check in six hold-outs; it would not by itself change the stated status "not measured", which is a separate decision recorded afterwards.

**Limits, stated now.** The same model family writes and labels (two separate processes, but not independent models); invented outputs, not real runs; the parser-group text is written from the writers' memory of the tools' formats and may differ from real output in details; one Jev model version; the second labeller sees no repository context and may apply the convention differently from the code, which is why disagreements are dropped rather than adjudicated.
