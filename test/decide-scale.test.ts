// decide-scale harness: seeded shuffles, fixed designs, order pools and the registered case set. No live API.

import assert from "node:assert/strict";
import { test } from "node:test";
import { designs, key, loadCases, mulberry32, neutralNames, orderPlan, permutations, seedOf, shuffled, validateCase } from "../scripts/decide-scale/lib.mjs";

test("seeded shuffle is deterministic and a permutation", () => {
  const a = shuffled(["a", "b", "c", "d", "e"], mulberry32(seedOf("x")));
  const b = shuffled(["a", "b", "c", "d", "e"], mulberry32(seedOf("x")));
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort(), ["a", "b", "c", "d", "e"]);
});

test("fixed designs: rotations form a Latin square and revrot reverses them", () => {
  const d = designs(["a", "b", "c", "d"]);
  for (let slot = 0; slot < 4; slot++) assert.equal(new Set(d.rot.map((o) => o[slot])).size, 4);
  assert.deepEqual(d.rot[0], ["a", "b", "c", "d"]);
  assert.deepEqual(d.rev, ["d", "c", "b", "a"]);
  assert.deepEqual(d.revrot[1], ["a", "d", "c", "b"]);
  assert.equal(new Set(d.fixed.map(key)).size, 8);
  assert.equal(permutations([1, 2, 3, 4]).length, 24);
});

test("registered case set: 203 valid decisions, pools disjoint from the fixed designs", () => {
  const cases = loadCases();
  assert.equal(cases.length, 203);
  assert.equal(new Set(cases.map((c) => c.id)).size, 203);
  let requests = 0;
  for (const c of cases) {
    assert.equal(validateCase(c.raw), null);
    const plan = orderPlan(c);
    const fixed = new Set(plan.fixed.map(key));
    assert.equal(new Set(plan.pool.map(key)).size, plan.pool.length);
    if (plan.n >= 5) {
      assert.equal(plan.pool.length, 24);
      assert.ok(plan.pool.every((o) => !fixed.has(key(o))));
      assert.ok(plan.extra.length > 0);
    } else assert.equal(plan.pool.length, plan.n === 3 ? 6 : 24);
    requests += plan.pool.length + plan.extra.length;
    assert.equal(new Set(Object.values(neutralNames(c))).size, c.authored.length);
  }
  assert.equal(requests, 4506);
});
