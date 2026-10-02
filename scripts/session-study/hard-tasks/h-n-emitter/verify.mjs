const { Emitter } = await load("src/emitter.mjs");
{
  const e = new Emitter();
  const seen = [];
  const second = () => seen.push("second");
  e.on("a", () => { seen.push("first"); e.off("a", second); });
  e.on("a", second);
  e.on("a", () => seen.push("third"));
  e.emit("a");
  assert.deepEqual(seen, ["first", "third"]);
  assert.equal(e.listenerCount("a"), 2);
}
{
  const e = new Emitter();
  const seen = [];
  e.on("a", () => { seen.push("one"); e.on("a", () => seen.push("late")); });
  e.emit("a");
  assert.deepEqual(seen, ["one"]);
  e.emit("a");
  assert.deepEqual(seen, ["one", "one", "late"]);
}
{
  const e = new Emitter();
  const seen = [];
  const off2 = e.on("a", () => seen.push("two"));
  e.on("a", () => { seen.push("one"); off2(); });
  e.emit("a");
  assert.deepEqual(seen, ["two", "one"]);
}
{
  const e = new Emitter();
  const seen = [];
  e.on("a", () => { seen.push("x"); throw new Error("boom"); });
  e.on("a", () => seen.push("y"));
  assert.throws(() => e.emit("a"), (err) => err instanceof Error && err.message === "boom" && !(err instanceof AggregateError));
  assert.deepEqual(seen, ["x", "y"]);
}
{
  const e = new Emitter();
  const e1 = new Error("one");
  const e2 = new TypeError("two");
  e.on("a", () => { throw e1; });
  e.on("a", () => {});
  e.on("a", () => { throw e2; });
  assert.throws(() => e.emit("a"), (err) => err instanceof AggregateError && err.errors.length === 2 && err.errors[0] === e1 && err.errors[1] === e2);
}
{
  const e = new Emitter();
  let n = 0;
  e.once("a", () => { n++; e.emit("a"); });
  e.emit("a");
  assert.equal(n, 1);
}
{
  const e = new Emitter();
  const seen = [];
  const f = () => seen.push("f");
  e.on("a", f);
  e.on("a", () => seen.push("mid"));
  e.on("a", f);
  e.off("a", f);
  e.emit("a");
  assert.deepEqual(seen, ["mid", "f"]);
  assert.equal(e.listenerCount("a"), 2);
}
{
  const e = new Emitter();
  const off = e.on("a", () => {});
  e.on("a", () => {});
  off();
  off();
  assert.equal(e.listenerCount("a"), 1);
  e.off("a", () => {});
  e.off("zzz", () => {});
  assert.equal(e.listenerCount("a"), 1);
  assert.equal(e.listenerCount("zzz"), 0);
}
{
  const e = new Emitter();
  assert.throws(() => e.on("a", 5), TypeError);
  assert.throws(() => e.once("a", null), TypeError);
  e.on("a", () => { e.off("a", () => {}); });
  const args = [];
  e.on("b", (...x) => args.push(x));
  assert.equal(e.emit("b", 1, "two"), true);
  assert.deepEqual(args, [[1, "two"]]);
}
{
  const e = new Emitter();
  let ran = false;
  e.on("a", () => { e.off("a", handler); });
  const handler = () => (ran = true);
  e.on("a", handler);
  assert.equal(e.emit("a"), true);
  assert.equal(ran, false);
  const f = new Emitter();
  f.once("x", () => {});
  assert.equal(f.emit("x"), true);
  assert.equal(f.emit("x"), false);
}
