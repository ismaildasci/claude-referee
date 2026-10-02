export class Emitter {
  #events = new Map();

  #list(event) {
    if (!this.#events.has(event)) this.#events.set(event, []);
    return this.#events.get(event);
  }

  #add(event, fn, once) {
    if (typeof fn !== "function") throw new TypeError("handler must be a function");
    const entry = { fn, once };
    this.#list(event).push(entry);
    return () => this.#remove(event, entry);
  }

  #remove(event, entry) {
    const list = this.#list(event);
    const i = list.indexOf(entry);
    if (i >= 0) list.splice(i, 1);
  }

  on(event, fn) {
    return this.#add(event, fn, false);
  }

  once(event, fn) {
    return this.#add(event, fn, true);
  }

  off(event, fn) {
    const entry = this.#list(event).find((e) => e.fn === fn);
    if (entry) this.#remove(event, entry);
  }

  emit(event, ...args) {
    const snapshot = [...this.#list(event)];
    for (const entry of snapshot) {
      if (entry.once) this.#remove(event, entry);
      entry.fn(...args);
    }
    return snapshot.length > 0;
  }

  listenerCount(event) {
    return this.#list(event).length;
  }
}
