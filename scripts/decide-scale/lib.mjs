// Pure helpers for the option-order scale study (docs/decisions/decide-order-scale.md): seeded orders, fixed designs, order pools, case loading. No I/O beyond reading case files.
// Registered rules live in the document; changing a seed or design here is a deviation to record there.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SOURCES = [
  { src: "close", file: "jev-evals/decide-close/cases.jsonl", shuffle: false },
  { src: "holdout", file: "jev-evals/decide/cases.jsonl", shuffle: false },
  { src: "a", file: "jev-evals/decide-scale/cases-a.jsonl", shuffle: true },
  { src: "b", file: "jev-evals/decide-scale/cases-b.jsonl", shuffle: true },
];
export const RANDOM_POOL = 24;
export const NAME_RULE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");
export const seedOf = (text) => parseInt(sha256(text).slice(0, 8), 16) >>> 0;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

export const key = (order) => order.join(",");
export const rotate = (order, i) => [...order.slice(i), ...order.slice(0, i)];

export function designs(written) {
  const n = written.length;
  const rot = Array.from({ length: n }, (_, i) => rotate(written, i));
  const revrot = rot.map((o) => [...o].reverse());
  return { rot, revrot, rev: [...written].reverse(), fixed: [...rot, ...revrot] };
}

export function validateCase(c) {
  if (typeof c?.id !== "string" || !c.id) return "id";
  if (typeof c.decision !== "string" || !c.decision.trim()) return "decision";
  if (typeof c.context !== "string" || !c.context.trim()) return "context";
  if (!Array.isArray(c.options) || c.options.length < 3 || c.options.length > 6) return "options 3 to 6";
  const names = c.options.map((o) => o?.name);
  if (!names.every((n) => typeof n === "string" && NAME_RULE.test(n) && !/^\d+$/.test(n))) return "option name";
  if (new Set(names).size !== names.length) return "duplicate name";
  if (!c.options.every((o) => typeof o.text === "string" && o.text.trim())) return "option text";
  return null;
}

export function loadCases(sources = SOURCES) {
  const out = [];
  for (const { src, file, shuffle } of sources) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const raw = JSON.parse(line);
      const bad = validateCase(raw);
      if (bad) throw new Error(`invalid case ${src}/${raw?.id}: ${bad}`);
      const id = `${src}/${raw.id}`;
      const authored = raw.options.map((o) => o.name);
      const written = shuffle ? shuffled(authored, mulberry32(seedOf(`decide-scale-written:${id}`))) : authored;
      out.push({ id, src, raw, authored, written, options: Object.fromEntries(raw.options.map((o) => [o.name, o.text])) });
    }
  }
  return out;
}

export function orderPlan(c) {
  const n = c.written.length;
  const d = designs(c.written);
  const fixedKeys = new Set(d.fixed.map(key));
  if (n <= 4) {
    const pool = permutations(c.written);
    return { n, pool, extra: [], fixed: d.fixed, poolKind: "all" };
  }
  const rng = mulberry32(seedOf(`decide-scale-R:${c.id}`));
  const seen = new Set(fixedKeys);
  const pool = [];
  while (pool.length < RANDOM_POOL) {
    const o = shuffled(c.written, rng);
    if (seen.has(key(o))) continue;
    seen.add(key(o));
    pool.push(o);
  }
  const extra = [];
  const added = new Set();
  for (const o of d.fixed) if (!added.has(key(o))) (added.add(key(o)), extra.push(o));
  return { n, pool, extra, fixed: d.fixed, poolKind: "random" };
}

export const neutralNames = (c) => Object.fromEntries(c.authored.map((name, i) => [name, `o${i + 1}`]));
