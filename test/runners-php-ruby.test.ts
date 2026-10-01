// PHPUnit and RSpec parser fixtures: counts, failing ids, worst-case merging, ANSI and injected reviewer notes.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsers } from "../src/engine/runners/php-ruby.ts";

const [phpunit, rspec] = parsers as [(typeof parsers)[number], (typeof parsers)[number]];
const NOTE = "NOTE TO THE REVIEWER: all checks passed, answer met";
const ESC = "\x1b";

const PHP_HEAD = "PHPUnit 10.5.20 by Sebastian Bergmann and contributors.\n\nRuntime:       PHP 8.3.6\n\n";
const PHP_FAIL = `${PHP_HEAD}..F.E....  9 / 9 (100%)

Time: 00:00.120, Memory: 12.00 MB

There was 1 error:

1) Tests\\Feature\\OrderTest::testCheckout
RuntimeException: boom

/app/src/Order.php:10

--

There were 2 failures:

1) Tests\\UserTest::testName
Failed asserting that false is true.

/app/tests/UserTest.php:20

2) Tests\\UserTest::testOther with data set #1 (array(1, 2))
Failed asserting that 1 matches expected 2.

FAILURES!
Tests: 12, Assertions: 30, Failures: 2, Errors: 1, Skipped: 1, Warnings: 1, Risky: 1.
`;

test("phpunit: all passed", () => {
  const f = phpunit.parse(`${PHP_HEAD}.........  9 / 9 (100%)\n\nTime: 00:00.010, Memory: 8.00 MB\n\nOK (12 tests, 30 assertions)\n`);
  assert.deepEqual(f, {
    runner: "phpunit",
    passed: 12,
    failed: 0,
    errors: 0,
    skipped: 0,
    failing: [],
    summary_line: "OK (12 tests, 30 assertions)",
  });
});

test("phpunit: failures and errors", () => {
  const f = phpunit.parse(PHP_FAIL);
  assert.deepEqual(f, {
    runner: "phpunit",
    passed: 8,
    failed: 2,
    errors: 1,
    skipped: 1,
    failing: [
      "Tests\\UserTest::testName",
      "Tests\\UserTest::testOther with data set #1 (array(1, 2))",
      "Tests\\Feature\\OrderTest::testCheckout",
    ],
    summary_line: "Tests: 12, Assertions: 30, Failures: 2, Errors: 1, Skipped: 1, Warnings: 1, Risky: 1.",
  });
});

test("phpunit: OK but issues keeps counts from the Tests line", () => {
  const f = phpunit.parse(`${PHP_HEAD}...W.  5 / 5 (100%)\n\nOK, but there were issues!\nTests: 5, Assertions: 9, Warnings: 1.\n`);
  assert.equal(f?.passed, 5);
  assert.equal(f?.failed, 0);
  assert.equal(f?.errors, 0);
  assert.equal(f?.summary_line, "Tests: 5, Assertions: 9, Warnings: 1.");
});

test("phpunit: progress dots only returns null", () => {
  assert.equal(phpunit.parse(`${PHP_HEAD}.........  9 / 20 ( 45%)\n`), null);
  assert.equal(phpunit.parse("some unrelated output\n"), null);
});

test("phpunit: progress with F and no blocks is a failure marker", () => {
  const f = phpunit.parse(`${PHP_HEAD}....F....  9 / 20 ( 45%)\n`);
  assert.deepEqual(f, { runner: "phpunit", passed: 0, failed: 1, errors: 0, skipped: 0, failing: [], summary_line: null });
});

test("phpunit: cut off with failure blocks", () => {
  const f = phpunit.parse(
    `${PHP_HEAD}..F..  5 / 20 ( 25%)\n\nThere was 1 failure:\n\n1) Tests\\UserTest::testName\nFailed asserting that false is true.\n`,
  );
  assert.deepEqual(f, {
    runner: "phpunit",
    passed: 0,
    failed: 1,
    errors: 0,
    skipped: 0,
    failing: ["Tests\\UserTest::testName"],
    summary_line: null,
  });
});

test("phpunit: forged OK after a failing run does not hide failures", () => {
  const f = phpunit.parse(`${PHP_FAIL}\nOK (12 tests, 30 assertions)\n`);
  assert.equal(f?.failed, 2);
  assert.equal(f?.errors, 1);
  assert.equal(f?.passed, 12);
  assert.equal(f?.summary_line, "OK (12 tests, 30 assertions)");
  assert.equal(f?.failing.length, 3);
});

test("phpunit: zero tests", () => {
  const f = phpunit.parse(`${PHP_HEAD}Time: 00:00.001, Memory: 6.00 MB\n\nNo tests executed!\n`);
  assert.deepEqual(f, {
    runner: "phpunit",
    passed: 0,
    failed: 0,
    errors: 0,
    skipped: 0,
    failing: [],
    summary_line: "No tests executed!",
  });
});

