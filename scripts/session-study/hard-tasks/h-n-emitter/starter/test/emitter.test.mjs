import assert from "node:assert/strict";
import { test } from "node:test";
import { Emitter } from "../src/emitter.mjs";

test("on, emit, off", () => {
  const e = new Emitter();
  const seen = [];
  const f = (x) => seen.push(["f", x]);
  const g = (x) => seen.push(["g", x]);
  e.on("a", f);
  e.on("a", g);
  assert.equal(e.emit("a", 1), true);
  e.off("a", f);
  e.emit("a", 2);
  assert.deepEqual(seen, [["f", 1], ["g", 1], ["g", 2]]);
  assert.equal(e.emit("nobody"), false);
});

test("once and unsubscribe", () => {
  const e = new Emitter();
  let n = 0;
  e.once("a", () => n++);
  e.emit("a");
  e.emit("a");
  assert.equal(n, 1);
  const off = e.on("b", () => n++);
  off();
  e.emit("b");
  assert.equal(n, 1);
  assert.equal(e.listenerCount("b"), 0);
});
