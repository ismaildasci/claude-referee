// Scoring of the second real-log sample (docs/decisions/done-v2-real-logs-2.md): split-bar metrics per class with exact and repository-level intervals.
// Usage: node score2.mjs TABLE.jsonl; reads the table alone (no text, no network). Bootstrap: B=2000, seed sha256("done-v2-real-2-boot").

import { readFileSync } from "node:fs";
import { clopperPearson, sha256, upperOneSided } from "./lib.mjs";

const file = process.argv[2];
if (!file) throw new Error("usage: score2.mjs TABLE.jsonl");
const table = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const sent = table.filter((r) => !r.code_decided);
const B = 2000;
let state = parseInt(sha256("done-v2-real-2-boot").slice(0, 8), 16) >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
function ratio(rows, hit, den) {
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
  const wrongRepos = repos.filter((e) => e.k > 0).length;
  return {
    k,
    n: d.length,
    p: d.length ? k / d.length : null,
    exact95: clopperPearson(k, d.length),
    repos: repos.length,
    repo_bootstrap95: draws.length ? { lo: pct(draws, 0.025), hi: pct(draws, 0.975) } : null,
    repo_clustered: { repos_hit: wrongRepos, repos: repos.length, one_sided_upper95: upperOneSided(wrongRepos, repos.length) },
    one_sided_upper95: upperOneSided(k, d.length),
  };
}

const isMissing = (r) => r.expected === "missing";
const isMet = (r) => r.expected === "met";
const wrong = (r) => r.verdict === "met";
const classes = { R: sent.filter((r) => r.trust === "parsed"), E: sent.filter((r) => r.trust === "exit_code"), U: sent.filter((r) => r.trust === "unparsed") };
const mix = (rows) => rows.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] ?? 0) + 1), m), {});
const scored = sent.every((r) => r.verdict !== null);
const out = {
  jev_scored: scored,
  cases: table.length,
  repos: new Set(table.map((r) => r.repo)).size,
  duplicate_evidence_hashes: table.length - new Set(table.map((r) => r.evidence_sha256)).size,
  code_decided: { n: table.length - sent.length, all_missing: table.filter((r) => r.code_decided).every((r) => r.verdict === "missing") },
  sent: { n: sent.length, expected_met: sent.filter(isMet).length, expected_missing: sent.filter(isMissing).length, verdicts: mix(sent) },
  classes: Object.fromEntries(Object.entries(classes).map(([k, rows]) => [k, { n: rows.length, expected_met: rows.filter(isMet).length, expected_missing: rows.filter(isMissing).length, verdicts: mix(rows) }])),
};
if (scored) {
  out.bar1_wrong_met = { pooled: ratio(sent, wrong, isMissing), R: ratio(classes.R, wrong, isMissing), E: ratio(classes.E, wrong, isMissing), U: ratio(classes.U, wrong, isMissing) };
  out.bar1_passed = sent.filter((r) => isMissing(r) && wrong(r)).length === 0;
  out.wrong_met_ids = sent.filter((r) => isMissing(r) && wrong(r)).map((r) => r.id);
  const rMet = ratio(classes.R, wrong, isMet);
  out.bar2_met_recall_R = { ...rMet, bar: 0.9, evaluable: rMet.n >= 30, passed: rMet.n >= 30 ? rMet.p >= 0.9 : null };
  out.met_recall_E = ratio(classes.E, wrong, isMet);
  out.met_recall_pooled = ratio(sent, wrong, isMet);
  const missHit = (r) => r.verdict === "missing";
  const mr = ratio(sent, missHit, isMissing);
  out.missing_recall = { pooled: mr, R: ratio(classes.R, missHit, isMissing), E: ratio(classes.E, missHit, isMissing), bar: 0.9, passed: mr.p >= 0.9 };
}
const cov = (rows) => ratio(rows, (r) => r.trust === "parsed", () => true);
out.parsed_coverage = {
  overall: cov(sent),
  by_criterion: Object.fromEntries([...new Set(sent.map((r) => r.criterion))].sort().map((c) => [c, cov(sent.filter((r) => r.criterion === c))])),
  by_language: Object.fromEntries([...new Set(sent.map((r) => r.language))].sort().map((c) => [c, cov(sent.filter((r) => r.language === c))])),
};
const reach = (rows, exp) => `${rows.filter((r) => r.expected === exp && r.met_reachable).length}/${rows.filter((r) => r.expected === exp).length}`;
out.met_reachable_offline = { R_expected_met: reach(classes.R, "met"), R_expected_missing: reach(classes.R, "missing"), E_expected_met: reach(classes.E, "met"), E_expected_missing: reach(classes.E, "missing") };
console.log(JSON.stringify(out, null, 1));
