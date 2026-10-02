const { TtlCache } = await load("src/cache.mjs");
const { createApi } = await load("src/api.mjs");
const { Store } = await load("src/store.mjs");
{
  let t = 0;
  const c = new TtlCache({ ttlMs: 1000, now: () => t });
  c.set("a", { v: 1 });
  t = 999;
  assert.deepEqual(c.get("a"), { v: 1 });
  assert.equal(c.has("a"), true);
  assert.equal(c.size, 1);
  t = 1000;
  assert.equal(c.get("a"), undefined);
  assert.equal(c.has("a"), false);
  assert.equal(c.size, 0);
  c.set("b", 1);
  t = 1500;
  c.set("c", 2);
  assert.equal(c.size, 2);
  t = 2000;
  assert.equal(c.size, 1);
  c.clear();
  assert.equal(c.size, 0);
  const o = { n: [1] };
  c.set("o", o);
  o.n.push(2);
  const got = c.get("o");
  got.n.push(3);
  assert.deepEqual(c.get("o"), { n: [1] });
  c.delete("o");
  assert.equal(c.get("o"), undefined);
  c.set("zero", 0);
  assert.equal(c.has("zero"), true);
}
const setup = () => {
  const clock = { t: 0 };
  const store = new Store();
  const cache = new TtlCache({ ttlMs: 60000, now: () => clock.t });
  return { clock, store, cache, api: createApi({ store, cache }) };
};
{
  const { api, store, clock } = setup();
  api.saveUser({ id: 1, email: "a@x.com", name: "A" });
  const before = store.reads;
  assert.deepEqual(api.getUser(1), { id: 1, email: "a@x.com", name: "A" });
  assert.equal(store.reads, before + 1);
  assert.deepEqual(api.getUser(1), { id: 1, email: "a@x.com", name: "A" });
  assert.equal(store.reads, before + 1);
  clock.t = 60000;
  api.getUser(1);
  assert.equal(store.reads, before + 2);
}
{
  const { api, store } = setup();
  assert.equal(api.getUser(9), undefined);
  assert.equal(api.getUser(9), undefined);
  assert.equal(store.reads, 2);
  api.saveUser({ id: 9, email: "n@x.com", name: "N" });
  assert.equal(api.getUser(9).name, "N");
}
{
  const { api } = setup();
  api.saveUser({ id: 1, email: "a@x.com", name: "A" });
  api.getUser(1);
  api.saveUser({ id: 1, email: "a@x.com", name: "A2" });
  assert.equal(api.getUser(1).name, "A2");
  api.deleteUser(1);
  assert.equal(api.getUser(1), undefined);
}
{
  const { api } = setup();
  api.importUsers([{ id: 1, email: "a@x.com", name: "A" }, { id: 2, email: "b@y.com", name: "B" }, { id: 3, email: "c@x.com", name: "C" }]);
  for (const id of [1, 2, 3]) api.getUser(id);
  api.importUsers([{ id: 2, email: "b@y.com", name: "B2" }]);
  assert.equal(api.getUser(2).name, "B2");
  const removed = api.deleteByDomain("x.com");
  assert.deepEqual(removed, [1, 3]);
  assert.equal(api.getUser(1), undefined);
  assert.equal(api.getUser(3), undefined);
  assert.equal(api.getUser(2).name, "B2");
  assert.deepEqual(api.deleteByDomain("nothing.com"), []);
}
{
  const { api, store } = setup();
  const mine = { id: 1, email: "a@x.com", name: "A", tags: ["t"] };
  api.saveUser(mine);
  mine.name = "changed";
  mine.tags.push("u");
  assert.deepEqual(store.get(1), { id: 1, email: "a@x.com", name: "A", tags: ["t"] });
  const first = api.getUser(1);
  first.name = "mutated";
  first.tags.push("v");
  assert.deepEqual(store.get(1), { id: 1, email: "a@x.com", name: "A", tags: ["t"] });
  const second = api.getUser(1);
  second.name = "again";
  assert.deepEqual(api.getUser(1), { id: 1, email: "a@x.com", name: "A", tags: ["t"] });
  const returned = api.saveUser({ id: 2, email: "b@x.com", name: "B" });
  returned.name = "zzz";
  assert.equal(store.get(2).name, "B");
  const list = api.listUsers();
  list[0].name = "listed";
  assert.equal(store.get(1).name, "A");
  const imported = [{ id: 5, email: "e@z.com", name: "E" }];
  api.importUsers(imported);
  imported[0].name = "late";
  assert.equal(store.get(5).name, "E");
}
{
  const { api, store } = setup();
  api.saveUser({ id: 1, email: "a@x.com", name: "A" });
  const reads = store.reads;
  api.listUsers();
  api.listUsers();
  assert.equal(store.reads, reads);
  store.put(1, { id: 1, email: "a@x.com", name: "direct" });
  assert.equal(api.listUsers()[0].name, "direct");
}
