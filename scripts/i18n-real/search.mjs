// Step 1 of the i18n real-code hold-out (docs/decisions/i18n-pack-eval.md, amendment of 2026-10-06): search lists and metadata filter.
// Usage: node search.mjs --out DIR. Writes DIR/search-<framework>.json and DIR/metadata.json; clones nothing. Resumable.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { metadataVerdict } from "./lib.mjs";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : undefined;
if (!OUT) throw new Error("--out DIR is required");
mkdirSync(OUT, { recursive: true });

const SEARCHES = [
  { framework: "react", query: "useTranslation", extension: "tsx" },
  { framework: "vue", query: "$t(", extension: "vue" },
  { framework: "html", query: "data-i18n", extension: "html" },
];
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function gh(ghArgs) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return execFileSync("gh", ghArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const msg = String(error.stderr ?? error.message);
      if (/rate limit|abuse|secondary|403/i.test(msg)) { sleep(65_000); continue; }
      if (/404|Not Found/i.test(msg)) return null;
      if (attempt === 4) throw error;
      sleep(3_000);
    }
  }
  return null;
}

for (const s of SEARCHES) {
  const file = join(OUT, `search-${s.framework}.json`);
  if (existsSync(file)) continue;
  const raw = JSON.parse(gh(["search", "code", s.query, "--extension", s.extension, "--limit", "300", "--json", "repository,path"]));
  const repos = [];
  for (const hit of raw) if (!repos.includes(hit.repository.nameWithOwner)) repos.push(hit.repository.nameWithOwner);
  writeFileSync(file, `${JSON.stringify({ ...s, fetched_at: new Date().toISOString(), results: raw.length, repos }, null, 1)}\n`);
  console.error(`${s.framework}: ${raw.length} results, ${repos.length} repositories`);
}

const metaFile = join(OUT, "metadata.json");
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, "utf8")) : {};
for (const s of SEARCHES) {
  const list = JSON.parse(readFileSync(join(OUT, `search-${s.framework}.json`), "utf8"));
  for (const repo of list.repos) {
    if (meta[repo]) continue;
    const text = gh(["api", `repos/${repo}`]);
    const r = text === null ? null : JSON.parse(text);
    meta[repo] = r === null
      ? { gone: true }
      : { fork: r.fork, archived: r.archived, license: r.license?.spdx_id ?? null, stars: r.stargazers_count, pushed_at: r.pushed_at, default_branch: r.default_branch };
    writeFileSync(metaFile, `${JSON.stringify(meta, null, 1)}\n`);
  }
  const passing = list.repos.filter((repo) => metadataVerdict(meta[repo]).pass);
  console.error(`${s.framework}: ${passing.length} of ${list.repos.length} pass the metadata filter`);
}
