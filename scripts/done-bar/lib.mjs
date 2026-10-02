// Pure helpers of the split done-v2 bar (docs/decisions/done-bar-split.md): classes, clusters, per-class metrics, repository split, dev backlog.
// A cluster merges same-step rows (exit line ignored, label in the key) and takes its best class; the split is per language bucket, even positions dev.
// No network and no log text; tested in test/done-bar.test.ts.

import { createHash } from "node:crypto";
import { clopperPearson, upperOneSided } from "../real-ci/lib.mjs";

export const SEED = "done-bar-split-v1";
export const CLASSES = ["R", "E", "U"];
export const R_RECALL_MIN_N = 30;
const EXIT_LINE = /^.{0,60}?\bexit (?:code|status)\s*[:=]?\s*(-?\d+).*$/gim;
const sha = (text) => createHash("sha256").update(text).digest("hex");

export const classOfTrust = (trust) => (trust === "parsed" ? "R" : trust === "exit_code" ? "E" : "U");

export const clusterKey = (evidence, expected) => sha(`${expected}\n${evidence.replace(EXIT_LINE, "").split("\n").map((l) => l.trimEnd()).filter(Boolean).join("\n").trim()}`);

const rank = (c) => CLASSES.indexOf(c);

export function clusters(rows) {
  const map = new Map();
  for (const r of rows) {
    const c = map.get(r.cluster) ?? { cluster: r.cluster, cls: r.cls, expected: r.expected, members: [] };
    if (rank(r.cls) < rank(c.cls)) c.cls = r.cls;
    c.members.push(r);
    map.set(r.cluster, c);
  }
  return [...map.values()];
}

const ratio = (k, n) => ({ k, n, p: n ? k / n : null, ...clopperPearson(k, n) });

export function scoreClass(rows) {
  const sent = rows.filter((r) => !r.code_decided && r.status === "ok");
  const cs = clusters(sent);
  const miss = cs.filter((c) => c.expected === "missing");
  const met = cs.filter((c) => c.expected === "met");
  const wrong = miss.filter((c) => c.members.some((m) => m.verdict === "met")).length;
  const missHit = miss.filter((c) => c.members.every((m) => m.verdict === "missing")).length;
  const metHit = met.filter((c) => c.members.every((m) => m.verdict === "met")).length;
  return {
    cases: rows.length,
    code_decided: rows.filter((r) => r.code_decided).length,
    unusable: rows.filter((r) => !r.code_decided && r.status !== "ok").length,
    sent_cases: sent.length,
    clusters: cs.length,
    expected_met: met.length,
    expected_missing: miss.length,
    wrong_met: { k: wrong, n: miss.length, upper95_one_sided: upperOneSided(wrong, miss.length) },
    missing_recall: ratio(missHit, miss.length),
    met_recall: ratio(metHit, met.length),
  };
}

export function scoreByClass(rows) {
  const best = new Map();
  for (const r of rows) if (!best.has(r.cluster) || rank(r.cls) < rank(best.get(r.cluster))) best.set(r.cluster, r.cls);
  const assigned = rows.map((r) => ({ ...r, cls: best.get(r.cluster) }));
  const out = { all: scoreClass(assigned) };
  for (const c of CLASSES) out[c] = scoreClass(assigned.filter((r) => r.cls === c));
  return out;
}

export function verdictOfBar(score) {
  const wrong = Object.fromEntries(CLASSES.map((c) => [c, score[c].wrong_met.k]));
  const r = score.R.met_recall;
  const sentClusters = score.all.clusters;
  return {
    wrong_met_zero_each_class: CLASSES.every((c) => wrong[c] === 0),
    wrong_met_by_class: wrong,
    missing_recall_ok: score.all.missing_recall.p === null ? null : score.all.missing_recall.p >= 0.9,
    r_met_recall: r.n >= R_RECALL_MIN_N ? { evaluable: true, ok: r.p >= 0.9, n: r.n } : { evaluable: false, n: r.n },
    e_met_recall: { reported: score.E.met_recall.p, n: score.E.met_recall.n, bar: null },
    u_coverage: { clusters: score.U.clusters, share_of_sent_clusters: sentClusters ? score.U.clusters / sentClusters : null, expected_met: score.U.expected_met, met_never_given_by_design: true },
  };
}

export function splitRepos(repos, seed = SEED) {
  const byLang = new Map();
  for (const r of repos) byLang.set(r.language, [...(byLang.get(r.language) ?? []), r.repo]);
  const out = new Map();
  for (const [, list] of [...byLang.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    [...new Set(list)].sort((a, b) => { const x = sha(`${seed}:${a}`); const y = sha(`${seed}:${b}`); return x < y ? -1 : x > y ? 1 : 0; }).forEach((repo, i) => out.set(repo, i % 2 === 0 ? "dev" : "holdout"));
  }
  return out;
}

// Format: ids sorted with the default string sort, joined with "\n", no trailing newline, UTF-8, SHA-256 hex.
export const holdoutHash = (ids) => sha([...ids].sort().join("\n"));

// Pooled wrong-met bound over R and E only: U cannot give met by design, so its expected-missing clusters test nothing.
export function wrongMetExcludingU(score) {
  const k = score.R.wrong_met.k + score.E.wrong_met.k;
  const n = score.R.wrong_met.n + score.E.wrong_met.n;
  return { k, n, upper95_one_sided: upperOneSided(k, n) };
}

export function backlogOf(rows) {
  const by = {};
  for (const r of rows.filter((x) => !x.parsed)) {
    const b = (by[r.tool] ??= { tool: r.tool, purpose: r.purpose, cases: 0, expected_met: 0, repos: new Set() });
    if (r.expected === "met") b.expected_met += 1;
    b.cases += 1;
    b.repos.add(r.repo);
  }
  return Object.values(by).map((b) => ({ tool: b.tool, purpose: b.purpose, cases: b.cases, expected_met: b.expected_met, repos: b.repos.size })).sort((a, b) => b.expected_met - a.expected_met || b.cases - a.cases || b.repos - a.repos);
}
