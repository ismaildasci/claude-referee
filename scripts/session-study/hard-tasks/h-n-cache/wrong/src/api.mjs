const key = (id) => `user:${id}`;

export function createApi({ store, cache }) {
  return {
    getUser(id) {
      const hit = cache.get(key(id));
      if (hit !== undefined) return hit;
      const user = store.get(id);
      cache.set(key(id), user);
      return user;
    },
    saveUser(user) {
      store.put(user.id, user);
      cache.delete(key(user.id));
      return user;
    },
    deleteUser(id) {
      const had = store.remove(id);
      cache.delete(key(id));
      return had;
    },
    importUsers(users) {
      store.putMany(users);
    },
    deleteByDomain(domain) {
      return store.removeWhere((user) => user.email.endsWith(`@${domain}`));
    },
    listUsers() {
      return store.all();
    },
  };
}
