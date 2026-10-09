// checkClaim: quote and number matching of a claim against its source, including odd and large input.

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkClaim } from "../src/engine/claims.ts";

test("verbatim quote present and absent", () => {
  const source = "The runner prints ok when every case passes.";
  const hit = checkClaim('It says "prints ok when every case passes".', source);
  assert.deepEqual(hit.quotes, ["prints ok when every case passes"]);
  assert.deepEqual(hit.quotes_missing, []);
  const miss = checkClaim('It says "prints done when every case passes".', source);
  assert.deepEqual(miss.quotes_missing, ["prints done when every case passes"]);
});

test("quote ignores case, whitespace runs and emphasis", () => {
  const source = "Exit   code\n\tis **Non-Zero** on _failure_.";
  const result = checkClaim('"exit code is non-zero on failure"', source);
  assert.deepEqual(result.quotes_missing, []);
  assert.deepEqual(checkClaim('"snake_case"', "uses snake_case here").quotes_missing, []);
  assert.deepEqual(checkClaim('"snakecase"', "uses snake_case here").quotes_missing, ["snakecase"]);
});

test("curly quotes and dashes are normalised", () => {
  const source = 'He wrote "stop — now" and it’s fine.';
  const result = checkClaim("“stop - now” and “it's fine”", source);
  assert.deepEqual(result.quotes, ["stop - now", "it's fine"]);
  assert.deepEqual(result.quotes_missing, []);
  assert.deepEqual(checkClaim("“not there”", source).quotes_missing, ["not there"]);
});

test("backtick identifiers are quotes", () => {
  const result = checkClaim("Calls `redact` and `nopeFn` here", "export function redact() {}");
  assert.deepEqual(result.quotes, ["redact", "nopeFn"]);
  assert.deepEqual(result.quotes_missing, ["nopeFn"]);
});

test("apostrophes and short quotes are not quotes", () => {
  assert.deepEqual(checkClaim("It's the user's 'thing' and don't", "x").quotes, []);
  assert.deepEqual(checkClaim('Say "ok" or `a`', "x").quotes, []);
});

test("numbers present and missing", () => {
  const result = checkClaim("It scored 0.52 on 40 cases and cost 37", "score 0.52 over 40 cases");
  assert.deepEqual(result.numbers, ["0.52", "40", "37"]);
  assert.deepEqual(result.numbers_missing, ["37"]);
});

test("thousands separators and trailing zeros", () => {
  assert.deepEqual(checkClaim("1,024 items", "1024 items").numbers_missing, []);
  assert.deepEqual(checkClaim("1024 items", "1,024 items").numbers_missing, []);
  assert.deepEqual(checkClaim("ratio 0.50", "ratio 0.5").numbers_missing, []);
  assert.deepEqual(checkClaim("ratio 0.5", "ratio 0.50").numbers_missing, []);
});

test("whole-token matching only", () => {
  assert.deepEqual(checkClaim("20 runs", "120 runs").numbers_missing, ["20"]);
  assert.deepEqual(checkClaim("20 runs", "0.20 runs").numbers_missing, ["20"]);
  assert.deepEqual(checkClaim("20 runs", "ran 20 runs").numbers_missing, []);
  assert.deepEqual(checkClaim("20 runs", "sha256 and h20 and 20x").numbers_missing, []);
});

test("percentages, multipliers and currency", () => {
  const result = checkClaim("3.5% faster, 12.2x cheaper, $0.0007 each", "3.5 percent, 12.2 times, 0.0007 usd");
  assert.deepEqual(result.numbers, ["3.5%", "12.2x", "$0.0007"]);
  assert.deepEqual(result.numbers_missing, []);
  assert.deepEqual(checkClaim("99.9%", "3.5%").numbers_missing, ["99.9%"]);
});

test("dates and versions are single tokens", () => {
  const claim = "Shipped v0.1.1 and 2.1.286 on 2026-10-01";
  const result = checkClaim(claim, "released 0.1.1 / v2.1.286 at 2026-10-01T10:00");
  assert.deepEqual(result.numbers, ["v0.1.1", "2.1.286", "2026-10-01"]);
  assert.deepEqual(result.numbers_missing, []);
  assert.deepEqual(checkClaim("2026-10-01", "2026-10-02 and 2026").numbers_missing, ["2026-10-01"]);
  assert.deepEqual(checkClaim("v0.1.1", "v0.1.2").numbers_missing, ["v0.1.1"]);
  assert.deepEqual(checkClaim("in 2026", "in 2026").numbers, ["2026"]);
});

test("small bare integers are ignored", () => {
  const result = checkClaim("3 cases, 10 files, 11 rules, 5ms, 2x, 3.0, 4%, $5", "nothing");
  assert.deepEqual(result.numbers, ["11", "5", "2x", "3.0", "4%", "$5"]);
  assert.deepEqual(checkClaim("the 3rd case", "x").numbers, []);
});

test("numbers inside quotes are still reported", () => {
  const result = checkClaim('The log says "took 1,500 ms".', "took 1,500 ms");
  assert.deepEqual(result.quotes_missing, []);
  assert.deepEqual(result.numbers, ["1,500"]);
  assert.deepEqual(result.numbers_missing, []);
});

test("unbalanced quotes do not throw", () => {
  assert.deepEqual(checkClaim('He said "unfinished and more', "x").quotes, []);
  assert.deepEqual(checkClaim("“start only", "x").quotes, []);
  assert.deepEqual(checkClaim("only `tick", "x").quotes, []);
  assert.deepEqual(checkClaim('"a" "bcd" "', "bcd").quotes, ["bcd"]);
});

test("empty inputs", () => {
  const empty = { quotes: [], quotes_missing: [], numbers: [], numbers_missing: [] };
  assert.deepEqual(checkClaim("", ""), empty);
  assert.deepEqual(checkClaim("", "source 42"), empty);
  assert.deepEqual(checkClaim("plain words", ""), empty);
  assert.deepEqual(checkClaim('"abc" 42', "").quotes_missing, ["abc"]);
  assert.deepEqual(checkClaim('"abc" 42', "").numbers_missing, ["42"]);
});

test("large input stays fast", () => {
  const line = 'alpha beta 1,024 gamma 0.52 "quoted text" v1.2.3 2026-10-01 _x_ **y** 12.5% ';
  const source = line.repeat(Math.ceil(200_000 / line.length)).slice(0, 200_000);
  const claim = '"quoted text" 1024 0.52 v1.2.3 999 "missing words" `id` '.repeat(180).slice(0, 10_000);
  const adversarial = ["_".repeat(100_000), '"'.repeat(50_000), "“".repeat(50_000), "1.".repeat(50_000), "9".repeat(100_000)];
  const started = performance.now();
  const result = checkClaim(claim, source);
  for (const text of adversarial) {
    checkClaim(text, source);
    checkClaim(claim, text);
  }
  const elapsed = performance.now() - started;
  assert.ok(result.quotes_missing.includes("missing words"));
  assert.deepEqual(result.numbers_missing, ["999"]);
  assert.ok(elapsed < 2500, `took ${elapsed}ms`);
});
