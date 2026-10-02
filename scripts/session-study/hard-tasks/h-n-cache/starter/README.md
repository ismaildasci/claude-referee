# user api with a cache

`src/store.mjs` is a stand-in for a database (do not change it): `new Store()` with `get(id)`, `put(id, user)`, `remove(id)`, `putMany(users)`, `removeWhere(predicate)` (returns the removed ids) and `all()`. It counts its reads in `store.reads` and, like a real client, hands out and keeps the very objects it is given.

`src/api.mjs` exports `createApi({ store, cache })` which returns `getUser(id)`, `saveUser(user)`, `deleteUser(id)`, `importUsers(users)`, `deleteByDomain(domain)` and `listUsers()`. Users look like `{ id, email, name }`. Today the api talks to the store directly.

## TtlCache (`src/cache.mjs`, named export)

- `new TtlCache({ ttlMs, now = Date.now })`; `now` returns the current time in milliseconds
- `set(key, value)` stores a copy of the value; `get(key)` returns a copy, or `undefined` when the key is missing or has expired. An entry set at time `t` is valid while `now() < t + ttlMs`, so at exactly `t + ttlMs` it is gone
- `delete(key)` removes a key, `clear()` removes everything, `has(key)` is `get(key) !== undefined`, and `size` counts only the entries that have not expired
- mutating a value that was passed to `set`, or one that came back from `get`, never changes what the cache holds

## The api

- `getUser(id)` reads through the cache under the key `user:<id>`: a cache hit does not touch the store; a miss reads the store, caches what it found and returns it. A user that is not found (`undefined`) is never cached
- the four operations that change users (`saveUser`, `deleteUser`, `importUsers`, `deleteByDomain`) keep the cache correct: after any of them `getUser` never returns old data for a user that was changed or deleted. `deleteByDomain(domain)` deletes the users whose email ends with `@` plus the domain, and returns the removed ids
- `listUsers()` is not cached and always reads the store
- every user the api returns, and every user it passes to the store, is a copy: changing an object you got from the api, or one you passed to it, must not change the store's data or the cache
