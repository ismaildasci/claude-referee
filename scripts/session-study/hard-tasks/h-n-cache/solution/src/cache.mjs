export class TtlCache {
  #ttlMs;
  #now;
  #entries = new Map();

  constructor({ ttlMs, now = Date.now }) {
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  #live(entry) {
    return entry !== undefined && this.#now() < entry.at + this.#ttlMs;
  }

  set(key, value) {
    this.#entries.set(key, { at: this.#now(), value: structuredClone(value) });
  }

  get(key) {
    const entry = this.#entries.get(key);
    if (!this.#live(entry)) {
      this.#entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.value);
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this.#entries.delete(key);
  }

  clear() {
    this.#entries.clear();
  }

  get size() {
    for (const [key, entry] of this.#entries) if (!this.#live(entry)) this.#entries.delete(key);
    return this.#entries.size;
  }
}
