export function createApi({ store }) {
  return {
    getUser(id) {
      return store.get(id);
    },
    saveUser(user) {
      store.put(user.id, user);
      return user;
    },
    deleteUser(id) {
      return store.remove(id);
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
