# config loader

`loadConfig(dir, env, processEnv)` in `src/index.mjs` (named export) builds an application configuration. The helpers it uses live in `src/merge.mjs` (`deepMerge(base, override)`) and `src/env.mjs` (`applyEnv(config, processEnv)`), both named exports; both are tested on their own too. Example files are in `config/`.

## loadConfig

- `dir` is a directory holding `default.json` (required; a missing file throws) and `<env>.json` (optional; a missing file is fine). `env` defaults to `"development"`, `processEnv` to an empty object (it is never read from `process.env`)
- layers, later ones win: `default.json`, then `<env>.json`, then the environment variables
- the result is a new plain object; nothing that is passed in or read is modified

## deepMerge(base, override)

- plain objects are merged key by key, recursively; every other value, arrays included, is replaced as a whole (arrays are never concatenated)
- a `null` in `override` removes that key from the result
- neither argument is modified, and the result shares no nested objects or arrays with them

## applyEnv(config, processEnv)

- only variables whose names start with `APP_` are used, and what follows the prefix must not be empty
- the rest of the name is split on `__` (two underscores) into a path: `APP_DB__HOST` is `db.host`. Each part is matched case-insensitively against the keys that already exist at that level (`APP_DB__POOLSIZE` finds `db.poolSize`); a part that matches nothing is added in lower case
- the value is converted to the type of the value already at that path in `config`: a number is parsed with `Number` (a string that is not a number throws a TypeError), a boolean must be exactly `true` or `false` (anything else throws a TypeError), an array must be a JSON array (otherwise a TypeError), and everything else, including a path that does not exist yet, stays a string
- `config` is not modified; the result is a new object
