// Step 3 of the i18n real-code hold-out: extract on the copies, the found rule, recall, the judge sample and the blind label files.
// Usage: node sample.mjs --out DIR [--split FILE --part dev|holdout] [--y N] [--o N] [--seed S]. Writes DIR/recall.json (all repositories) and, for the part
// (prefix "<part>-" when given), items.jsonl, leakage.json, blind/labeller-{1,2}.jsonl and keys/labeller-{1,2}.json. Defaults reproduce the first sample.

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractPaths } from "../../src/engine/i18n-extract.ts";
import { clopperPearson } from "../real-ci/lib.mjs";
import { amendedMatch, matchFound, normalizeForMatch, PER_ORIGIN, SEED, seededOrder } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const OUT = flag("out");
if (!OUT) throw new Error("--out DIR is required");
const PART = flag("part");
const SPLIT = PART ? JSON.parse(readFileSync(flag("split"), "utf8")).split : null;
const Y_CAP = Number(flag("y", String(PER_ORIGIN)));
const O_CAP = Number(flag("o", String(PER_ORIGIN)));
const SEED_ARG = flag("seed", SEED);
const prefix = PART ? `${PART}-` : "";
const slug = (repo) => repo.replace("/", "__");
const repos = JSON.parse(readFileSync(join(OUT, "repos.json"), "utf8"));
const rate = (k, n) => ({ k, n, share: n ? Number((k / n).toFixed(3)) : null, ci95: clopperPearson(k, n) });

const tally = () => ({ per_repo: {}, per_position: {}, pooled: null, pos: {}, k: 0, n: 0 });
const rules = { registered: tally(), amended: tally() };
const notEqual = {};
const items = [];
const fileOf = (c) => c.id.slice(0, c.id.lastIndexOf(":"));
for (const r of repos) {
  const s = slug(r.repo);
  const sites = readFileSync(join(OUT, "sites", `${s}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((x) => x.read);
  const { candidates } = extractPaths(join(OUT, "copies", s), ["."], { keepDuplicates: true });
  const unchanged = new Set(extractPaths(join(OUT, "clones", s), ["."], { keepDuplicates: true }).candidates.map((c) => `${fileOf(c)}\0${c.line}\0${c.text}`));
  const cands = candidates.map((c) => ({ ...c, file: fileOf(c) }));
  const byLine = new Map();
  for (const c of cands) {
    const k = `${c.file}:${c.line}`;
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push(c);
  }
  const matched = new Set();
  const amendedIds = new Set();
  const found = { registered: 0, amended: 0 };
  for (const site of sites) {
    const hits = (byLine.get(`${site.file}:${site.line}`) ?? []).filter((c) => matchFound(c.text, site.value));
    const amended = amendedMatch(site, cands, unchanged) ?? [];
    for (const c of hits) matched.add(c.id);
    for (const c of amended) amendedIds.add(c.id);
    for (const [rule, ok] of [["registered", hits.length > 0], ["amended", amended.length > 0]]) {
      const p = (rules[rule].pos[site.position] ??= { k: 0, n: 0 });
      p.n += 1;
      if (ok) { p.k += 1; found[rule] += 1; }
    }
    if (hits.length > 0) {
      const q = (notEqual[site.position] ??= { k: 0, n: 0 });
      q.n += 1;
      if (!hits.some((c) => normalizeForMatch(c.text) === normalizeForMatch(site.value))) q.k += 1;
    }
  }
  for (const rule of ["registered", "amended"]) {
    rules[rule].per_repo[r.repo] = rate(found[rule], sites.length);
    rules[rule].k += found[rule];
    rules[rule].n += sites.length;
  }
  rules.registered.per_repo[r.repo].candidates = candidates.length;
  rules.registered.per_repo[r.repo].matched_candidates = matched.size;
  const toItem = (c, origin) => ({ id: `${s}:${c.id}`, repo: r.repo, framework: r.framework, origin, contains_removed_value: amendedIds.has(c.id) || matched.has(c.id), kind: c.kind, text: c.text, context: c.context });
  const y = new Map(candidates.filter((c) => matched.has(c.id)).map((c) => [c.id, c]));
  const o = new Map(candidates.filter((c) => !matched.has(c.id)).map((c) => [c.id, c]));
  if (SPLIT && SPLIT[r.repo] !== PART) continue;
  for (const id of seededOrder([...y.keys()], SEED_ARG).slice(0, Y_CAP)) items.push(toItem(y.get(id), "Y"));
  for (const id of seededOrder([...o.keys()], SEED_ARG).slice(0, O_CAP)) items.push(toItem(o.get(id), "O"));
}
const recall = {};
for (const rule of ["registered", "amended"]) {
  const t = rules[rule];
  recall[rule] = { pooled: rate(t.k, t.n), per_repo: t.per_repo, per_position: Object.fromEntries(Object.entries(t.pos).map(([p, v]) => [p, rate(v.k, v.n)])) };
}
recall.registered_match_not_equal = Object.fromEntries(Object.entries(notEqual).map(([p, v]) => [p, rate(v.k, v.n)]));
writeFileSync(join(OUT, "recall.json"), `${JSON.stringify(recall, null, 1)}\n`);
writeFileSync(join(OUT, `${prefix}items.jsonl`), items.map((i) => JSON.stringify(i)).join("\n") + "\n");

const share = (list, test) => (list.length ? Number((list.filter(test).length / list.length).toFixed(3)) : null);
const leak = {};
for (const origin of ["Y", "O"]) {
  const list = items.filter((i) => i.origin === origin);
  const kinds = {};
  for (const i of list) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1;
  leak[origin] = {
    n: list.length,
    placeholder_text: share(list, (i) => /\{\{|\$\{/.test(i.text)),
    brace_text: share(list, (i) => /\{[^}]*\}/.test(i.text)),
    context_shows_translation_call: share(list, (i) => /(?<![\w$.])(?:\$?t|i18n\.t|i18next\.t)\(|data-i18n/.test(i.context)),
    kinds,
  };
}
writeFileSync(join(OUT, `${prefix}leakage.json`), `${JSON.stringify(leak, null, 1)}\n`);

mkdirSync(join(OUT, "blind"), { recursive: true });
mkdirSync(join(OUT, "keys"), { recursive: true });
for (const n of [1, 2]) {
  const keyed = items.map((i) => ({ key: randomBytes(4).toString("hex"), id: i.id, text: i.text, context: i.context }));
  if (new Set(keyed.map((k) => k.key)).size !== keyed.length) throw new Error("key collision; run again");
  keyed.sort((a, b) => (a.key < b.key ? -1 : 1));
  writeFileSync(join(OUT, "blind", `${prefix}labeller-${n}.jsonl`), keyed.map(({ key, text, context }) => JSON.stringify({ key, text, context })).join("\n") + "\n");
  writeFileSync(join(OUT, "keys", `${prefix}labeller-${n}.json`), `${JSON.stringify(Object.fromEntries(keyed.map((k) => [k.key, k.id])), null, 1)}\n`);
}
console.error(`recall registered ${rules.registered.k}/${rules.registered.n}, amended ${rules.amended.k}/${rules.amended.n}; items ${items.length} (Y ${items.filter((i) => i.origin === "Y").length}, O ${items.filter((i) => i.origin === "O").length})`);
