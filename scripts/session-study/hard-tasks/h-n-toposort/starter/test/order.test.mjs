import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrder } from "../src/order.mjs";

test("a chain and a diamond", () => {
  assert.deepEqual(buildOrder({ c: ["b"], b: ["a"], a: [] }), ["a", "b", "c"]);
  assert.deepEqual(buildOrder({ d: ["b", "c"], b: ["a"], c: ["a"], a: [] }), ["a", "b", "c", "d"]);
});

test("a dependency that is not a key, and a cycle", () => {
  assert.deepEqual(buildOrder({ a: ["b"] }), ["b", "a"]);
  assert.throws(() => buildOrder({ a: ["b"], b: ["a"] }), /^Error: cycle: a, b$/);
});
