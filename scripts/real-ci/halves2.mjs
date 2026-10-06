// Per-half scoring of the second real-log sample (docs/decisions/real-logs-2-split.md): wrong met, met recall among parsed, parsed coverage, with exact and repository-level intervals.
// Usage: node halves2.mjs TABLE.jsonl [SPLIT.json]; reads the table alone (no text). Bootstrap: B=2000, seed sha256("real-logs-2-split-boot").

import { readFileSync } from "node:fs";
import { clopperPearson, sha256, upperOneSided } from "./lib.mjs";

const [file, splitFile = "docs/data/done-v2-real-2/split.json"] = process.argv.slice(2);
if (!file) throw new Error("usage: halves2.mjs TABLE.jsonl [SPLIT.json]");
const part = JSON.parse(readFileSync(splitFile, "utf8")).repos;
const table = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const B = 2000;
let state = parseInt(sha256("real-logs-2-split-boot").slice(0, 8), 16) >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];

function ratio(rows, den, hit) {
  const d = rows.filter(den);
  const k = d.filter(hit).length;
  const byRepo = new Map();
  for (const r of d) {
    const e = byRepo.get(r.repo) ?? { k: 0, n: 0 };
    e.n += 1;
    if (hit(r)) e.k += 1;
    byRepo.set(r.repo, e);
  }
  const repos = [...byRepo.values()];
  const draws = [];
  for (let b = 0; b < B && repos.length > 0; b += 1) {
    let kk = 0;
    let nn = 0;
    for (let i = 0; i < repos.length; i += 1) {
      const e = repos[Math.floor(rand() * repos.length)];
      kk += e.k;
      nn += e.n;
    }
    if (nn > 0) draws.push(kk / nn);
  }
  draws.sort((a, b) => a - b);
  const hitRepos = repos.filter((e) => e.k > 0).length;
  return { k, n: d.length, p: d.length ? Number((k / d.length).toFixed(3)) : null, exact95: clopperPearson(k, d.length), repos: repos.length, repo_bootstrap95: draws.length ? { lo: pct(draws, 0.025), hi: pct(draws, 0.975) } : null, one_sided_upper95: upperOneSided(k, d.length), repo_clustered: { repos_hit: hitRepos, repos: repos.length, one_sided_upper95: upperOneSided(hitRepos, repos.length) } };
}

const out = {};
for (const half of ["dev", "holdout", "all"]) {
  const rows = table.filter((r) => half === "all" || part[r.repo] === half);
  const sent = rows.filter((r) => !r.code_decided);
  const parsed = sent.filter((r) => r.parsed);
  out[half] = {
    cases: rows.length,
    repos: new Set(rows.map((r) => r.repo)).size,
    sent: sent.length,
    unscored_sent: sent.filter((r) => r.verdict === null).length,
    wrong_met: ratio(sent, (r) => r.expected === "missing", (r) => r.verdict === "met"),
    wrong_met_parsed: ratio(parsed, (r) => r.expected === "missing", (r) => r.verdict === "met"),
    met_recall_parsed: ratio(parsed, (r) => r.expected === "met", (r) => r.verdict === "met"),
    parsed_coverage: ratio(sent, () => true, (r) => r.parsed),
    verdicts: sent.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] ?? 0) + 1), m), {}),
  };
}
console.log(JSON.stringify(out, null, 1));
