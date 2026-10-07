// docs/decisions/combined-log-lint-cap-narrow.md: with a test or build runner parsed and no linter, only a linter-shaped warning or error line, or a linter summary with a count above 0, caps a lint or clean criterion.
// Every line below is invented to mirror real shapes (vitest, jest, vite, cargo test, cargo nextest, node:test, dotnet test, ctest, behave, maven, pytest, oxlint agent and unix formats, eslint stylish, stylelint, jshint, flake8, biome, shellcheck, markdownlint-cli2, rustc, checkstyle XML); no real log text is committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneRequest, hasLinterDiagnostic } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";

const pack = loadPack("generic", packDirs(process.env));
const resultOf = (evidence: string, criteria: readonly string[], p: number | readonly number[] = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, criteria, evidence);
  const answers = Object.fromEntries(criteria.map((_, i) => [`c${i + 1}`, { type: "noul" as const, noul: typeof p === "number" ? p : (p[i] ?? 0) }]));
  return finish(planned.length === 0 ? [] : [{ id: "done", answers, stopped: [], cached: true }]);
};
const verdictOf = (evidence: string, criterion = "all tests pass", p = 0.98) => {
  const result = resultOf(evidence, [criterion], p);
  return { verdict: result.verdict, reason: result["reason"] };
};
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const runnersOf = (evidence: string) => parseEvidence(evidence).runners.map((r) => r.runner);
const CAPPED = { verdict: "unsure", reason: "warning_in_log" };
const MET = { verdict: "met", reason: undefined };

const VITEST = lines(" Test Files  4 passed (4)", "      Tests  31 passed (31)");
const JEST = lines("Test Suites: 3 passed, 3 total", "Tests:       12 passed, 12 total");
const OX_AGENT = lines("web/cart.ts:12:9: warning eslint(no-unused-vars): Variable 'total' is declared but never used.", "web/cart.ts:30:5: warning eslint(no-debugger): `debugger` statement is not allowed");
const OX_AGENT_ERROR = "web/cart.ts:30:5: error eslint(no-debugger): `debugger` statement is not allowed\n";
const GCC = "src/main.c:4:7: warning: unused variable 'x' [-Wunused-variable]\n";
const FLAKE8 = lines("app/models.py:1:1: F401 'os' imported but unused", "app/models.py:3:80: E501 line too long (88 > 79 characters)", "app/models.py:9:1: W291 trailing whitespace");
const STYLISH = lines("/srv/app/web/cart.ts", "  12:9  warning  'total' is assigned a value but never used  no-unused-vars", "  30:5  error    Unexpected 'debugger' statement             no-debugger");
const STYLELINT = lines("css/site.css", "  4:9  ⚠  Expected \"#AABBCC\" to be \"#ABC\"  color-hex-length", "", "⚠ 1 problem (0 errors, 1 warning)");
const OX_UNIX = lines("web/cart.ts:12:9: Variable 'total' is declared but never used. [Warning/eslint(no-unused-vars)]", "", "1 problem");
const EXIT = "exit code: 0\n";
const WARNING_NEXT = "The log shows a warning, notice, failure or skip wording, or a swallowed exit code, and only an exit code backs the lint criterion, so done won't say met. Pipe the linter's full summary, or say yourself that the warning is acceptable.";
const DIAGNOSTIC_NEXT = "The log has a linter's warning or error line, or a linter summary with a count above 0, and no linter's summary was recognised, so done won't say met. Run the linter as its own done call and pipe its full output, or say yourself that the warning is acceptable.";

const CLEAN_SUMMARIES: readonly (readonly [string, string])[] = [
  ["cargo test", "running 14 tests\ntest result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s\n"],
  ["node:test", lines("ℹ tests 12", "ℹ suites 0", "ℹ pass 12", "ℹ fail 0", "ℹ cancelled 0", "ℹ skipped 0", "ℹ todo 0", "ℹ duration_ms 52.1")],
  ["dotnet test", "Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12, Duration: 52 ms - App.Tests.dll (net8.0)\n"],
  ["ctest", lines("100% tests passed, 0 tests failed out of 12", "", "Total Test time (real) =   0.50 sec")],
  ["cargo nextest", "     Summary [   0.120s] 12 tests run: 12 passed, 0 skipped\n"],
  ["behave", lines("1 feature passed, 0 failed, 0 skipped", "3 scenarios passed, 0 failed, 0 skipped", "9 steps passed, 0 failed, 0 skipped, 0 undefined", "Took 0m0.010s")],
  ["maven", lines("[INFO] Tests run: 12, Failures: 0, Errors: 0, Skipped: 0", "[INFO] BUILD SUCCESS")],
];

