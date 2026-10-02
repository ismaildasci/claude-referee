import assert from "node:assert/strict";
import { test } from "node:test";
import { pageList } from "../src/pages.mjs";

test("middle of a long list", () => {
  assert.deepEqual(pageList(100, 10, 5), [1, "…", 4, 5, 6, "…", 10]);
});

test("short lists", () => {
  assert.deepEqual(pageList(30, 10, 1), [1, 2, 3]);
  assert.deepEqual(pageList(0, 10, 1), [1]);
});
