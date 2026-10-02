// One-off: pins the delegation cases (repo, commit, path pattern, strata caps), fetches each repo, builds the labels and writes bench/cases-delegation.json.
// Usage: node bench/snapshot-delegation.mjs <cache dir>. The file holds counts and hashes only, never item texts.

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractItems, fetchRepo, itemsHash, sha256 } from "./delegation-items.mjs";

export const SEED = "20261002";
export const SPECS = [
  { id: "d-pytest", repo: "pytest-dev/pytest", sha: "2887015cade4757385308e7a7d8083557fc637e2", pathPattern: "^src/", tracked: 4, untracked: 26 },
  { id: "d-babel", repo: "babel/babel", sha: "7c1dcfac003791a7fee733ed13851a5cac1ccf1c", pathPattern: "^packages/[^/]+/src/", tracked: 12, untracked: 36 },
  { id: "d-node", repo: "nodejs/node", sha: "cfb6aa17494167f2358fb54890c99d76c2c25beb", pathPattern: "^lib/", tracked: 20, untracked: 30 },
  { id: "d-sklearn", repo: "scikit-learn/scikit-learn", sha: "2cc5fc9856675eb112bbd6640404027195741710", pathPattern: "^sklearn/", tracked: 24, untracked: 36 },
];

export function buildCases(cacheDir) {
  const cases = SPECS.map((spec) => {
    const items = extractItems(fetchRepo({ cacheDir, repo: spec.repo, sha: spec.sha }), { ...spec, seed: SEED });
    return { ...spec, n_items: items.length, n_tracked: items.filter((i) => i.label).length, items_sha256: itemsHash(items) };
  });
  return { rule: "tracked-todo-v1", seed: SEED, cases, hash: sha256(JSON.stringify(cases)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cacheDir = resolve(process.argv[2] ?? "");
  if (!process.argv[2]) throw new Error("usage: snapshot-delegation.mjs <cache dir>");
  const data = buildCases(cacheDir);
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "cases-delegation.json"), JSON.stringify(data, null, 1) + "\n");
  console.log(JSON.stringify({ hash: data.hash, cases: data.cases.map((c) => [c.id, c.n_items, c.n_tracked]) }));
}