const NOTICES: readonly (readonly [string, string])[] = [
  ["pytest's own warnings count", `============ 12 passed, 1 warning in 0.50s ============\n`],
  ["pytest's warnings summary", lines("============ warnings summary ============", "tests/test_models.py::test_save", "  /usr/lib/python3.12/site-packages/pkg/mod.py:12: DeprecationWarning: pkg_resources is deprecated as an API", "============ 12 passed, 1 warning in 0.50s ============")],
  ["Node's DeprecationWarning", `${JEST}(node:4242) [DEP0040] DeprecationWarning: The \`punycode\` module is deprecated. Please use a userland alternative instead.\n`],
  ["Node's ExperimentalWarning and its hint", `(node:4242) ExperimentalWarning: VM Modules is an experimental feature and might change at any time\n(Use \`node --trace-warnings ...\` to show where the warning was created)\n${JEST}`],
  ["npm's deprecation notices", `npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.\nnpm WARN deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported\n${VITEST}`],
  ["a test file named errors", ` ✓ src/errors.test.ts (4 tests) 3ms\n ✓ src/warning-banner.test.tsx (2 tests) 5ms\n${VITEST}`],
  ["npm script echo lines", `${VITEST}\n> app@1.0.0 lint\n> eslint . --no-error-on-unmatched-pattern --max-warnings 0\n\n$ npm run lint -- --report-unused-disable-directives\n`],
  ["a React act() warning in a test's stderr", `stderr | web/cart.test.tsx > adds an item\nWarning: An update to Cart inside a test was not wrapped in act(...).\n${VITEST}`],
  ["a clean linter summary with zero counts", `${VITEST}Found 0 warnings and 0 errors.\nFinished in 4ms on 12 files with 96 rules using 8 threads.\n`],
];

test("hasLinterDiagnostic: each registered shape of a linter warning or error line", () => {
  const positives: readonly (readonly [string, string])[] = [
    ["path:line:col: warning (oxlint agent format)", OX_AGENT],
    ["path:line:col: error (oxlint agent format)", OX_AGENT_ERROR],
    ["path:line:col: warning: (compiler style)", GCC],
    ["path:line:col: CODE (flake8, pycodestyle)", FLAKE8],
    ["path:line:col: CODE, one line", "app/models.py:9:1: W291 trailing whitespace\n"],
    ["stylish row under a file header (eslint)", STYLISH],
    ["stylish error row under a file header", lines("web/cart.ts", "  30:5  error  Unexpected 'debugger' statement  no-debugger")],
    ["✖ N problems", "✖ 3 problems (1 error, 2 warnings)\n"],
    ["⚠ N problem (stylelint)", STYLELINT],
    ["N problems alone (oxlint unix format)", OX_UNIX],
    ["Found N warnings", "Found 2 warnings.\n"],
    ["Found 0 warnings and N errors", "Found 0 warnings and 1 error.\n"],
    ["Found N errors in a file", "Found 1 error in web/cart.ts:12\n"],
    ["N warnings found (stylelint verbose)", lines("1 source checked", "  css/site.css", "", "2 warnings found", "  color-hex-length: 1")],
    ["N errors found", "2 errors found\n"],
    ["N errors alone (jshint)", lines("web/a.js: line 1, col 13, Missing semicolon.", "", "2 errors")],
    ["indented N warning", "  1 warning\n"],
    ["0 warnings and N errors", "0 warnings and 2 errors.\n"],
  ];
  for (const [name, log] of positives) assert.equal(hasLinterDiagnostic(log), true, name);
});

test("hasLinterDiagnostic: zero counts, test summaries, notices, file names and command echo lines never count", () => {
  const negatives: readonly string[] = [
    ...CLEAN_SUMMARIES.map(([, log]) => log),
    ...NOTICES.map(([, log]) => log),
    lines("0 warnings", "0 errors", "ℹ fail 0", "# fail 0", "0 failed", "Skipped: 0", "✖ 0 problems", "Found 0 warnings and 0 errors.", "Found 0 errors.", "0 warnings found", "0 errors and 0 warnings", "0 errors."),
    lines("1 warning in 0.01s", "12 passed, 1 warning in 0.50s", "1 error was not a part of any test, see above for details"),
    lines("  0 errors and 1 warning potentially fixable with the `--fix` option.", "  1 warning potentially fixable with the \"--fix\" option."),
    lines("  3 problems are reported for a bad file", "2 errors are expected when the input is empty"),
    lines("$ eslint web/cart.ts", "> oxlint --deny-warnings", "src/warnings.ts", "src/errors/index.ts"),
    lines(" Test Files  4 passed (4)", "  12:9  warning  'total' is assigned a value but never used  no-unused-vars"),
    "2026-10-07T12:30:45: error connecting to the cache, retrying\n",
    "app/models.py:1:0: W0611: Unused import os (unused-import)\n",
    "docs/guide.md:1 error MD022/blanks-around-headings Headings should be surrounded by blank lines\n",
  ];
  for (const log of negatives) assert.equal(hasLinterDiagnostic(log), false, log);
});

