const key = (id) => `user:${id}`;

export function createApi({ store, cache }) {
  return {
    getUser(id) {
      const hit = cache.get(key(id));
      if (hit !== undefined) return hit;
      const user = store.get(id);
      if (user === undefined) return undefined;
      cache.set(key(id), user);
      return structuredClone(user);
    },
    saveUser(user) {
      store.put(user.id, structuredClone(user));
      cache.delete(key(user.id));
      return structuredClone(user);
    },
    deleteUser(id) {
      const had = store.remove(id);
      cache.delete(key(id));
      return had;
    },
    importUsers(users) {
      store.putMany(users.map((u) => structuredClone(u)));
      for (const user of users) cache.delete(key(user.id));
    },
    deleteByDomain(domain) {
      const ids = store.removeWhere((user) => user.email.endsWith(`@${domain}`));
      for (const id of ids) cache.delete(key(id));
      return ids;
    },
    listUsers() {
      return structuredClone(store.all());
    },
  };
}
