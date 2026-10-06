// Pure helpers of the i18n real-code hold-out (docs/decisions/i18n-pack-eval.md, amendment of 2026-10-06):
// metadata filter, English locale namespaces, key resolution, call removal by position, the "found" match rule, seeded order.
// Tested in test/i18n-real-lib.test.ts.

import { createHash } from "node:crypto";

export const LICENSES = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"]);
export const MIN_STARS = 25;
export const PUSHED_SINCE = "2023-10-06T00:00:00Z";
export const MIN_SITES = 40;
export const PER_ORIGIN = 25;
export const SEED = "i18n-real-v1";

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function metadataVerdict(m) {
  if (!m || m.gone) return { pass: false, why: "gone" };
  if (m.fork) return { pass: false, why: "fork" };
  if (m.archived) return { pass: false, why: "archived" };
  if (!LICENSES.has(m.license)) return { pass: false, why: "license" };
  if (!(m.stars >= MIN_STARS)) return { pass: false, why: "stars" };
  if (!(m.pushed_at >= PUSHED_SINCE)) return { pass: false, why: "pushed" };
  return { pass: true, why: "ok" };
}

const LOCALE_FILE = /(?:^|\/)(?:en|en-US|en_US)\.json$/;
const LOCALE_DIR = /(?:^|\/)(?:en|en-US|en_US)\/([^/]+)\.json$/;

// Namespace name of an English locale file, or null: en/<ns>.json gives <ns>, en.json (and en-US, en_US) gives "translation".
export function localeNamespace(rel) {
  const dir = LOCALE_DIR.exec(rel);
  if (dir) return dir[1];
  return LOCALE_FILE.test(rel) ? "translation" : null;
}

function lookup(data, key) {
  if (data === null || typeof data !== "object") return undefined;
  if (typeof data[key] === "string") return data[key];
  let node = data;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object" || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function distinct(values) {
  const found = [...new Set(values.filter((v) => v !== undefined))];
  if (found.length === 0) return { skip: "key_not_found" };
  if (found.length > 1) return { skip: "key_ambiguous" };
  return { value: found[0] };
}

// namespaces: [{ name, data }]; file: { ns?, keyPrefix? } from the source file. Order fixed by the registration.
export function resolveKey(key, namespaces, file = {}) {
  const names = new Set(namespaces.map((n) => n.name));
  const inNs = (name, k) => distinct(namespaces.filter((n) => n.name === name).map((n) => lookup(n.data, k)));
  const colon = key.indexOf(":");
  if (colon > 0 && names.has(key.slice(0, colon))) return inNs(key.slice(0, colon), key.slice(colon + 1));
  if (file.ns && names.has(file.ns)) return inNs(file.ns, file.keyPrefix ? `${file.keyPrefix}.${key}` : key);
  const fallback = names.has("translation") ? "translation" : names.size === 1 ? [...names][0] : null;
  if (fallback !== null) {
    const r = inNs(fallback, key);
    if (r.value !== undefined || r.skip === "key_ambiguous") return r;
  }
  return distinct(namespaces.map((n) => lookup(n.data, key)));
}