test("a test runner parsed next to an unparsed linter's warnings: a lint criterion is capped, a test criterion is not", () => {
  const log = `${VITEST}${OX_AGENT}${EXIT}`;
  assert.deepEqual(runnersOf(log), ["vitest"]);
  for (const criterion of ["lint passes", "oxlint passes", "all tests pass and lint is clean", "no warnings"]) {
    assert.deepEqual(verdictOf(log, criterion), CAPPED, criterion);
  }
  assert.deepEqual(verdictOf(log), MET);
  assert.deepEqual(verdictOf(log, "the build succeeds"), MET);
  assert.equal(resultOf(log, ["lint is clean"]).next_step, DIAGNOSTIC_NEXT);
});

test("each diagnostic shape next to a passing test run caps a lint or clean criterion; flake8 and stylish lines are already claimed by the ruff and eslint parsers", () => {
  const shapes: readonly (readonly [string, string, string])[] = [
    ["oxlint agent warning", `${VITEST}${OX_AGENT}`, "lint is clean"],
    ["oxlint agent error", `${JEST}${OX_AGENT_ERROR}`, "oxlint passes"],
    ["compiler-style warning", `${VITEST}${GCC}`, "the build is clean"],
    ["stylelint summary", `${JEST}${STYLELINT}`, "stylelint and jest pass"],
    ["oxlint unix summary", `${VITEST}${OX_UNIX}`, "lint passes"],
    ["Found N warnings", `${VITEST}Found 2 warnings.\n`, "lint passes"],
    ["N warnings found", `${JEST}2 warnings found\n`, "no lint warnings"],
    ["N errors alone", `${VITEST}2 errors\n`, "lint passes"],
  ];
  for (const [name, log, criterion] of shapes) {
    assert.deepEqual(verdictOf(`${log}${EXIT}`, criterion), CAPPED, name);
    assert.deepEqual(verdictOf(`${log}${EXIT}`), MET, name);
  }
  assert.deepEqual(runnersOf(`${JEST}${FLAKE8}${EXIT}`).sort(), ["jest", "ruff"]);
  assert.equal(verdictOf(`${JEST}${FLAKE8}${EXIT}`, "flake8 passes").verdict, "unsure");
  assert.deepEqual(runnersOf(`${JEST}${STYLISH}${EXIT}`).sort(), ["eslint", "jest"]);
  assert.equal(verdictOf(`${JEST}${STYLISH}${EXIT}`, "eslint passes").verdict, "unsure");
});

test("several criteria: the top-level reason is the cap, the lint entry keeps criterion_not_covered", () => {
  const r = resultOf(`${VITEST}${OX_AGENT}${EXIT}`, ["all tests pass", "lint passes"]);
  assert.deepEqual([r.verdict, r["reason"]], ["unsure", "warning_in_log"]);
  assert.deepEqual(r["criteria"], [{ i: 1, verdict: "met", p: 0.98 }, { i: 2, verdict: "unsure", p: 0.98, reason: "criterion_not_covered" }]);
});

test("a build runner parsed with no linter: a clean criterion next to a linter warning line is capped", () => {
  const vite = lines("vite v5.2.11 building for production...", "✓ 842 modules transformed.", "✓ built in 7.34s");
  assert.deepEqual(runnersOf(`${vite}${OX_AGENT}${EXIT}`), ["vite"]);
  assert.deepEqual(verdictOf(`${vite}${OX_AGENT}${EXIT}`, "the build is clean"), CAPPED);
  assert.deepEqual(verdictOf(`${vite}${EXIT}`, "the build is clean"), MET);
});

test("clean test summaries, with their zero counts, stay met under a lint or clean criterion", () => {
  for (const [runner, log] of CLEAN_SUMMARIES) {
    assert.deepEqual(runnersOf(`${log}${EXIT}`), [runner]);
    for (const criterion of ["lint passes", "the type check is clean", "all tests pass"]) {
      assert.deepEqual(verdictOf(`${log}${EXIT}`, criterion), MET, `${runner}: ${criterion}`);
    }
  }
});