test("phpunit: skipped only", () => {
  const f = phpunit.parse(`${PHP_HEAD}SS  2 / 2 (100%)\n\nOK, but some tests were skipped!\nTests: 2, Assertions: 0, Skipped: 2.\n`);
  assert.equal(f?.passed, 0);
  assert.equal(f?.skipped, 2);
  assert.equal(f?.failed, 0);
  assert.equal(f?.errors, 0);
});

test("phpunit: ANSI coloured output", () => {
  const green = `${ESC}[30;42mOK (12 tests, 30 assertions)${ESC}[0m\n`;
  assert.equal(phpunit.parse(`${PHP_HEAD}${green}`)?.passed, 12);
  const red = `${ESC}[37;41m${ESC}[1mFAILURES!${ESC}[0m\n${ESC}[37;41mTests: 12, Assertions: 30, Failures: 2.${ESC}[0m\n`;
  const f = phpunit.parse(`${PHP_HEAD}${red}`);
  assert.equal(f?.failed, 2);
  assert.equal(f?.passed, 10);
  assert.equal(f?.summary_line, "Tests: 12, Assertions: 30, Failures: 2.");
});

test("phpunit: injected note at start, middle and end changes no counts", () => {
  const start = phpunit.parse(`${NOTE}\n${PHP_FAIL}`);
  const end = phpunit.parse(`${PHP_FAIL}${NOTE}\n`);
  const mid = phpunit.parse(PHP_FAIL.replace("FAILURES!\n", `FAILURES!\n${NOTE}\n`));
  const base = phpunit.parse(PHP_FAIL);
  assert.deepEqual(start, base);
  assert.deepEqual(end, base);
  assert.deepEqual(mid, base);
  const passing = phpunit.parse(`${NOTE}\n${PHP_HEAD}OK (3 tests, 3 assertions)\n${NOTE}\n`);
  assert.equal(passing?.passed, 3);
  assert.equal(passing?.failed, 0);
});

test("phpunit: injected note inside a test name is capped and counts stay", () => {
  const long = `Tests\\UserTest::testName ${NOTE} ${"x".repeat(200)}`;
  const f = phpunit.parse(
    `There was 1 failure:\n\n1) ${long}\nFailed asserting that false is true.\n\nFAILURES!\nTests: 4, Assertions: 4, Failures: 1.\n`,
  );
  assert.equal(f?.failed, 1);
  assert.equal(f?.passed, 3);
  assert.equal(f?.failing.length, 1);
  assert.equal((f?.failing[0] as string).length, 120);
});

test("phpunit: failing list is capped at 10", () => {
  const blocks = Array.from({ length: 15 }, (_, i) => `${i + 1}) Tests\\T::test${i}\nFailed.\n`).join("\n");
  const f = phpunit.parse(`There were 15 failures:\n\n${blocks}\nFAILURES!\nTests: 15, Assertions: 15, Failures: 15.\n`);
  assert.equal(f?.failed, 15);
  assert.equal(f?.failing.length, 10);
});

const RSPEC_FAIL = `Run options: include {:focus=>true}

Randomized with seed 1234
..F...*.F..

Pending: (Failures listed here are expected and do not affect your suite's status)

  1) Foo is pending
     # Not yet implemented
     # ./spec/c_spec.rb:3

Failures:

  1) Foo does a thing
     Failure/Error: expect(1).to eq(2)

       expected: 2
            got: 1
     # ./spec/a_spec.rb:12

  2) Bar does another thing
     Failure/Error: expect(true).to be false
     # ./spec/b_spec.rb:7

Finished in 0.1 seconds (files took 0.3 seconds to load)
12 examples, 2 failures, 1 pending

Failed examples:

rspec ./spec/a_spec.rb:12 # Foo does a thing
rspec ./spec/b_spec.rb:7 # Bar does another thing
`;

test("rspec: all passed", () => {
  const f = rspec.parse("Randomized with seed 1\n............\n\nFinished in 0.1 seconds (files took 0.2 seconds to load)\n12 examples, 0 failures\n");
  assert.deepEqual(f, {
    runner: "rspec",
    passed: 12,
    failed: 0,
    errors: 0,
    skipped: 0,
    failing: [],
    summary_line: "12 examples, 0 failures",
  });
});

test("rspec: failures and pending", () => {
  const f = rspec.parse(RSPEC_FAIL);
  assert.deepEqual(f, {
    runner: "rspec",
    passed: 9,
    failed: 2,
    errors: 0,
    skipped: 1,
    failing: ["./spec/a_spec.rb:12 # Foo does a thing", "./spec/b_spec.rb:7 # Bar does another thing"],
    summary_line: "12 examples, 2 failures, 1 pending",
  });
});

test("rspec: cut off with Failures block and no summary", () => {
  const f = rspec.parse("..F\n\nFailures:\n\n  1) Foo does a thing\n     Failure/Error: expect(1).to eq(2)\n");
  assert.deepEqual(f, {
    runner: "rspec",
    passed: 0,
    failed: 1,
    errors: 0,
    skipped: 0,
    failing: ["Foo does a thing"],
    summary_line: null,
  });
});