// The namespace a React file names with useTranslation/withTranslation, when it names exactly one.
export function fileNamespace(source) {
  const names = new Set();
  for (const m of source.matchAll(/\b(?:useTranslation|withTranslation)\(\s*\[?\s*(['"])([\w./-]+)\1/g)) names.add(m[2]);
  const prefixes = new Set([...source.matchAll(/\bkeyPrefix\s*:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]));
  const out = {};
  if (names.size === 1) out.ns = [...names][0];
  if (prefixes.size === 1) out.keyPrefix = [...prefixes][0];
  return out;
}

const NAMES = {
  react: ["i18next\\.t", "i18n\\.t", "t"],
  vue: ["i18n\\.global\\.t", "this\\.\\$t", "\\$t", "t"],
};
const callPattern = (framework) =>
  new RegExp(`(?<![\\w$.])(?:${NAMES[framework].join("|")})\\(\\s*(['"\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1\\s*(?:,(?:[^()]|\\([^()]*\\))*)?\\)`, "g");
const callStart = (framework) => new RegExp(`(?<![\\w$.])(?:${NAMES[framework].join("|")})\\(`, "g");

const I18NEXT_PH = /\{\{\s*([\w.]+)\s*\}\}/g;
const VUE_PH = /\{\s*([\w.]+)\s*\}/g;

function placeholderStyle(framework) {
  return framework === "vue" ? VUE_PH : I18NEXT_PH;
}

function hasPlaceholders(value, framework) {
  return new RegExp(placeholderStyle(framework).source).test(value);
}

function withoutPlaceholders(value, framework) {
  return value.replace(placeholderStyle(framework), "");
}

function templateLiteral(value, framework) {
  const parts = [];
  let last = 0;
  for (const m of value.matchAll(placeholderStyle(framework))) {
    parts.push(value.slice(last, m.index).replace(/[\\`]/g, (c) => `\\${c}`).replace(/\$\{/g, "\\${"), `\${${m[1]}}`);
    last = m.index + m[0].length;
  }
  parts.push(value.slice(last).replace(/[\\`]/g, (c) => `\\${c}`).replace(/\$\{/g, "\\${"));
  return `\`${parts.join("")}\``;
}

function stringLiteral(value, framework, quote = '"') {
  if (hasPlaceholders(value, framework)) return templateLiteral(value, framework);
  const escaped = value.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`);
  return `${quote}${escaped}${quote}`;
}

// One replacement on one line: the text to put in place of [start, end) and the position type, or a skip reason.
function replacement(line, start, end, value, framework, section, ext) {
  const left = line.slice(0, start);
  const right = line.slice(end);
  if (framework === "react") {
    const braced = /\{\s*$/.test(left) && /^\s*\}/.test(right);
    if (braced) {
      const outerStart = left.search(/\{\s*$/);
      const outerEnd = end + right.search(/\}/) + 1;
      const pre = left.slice(0, outerStart);
      const attr = /([A-Za-z_][-\w:.]*)\s*=\s*$/.exec(pre);
      if (attr) {
        if (hasPlaceholders(value, framework)) return { start: outerStart, end: outerEnd, text: `{${templateLiteral(value, framework)}}`, position: "jsx-attr" };
        if (value.includes('"')) return { skip: "unwritable" };
        return { start: outerStart, end: outerEnd, text: `"${value}"`, position: "jsx-attr" };
      }
      const jsxFile = [".tsx", ".jsx", ".js"].includes(ext);
      if (jsxFile && !/=>\s*$/.test(pre) && !/\)\s*$/.test(pre)) {
        if (/[<>{}]/.test(withoutPlaceholders(value, framework))) return { skip: "unwritable" };
        return { start: outerStart, end: outerEnd, text: value.replace(I18NEXT_PH, "{$1}"), position: "jsx-text" };
      }
    }
    return { start, end, text: stringLiteral(value, framework), position: "expr" };
  }
  if (section === "template") {
    const mustache = /\{\{\s*$/.exec(left);
    const close = /^\s*\}\}/.exec(right);
    if (mustache && close) {
      if (/[<>{}]/.test(withoutPlaceholders(value, framework))) return { skip: "unwritable" };
      return { start: mustache.index, end: end + close[0].length, text: value.replace(VUE_PH, "{{ $1 }}"), position: "vue-text" };
    }
    const bound = /(?:v-bind)?:([A-Za-z_][-\w]*)="\s*$/.exec(left);
    const quoteClose = /^\s*"/.exec(right);
    if (bound && quoteClose) {
      if (hasPlaceholders(value, framework)) return { start, end, text: templateLiteral(value, framework), position: "vue-binding" };
      if (value.includes('"')) return { skip: "unwritable" };
      return { start: bound.index, end: end + quoteClose[0].length, text: `${bound[1]}="${value}"`, position: "vue-attr" };
    }
    return { start, end, text: stringLiteral(value, framework, "'"), position: "vue-binding" };
  }
  return { start, end, text: stringLiteral(value, framework), position: "expr" };
}

// Vue single-file component sections by line: template, script, other.
export function vueSections(lines) {
  const out = lines.map(() => "other");
  let open = null;
  let tplStart = -1;
  let tplEnd = -1;
  lines.forEach((l, i) => {
    if (tplStart < 0 && /^<template[\s>]/.test(l)) tplStart = i;
    if (/^<\/template>/.test(l)) tplEnd = i;
  });
  if (tplStart >= 0 && tplEnd >= tplStart) for (let i = tplStart; i <= tplEnd; i += 1) out[i] = "template";
  lines.forEach((l, i) => {
    if (out[i] === "template") return;
    if (open === null && /^<script[\s>]/.test(l)) { open = "script"; if (/<\/script>/.test(l)) open = null; return; }
    if (open === "script") { if (/^<\/script>/.test(l)) open = null; else out[i] = "script"; }
  });
  return out;
}

// Removes translation calls from one JS/TS/JSX/Vue source. resolve(key) gives { value } or { skip }.
export function stripScript(rel, source, framework, resolve) {
  const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
  const lines = source.split("\n");
  const sections = ext === ".vue" ? vueSections(lines) : lines.map(() => "script");
  const sites = [];
  const skips = [];
  const out = lines.map((line, i) => {
    if (sections[i] === "other") return line;
    const full = [...line.matchAll(callPattern(framework))];
    const starts = [...line.matchAll(callStart(framework))].map((m) => m.index);
    for (const s of starts) {
      if (full.some((m) => m.index === s)) continue;
      const depth = [...line.slice(s)].reduce((d, c) => d + (c === "(" ? 1 : c === ")" ? -1 : 0), 0);
      skips.push({ file: rel, line: i + 1, reason: depth > 0 ? "multi_line" : "dynamic_key" });
    }
    const edits = [];
    for (const m of full) {
      const [, quote, key] = m;
      if (quote === "`" && key.includes("${")) { skips.push({ file: rel, line: i + 1, reason: "dynamic_key" }); continue; }
      const r = resolve(key);
      if (r.value === undefined) { skips.push({ file: rel, line: i + 1, reason: r.skip, key }); continue; }
      if (/[\r\n]/.test(r.value)) { skips.push({ file: rel, line: i + 1, reason: "newline", key }); continue; }
      const e = replacement(line, m.index, m.index + m[0].length, r.value, framework, sections[i], ext);
      if (e.skip) { skips.push({ file: rel, line: i + 1, reason: e.skip, key }); continue; }
      edits.push({ ...e, key, value: r.value });
    }
    edits.sort((a, b) => b.start - a.start);
    let text = line;
    let lastStart = Infinity;
    for (const e of edits) {
      if (e.end > lastStart) { skips.push({ file: rel, line: i + 1, reason: "overlap", key: e.key }); continue; }
      text = text.slice(0, e.start) + e.text + text.slice(e.end);
      lastStart = e.start;
      sites.push({ file: rel, line: i + 1, position: e.position, key: e.key, value: e.value });
    }
    return text;
  });
  return { source: out.join("\n"), sites, skips };
}

const VOID = new Set(["input", "img", "meta", "area", "br", "hr", "link", "source", "track", "wbr", "col", "embed"]);

// Removes data-i18n keys from one HTML file: plain keys set the element's text, [attr]key sets that attribute.
export function stripHtml(rel, source, resolve) {
  const lines = source.split("\n");
  const sites = [];
  const skips = [];
  const out = lines.map((line, i) => {
    let text = line;
    const seen = (line.match(/\sdata-i18n="/g) ?? []).length;
    let done = 0;
    text = text.replace(/<([A-Za-z][\w-]*)([^<>]*?)\sdata-i18n="([^"]*)"([^<>]*?)(\/?)>(?:([^<]*)<\/\1>)?/g, (all, tag, before, key, after, slash, content) => {
      const attrKey = /^\[([A-Za-z][\w-]*)\](.+)$/.exec(key);
      const fail = (reason) => { skips.push({ file: rel, line: i + 1, reason, key }); return all; };
      if (key.includes(";") || /^\[html\]/.test(key)) return fail("unwritable");
      const r = resolve(attrKey ? attrKey[2] : key);
      if (r.value === undefined) return fail(r.skip);
      if (/[\r\n]/.test(r.value)) return fail("newline");
      const attrs = `${before}${after}`;
      if (attrKey) {
        if (r.value.includes('"')) return fail("unwritable");
        const name = attrKey[1];
        const has = new RegExp(`\\s${name}="[^"]*"`);
        const set = has.test(attrs) ? attrs.replace(has, ` ${name}="${r.value}"`) : `${attrs} ${name}="${r.value}"`;
        done += 1;
        sites.push({ file: rel, line: i + 1, position: "html-attr", key, value: r.value });
        return content === undefined ? `<${tag}${set}${slash}>` : `<${tag}${set}>${content}</${tag}>`;
      }
      if (content === undefined || VOID.has(tag.toLowerCase())) return fail("multi_line");
      if (/[<>]/.test(r.value)) return fail("unwritable");
      done += 1;
      sites.push({ file: rel, line: i + 1, position: "html-text", key, value: r.value });
      return `<${tag}${attrs}>${r.value}</${tag}>`;
    });
    const failed = skips.filter((s) => s.line === i + 1 && s.file === rel).length;
    for (let k = done + failed; k < seen; k += 1) skips.push({ file: rel, line: i + 1, reason: "multi_line" });
    return text;
  });
  return { source: out.join("\n"), sites, skips };
}

// The registered "found" rule: placeholders removed, whitespace collapsed, value contained in the candidate text.
export function normalizeForMatch(text) {
  return text.replace(/\$\{[^}]*\}/g, " ").replace(/\{\{[^}]*\}\}/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
}

export function matchFound(candidateText, value) {
  const v = normalizeForMatch(value);
  return v !== "" && normalizeForMatch(candidateText).includes(v);
}

// Seeded order used for every sample: sha256(seed + ":" + id) ascending.
export function seededOrder(ids, seed = SEED) {
  return [...ids].sort((a, b) => {
    const ha = sha256(`${seed}:${a}`);
    const hb = sha256(`${seed}:${b}`);
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
}