test("deprecation notices, a test runner's own warnings, file names and command echo lines stay met", () => {
  for (const [name, log] of NOTICES) {
    assert.equal(parseEvidence(`${log}${EXIT}`).trust, "parsed", name);
    assert.deepEqual(verdictOf(`${log}${EXIT}`, "lint passes"), MET, name);
    assert.deepEqual(verdictOf(`${log}${EXIT}`, "the type check is clean"), MET, name);
  }
});

test("exit-code-only evidence keeps its wording check; a parsed linter keeps the parsed-warnings check; other verdicts are untouched", () => {
  const notice = "npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.\n";
  assert.equal(parseEvidence(`${notice}${EXIT}`).trust, "exit_code");
  assert.deepEqual(verdictOf(`${notice}${EXIT}`, "lint passes"), CAPPED);
  assert.deepEqual(verdictOf(`${OX_AGENT}${EXIT}`, "lint passes"), CAPPED);
  assert.equal(resultOf(`${notice}${EXIT}`, ["lint passes"]).next_step, WARNING_NEXT);
  assert.equal(resultOf(`${OX_AGENT}${EXIT}`, ["lint passes"]).next_step, WARNING_NEXT);
  const parsedWarnings = `${VITEST}${STYLISH.replace(/\n.*error.*\n$/, "\n")}\n✖ 1 problem (0 errors, 1 warning)\n${EXIT}`;
  assert.ok(parseEvidence(parsedWarnings).runners.some((r) => r.runner === "eslint" && (r.warnings ?? 0) > 0));
  assert.deepEqual(verdictOf(parsedWarnings, "lint passes"), CAPPED);
  assert.equal(resultOf(parsedWarnings, ["lint passes"]).next_step, WARNING_NEXT);
  assert.deepEqual(verdictOf(OX_AGENT, "lint passes"), { verdict: "unsure", reason: undefined });
  const log = `${VITEST}${OX_AGENT}${EXIT}`;
  assert.deepEqual(verdictOf(log, "lint passes", 0.6), { verdict: "unsure", reason: "criterion_not_covered" });
  assert.deepEqual(verdictOf(log, "lint passes", 0.2), { verdict: "missing", reason: "criterion_not_covered" });
  const ruff = `${VITEST}All checks passed!\n${EXIT}`;
  assert.deepEqual(runnersOf(ruff).sort(), ["ruff", "vitest"]);
  assert.deepEqual(verdictOf(ruff, "lint is clean"), MET);
});

test("known residuals, outside the registered rule: these linter warnings still reach met next to a parsed runner", () => {
  const residuals: readonly (readonly [string, string])[] = [
    ["a parsed clean linter (biome) next to another linter's warnings", `${JEST}${STYLELINT}Checked 14 files in 3ms. No fixes applied.\n`],
    ["eslint -f json", `${VITEST}[{"filePath":"web/a.ts","messages":[{"ruleId":"no-unused-vars","severity":1,"line":1,"column":7}],"errorCount":0,"warningCount":1}]\n`],
    ["oxlint's default format with its summary cut off", `${VITEST}  ⚠ eslint(no-unused-vars): Variable 'x' is declared but never used.\n   ╭─[web/a.ts:1:7]\n 1 │ const x = 1;\n   ╰────\n`],
    ["pylint's four-digit codes", `${VITEST}app/models.py:1:0: W0611: Unused import os (unused-import)\n`],
    ["markdownlint lines with no column", `${VITEST}docs/guide.md:1 error MD022/blanks-around-headings Headings should be surrounded by blank lines\n`],
    ["markdownlint-cli2's issue summary", `${VITEST}${lines("Linting: 1 file", "Summary: 3 issues in 1 file")}`],
    ["shellcheck's default (tty) format", `${VITEST}${lines("In deploy.sh line 3:", "cd $DIR", "^-----^ SC2164 (warning): Use 'cd ... || exit' or 'cd ... || return' in case cd fails.")}`],
    ["stylelint's compact format", `${VITEST}css/site.css: line 1, col 12, warning - Expected "#AABBCC" to be "#ABC" (color-hex-length)\n`],
    ["a checkstyle XML report", `${VITEST}${lines('<checkstyle version="4.3">', '<file name="web/a.ts">', '<error line="1" column="7" severity="warning" message="x is never used" source="eslint.rules.no-unused-vars" />', "</file>", "</checkstyle>")}`],
    ["rustc's warning and arrow lines next to cargo test", lines("warning: unused variable: `x`", " --> src/lib.rs:2:9", "warning: `app` (lib test) generated 1 warning", "running 3 tests", "test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s")],
  ];
  for (const [name, log] of residuals) assert.deepEqual(verdictOf(`${log}${EXIT}`, "lint is clean"), MET, name);
});
