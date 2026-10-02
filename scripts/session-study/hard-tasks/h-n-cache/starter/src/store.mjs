export class Store {
  #rows = new Map();
  reads = 0;

  get(id) {
    this.reads += 1;
    return this.#rows.get(id);
  }

  put(id, user) {
    this.#rows.set(id, user);
  }

  remove(id) {
    return this.#rows.delete(id);
  }

  putMany(users) {
    for (const user of users) this.#rows.set(user.id, user);
  }

  removeWhere(predicate) {
    const removed = [];
    for (const [id, user] of this.#rows) {
      if (predicate(user)) {
        this.#rows.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  all() {
    return [...this.#rows.values()];
  }
}
