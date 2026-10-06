// Seeded repository-level split of the second real-log sample into dev and a frozen hold-out (docs/decisions/real-logs-2-split.md).
// Usage: node split2.mjs [TABLE.jsonl] [OUT.json]; reads repo and language only (no log text, no verdicts).

import { readFileSync, writeFileSync } from "node:fs";
import { holdoutHash, splitRepos } from "../done-bar/lib.mjs";

export const SEED2 = "real-logs-2-split-v1";
const [file = "docs/data/done-v2-real-2/table.jsonl", out = "docs/data/done-v2-real-2/split.json"] = process.argv.slice(2);
const table = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const part = splitRepos(table.map((r) => ({ repo: r.repo, language: r.language })), SEED2);
const ids = (p) => table.filter((r) => part.get(r.repo) === p).map((r) => r.id).sort();
const count = (p) => [...part.values()].filter((x) => x === p).length;
const split = {
  rule: "docs/decisions/real-logs-2-split.md: per language bucket, repositories ordered by sha256(seed:repo), even positions dev, odd positions hold-out",
  seed: SEED2,
  repos: Object.fromEntries([...part].sort(([a], [b]) => (a < b ? -1 : 1))),
  counts: { repos: { dev: count("dev"), holdout: count("holdout") }, cases: { dev: ids("dev").length, holdout: ids("holdout").length } },
  holdout_ids_sha256: holdoutHash(ids("holdout")),
  dev_ids: ids("dev"),
  holdout_ids: ids("holdout"),
};
writeFileSync(out, `${JSON.stringify(split, null, 1)}\n`);
console.log(`repos dev ${split.counts.repos.dev} / holdout ${split.counts.repos.holdout}; cases dev ${split.counts.cases.dev} / holdout ${split.counts.cases.holdout}; holdout sha ${split.holdout_ids_sha256}`);