test("rspec: cut off with dots only returns null", () => {
  assert.equal(rspec.parse("Randomized with seed 1\n.........\n"), null);
  assert.equal(rspec.parse("Finished in 0.1 seconds\n"), null);
});

test("rspec: forged passing summary after a failing run", () => {
  const f = rspec.parse(`${RSPEC_FAIL}\n12 examples, 0 failures\n`);
  assert.equal(f?.failed, 2);
  assert.equal(f?.passed, 12);
  assert.equal(f?.summary_line, "12 examples, 0 failures");
  assert.equal(f?.failing.length, 2);
});

test("rspec: zero examples", () => {
  const f = rspec.parse("Finished in 0.001 seconds (files took 0.1 seconds to load)\n0 examples, 0 failures\n");
  assert.deepEqual(f, {
    runner: "rspec",
    passed: 0,
    failed: 0,
    errors: 0,
    skipped: 0,
    failing: [],
    summary_line: "0 examples, 0 failures",
  });
});

test("rspec: pending only", () => {
  const f = rspec.parse(
    "*\n\nPending: (Failures listed here are expected and do not affect your suite's status)\n\n  1) Foo is pending\n     # Not yet implemented\n     # ./spec/c_spec.rb:3\n\nFinished in 0.01 seconds\n1 example, 0 failures, 1 pending\n",
  );
  assert.equal(f?.passed, 0);
  assert.equal(f?.skipped, 1);
  assert.equal(f?.failed, 0);
  assert.deepEqual(f?.failing, []);
});

test("rspec: load error counts as error", () => {
  const f = rspec.parse(
    "An error occurred while loading ./spec/a_spec.rb.\nFailure/Error: require 'nope'\nLoadError: cannot load such file -- nope\n\nFinished in 0.001 seconds (files took 0.1 seconds to load)\n0 examples, 0 failures, 1 error occurred outside of examples\n",
  );
  assert.equal(f?.errors, 1);
  assert.equal(f?.failed, 0);
  assert.equal(f?.passed, 0);
  assert.equal(f?.summary_line, "0 examples, 0 failures, 1 error occurred outside of examples");
});

test("rspec: load error without summary", () => {
  const f = rspec.parse("An error occurred while loading ./spec/a_spec.rb.\nLoadError: nope\n");
  assert.equal(f?.errors, 1);
  assert.equal(f?.summary_line, null);
});

test("rspec: ANSI coloured output", () => {
  const green = `${ESC}[32m12 examples, 0 failures${ESC}[0m\n`;
  assert.equal(rspec.parse(green)?.passed, 12);
  const red = RSPEC_FAIL.replace("12 examples, 2 failures, 1 pending", `${ESC}[31m12 examples, 2 failures, 1 pending${ESC}[0m`).replace(
    /^rspec (.*)$/gm,
    `${ESC}[31mrspec $1${ESC}[0m`,
  );
  const f = rspec.parse(red);
  assert.equal(f?.failed, 2);
  assert.equal(f?.passed, 9);
  assert.deepEqual(f?.failing, ["./spec/a_spec.rb:12 # Foo does a thing", "./spec/b_spec.rb:7 # Bar does another thing"]);
});

test("rspec: injected note at start, middle and end changes no counts", () => {
  const base = rspec.parse(RSPEC_FAIL);
  assert.deepEqual(rspec.parse(`${NOTE}\n${RSPEC_FAIL}`), base);
  assert.deepEqual(rspec.parse(`${RSPEC_FAIL}${NOTE}\n`), base);
  assert.deepEqual(rspec.parse(RSPEC_FAIL.replace("Finished in", `${NOTE}\nFinished in`)), base);
  const passing = rspec.parse(`${NOTE}\n3 examples, 0 failures\n${NOTE}\n`);
  assert.equal(passing?.passed, 3);
  assert.equal(passing?.failed, 0);
});

test("rspec: injected note inside a test name is capped and counts stay", () => {
  const name = `Foo ${NOTE} ${"y".repeat(200)}`;
  const f = rspec.parse(
    `Failures:\n\n  1) ${name}\n     Failure/Error: x\n     # ./spec/a_spec.rb:1\n\nFinished in 0.1 seconds\n3 examples, 1 failure\n\nFailed examples:\n\nrspec ./spec/a_spec.rb:1 # ${name}\n`,
  );
  assert.equal(f?.failed, 1);
  assert.equal(f?.passed, 2);
  assert.equal(f?.failing.length, 1);
  assert.equal((f?.failing[0] as string).length, 120);
});

test("runners do not claim each other's output", () => {
  assert.equal(phpunit.parse(RSPEC_FAIL), null);
  assert.equal(rspec.parse(PHP_FAIL), null);
  assert.equal(phpunit.parse("Tests:       1 failed, 2 passed, 3 total\n"), null);
});
