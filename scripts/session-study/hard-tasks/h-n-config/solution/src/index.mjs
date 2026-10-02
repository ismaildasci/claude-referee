import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { applyEnv } from "./env.mjs";
import { deepMerge } from "./merge.mjs";

const read = (file) => JSON.parse(readFileSync(file, "utf8"));

export function loadConfig(dir, env = "development", processEnv = {}) {
  let config = read(join(dir, "default.json"));
  const file = join(dir, `${env}.json`);
  if (existsSync(file)) config = deepMerge(config, read(file));
  return applyEnv(config, processEnv);
}
