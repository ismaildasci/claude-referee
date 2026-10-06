// i18n real-code hold-out helpers: metadata filter, key resolution, call removal by position, the found rule, seeded order. No network.

import assert from "node:assert/strict";
import { test } from "node:test";
import { amendedMatch, fileNamespace, localeNamespace, matchFound, metadataVerdict, normalizeForMatch, resolveKey, seededOrder, stripHtml, stripScript, vueSections } from "../scripts/i18n-real/lib.mjs";

const ok = { fork: false, archived: false, license: "MIT", stars: 40, pushed_at: "2025-01-01T00:00:00Z" };

test("metadata filter follows the registered order of reasons", () => {
  assert.deepEqual(metadataVerdict(ok), { pass: true, why: "ok" });
  assert.equal(metadataVerdict({ ...ok, fork: true }).why, "fork");
  assert.equal(metadataVerdict({ ...ok, license: "GPL-3.0" }).why, "license");
  assert.equal(metadataVerdict({ ...ok, license: null }).why, "license");
  assert.equal(metadataVerdict({ ...ok, stars: 24 }).why, "stars");
  assert.equal(metadataVerdict({ ...ok, pushed_at: "2023-10-05T23:59:59Z" }).why, "pushed");
  assert.equal(metadataVerdict({ gone: true }).why, "gone");
});

test("locale namespaces come from the file name", () => {
  assert.equal(localeNamespace("src/locales/en.json"), "translation");
  assert.equal(localeNamespace("i18n/en-US.json"), "translation");
  assert.equal(localeNamespace("public/locales/en/common.json"), "common");
  assert.equal(localeNamespace("src/locales/de.json"), null);
  assert.equal(localeNamespace("src/locales/en.ts"), null);
});

test("key resolution: explicit namespace, file namespace with prefix, default, then a unique match", () => {
  const ns = [
    { name: "translation", data: { save: "Save", nested: { title: "Title" }, "flat.key": "Flat" } },
    { name: "common", data: { save: "Save it", menu: { open: "Open menu" } } },
    { name: "auth", data: { login: "Log in" } },
  ];
  assert.deepEqual(resolveKey("common:save", ns), { value: "Save it" });
  assert.deepEqual(resolveKey("save", ns, { ns: "common" }), { value: "Save it" });
  assert.deepEqual(resolveKey("open", ns, { ns: "common", keyPrefix: "menu" }), { value: "Open menu" });
  assert.deepEqual(resolveKey("save", ns), { value: "Save" });
  assert.deepEqual(resolveKey("nested.title", ns), { value: "Title" });
  assert.deepEqual(resolveKey("flat.key", ns), { value: "Flat" });
  assert.deepEqual(resolveKey("login", ns), { value: "Log in" });
  assert.deepEqual(resolveKey("missing", ns), { skip: "key_not_found" });
  assert.deepEqual(resolveKey("missing", ns, { ns: "auth" }), { skip: "key_not_found" });
  const two = [{ name: "a", data: { x: "One" } }, { name: "b", data: { x: "Two" } }];
  assert.deepEqual(resolveKey("x", two), { skip: "key_ambiguous" });
  assert.deepEqual(resolveKey("nested", ns), { skip: "key_not_found" });
});

test("file namespace only when exactly one is named", () => {
  assert.deepEqual(fileNamespace(`const { t } = useTranslation("common", { keyPrefix: "menu" });`), { ns: "common", keyPrefix: "menu" });
  assert.deepEqual(fileNamespace(`const { t } = useTranslation(["auth", "common"]);`), { ns: "auth" });
  assert.deepEqual(fileNamespace(`useTranslation("a"); useTranslation("b");`), {});
  assert.deepEqual(fileNamespace(`const { t } = useTranslation();`), {});
});

const dict: Record<string, string> = {
  save: "Save",
  hello: "Hello, {{name}}!",
  quote: 'Say "hi"',
  tag: "Click <b>here</b>",
  multi: "a\nb",
  vhello: "Hello {name}",
  search: "Search",
};
const resolve = (k: string): { value?: string; skip?: string } => {
  const v = dict[k];
  return v === undefined ? { skip: "key_not_found" } : { value: v };
};

test("react: JSX text, attribute, other expressions, placeholders", () => {
  const src = [
    `<button>{t("save")}</button>`,
    `<p>{t('hello')}</p>`,
    `<input placeholder={t("search")} title={t("hello")} />`,
    `toast(t("save")); const x = { label: t("hello") };`,
    `<p>{t("tag")}</p><a title={t("quote")}>x</a>`,
    `<p>{t("multi")}</p>{t(key)}`,
    `const y = t("nope"); foo.t("save"); split("save")`,
    `<span>{t("save",`,
  ].join("\n");
  const r = stripScript("src/A.tsx", src, "react", resolve);
  const lines = r.source.split("\n");
  assert.equal(lines.length, 8);
  assert.equal(lines[0], `<button>Save</button>`);
  assert.equal(lines[1], `<p>Hello, {name}!</p>`);
  assert.equal(lines[2], "<input placeholder=\"Search\" title={`Hello, ${name}!`} />");
  assert.equal(lines[3], "toast(\"Save\"); const x = { label: `Hello, ${name}!` };");
  assert.equal(lines[4], `<p>{t("tag")}</p><a title={t("quote")}>x</a>`);
  assert.equal(lines[6], `const y = t("nope"); foo.t("save"); split("save")`);
  assert.deepEqual(r.sites.map((s) => [s.line, s.position, s.key]), [
    [1, "jsx-text", "save"], [2, "jsx-text", "hello"], [3, "jsx-attr", "hello"], [3, "jsx-attr", "search"], [4, "expr", "hello"], [4, "expr", "save"],
  ]);
  const reasons = r.skips.map((s) => `${s.line}:${s.reason}`).sort();
  assert.deepEqual(reasons, ["5:unwritable", "5:unwritable", "6:dynamic_key", "6:newline", "7:key_not_found", "8:multi_line"]);
});

test("react: a .ts file has no JSX, and an arrow block is not JSX text", () => {
  assert.equal(stripScript("a.ts", `if (x) {t("save")}`, "react", resolve).source, `if (x) {"save"}`.replace('"save"', '"Save"'));
  const r = stripScript("a.jsx", `const f = () => {t("save")}`, "react", resolve);
  assert.equal(r.source, `const f = () => {"Save"}`);
  assert.equal(r.sites[0]?.position, "expr");
});

test("vue: sections, mustache, bound attribute, other bindings, script", () => {
  const src = [
    `<template>`,
    `  <h1>{{ $t('save') }}</h1>`,
    `  <p>{{ $t("vhello") }}</p>`,
    `  <input :placeholder="$t('search')" v-bind:title="$t('vhello')" />`,
    `  <b :title="ok ? $t('save') : ''">{{ t('save') + '!' }}</b>`,
    `</template>`,
    `<script setup>`,
    `const m = this.$t("save"); alert(i18n.global.t('vhello'))`,
    `</script>`,
    `<style>.a { content: "$t('save')" }</style>`,
  ].join("\n");
  assert.deepEqual(vueSections(src.split("\n")), ["template", "template", "template", "template", "template", "template", "other", "script", "other", "other"]);
  const r = stripScript("src/A.vue", src, "vue", resolve);
  const lines = r.source.split("\n");
  assert.equal(lines[1], `  <h1>Save</h1>`);
  assert.equal(lines[2], `  <p>Hello {{ name }}</p>`);
  assert.equal(lines[3], "  <input placeholder=\"Search\" v-bind:title=\"`Hello ${name}`\" />");
  assert.equal(lines[4], `  <b :title="ok ? 'Save' : ''">{{ 'Save' + '!' }}</b>`);
  assert.equal(lines[7], "const m = \"Save\"; alert(`Hello ${name}`)");
  assert.equal(lines[9], `<style>.a { content: "$t('save')" }</style>`);
  assert.deepEqual(r.sites.map((s) => s.position), ["vue-text", "vue-text", "vue-binding", "vue-attr", "vue-binding", "vue-binding", "expr", "expr"]);
});

test("html: plain keys set text, [attr] keys set the attribute, the rest is skipped", () => {
  const src = [
    `<h1 class="t" data-i18n="save">Old</h1>`,
    `<input type="text" data-i18n="[placeholder]search">`,
    `<input data-i18n="[placeholder]search" placeholder="x" />`,
    `<div data-i18n="save">`,
    `<p data-i18n="tag">x</p><p data-i18n="nope">y</p><p data-i18n="a;b">z</p>`,
  ].join("\n");
  const r = stripHtml("index.html", src, resolve);
  const lines = r.source.split("\n");
  assert.equal(lines[0], `<h1 class="t">Save</h1>`);
  assert.equal(lines[1], `<input type="text" placeholder="Search">`);
  assert.equal(lines[2], `<input placeholder="Search" />`);
  assert.equal(lines[3], `<div data-i18n="save">`);
  assert.deepEqual(r.sites.map((s) => [s.line, s.position]), [[1, "html-text"], [2, "html-attr"], [3, "html-attr"]]);
  assert.deepEqual(r.skips.map((s) => `${s.line}:${s.reason}`), ["4:multi_line", "5:unwritable", "5:key_not_found", "5:unwritable"]);
});

test("found rule: placeholders removed, whitespace collapsed, containment, empty values never match", () => {
  assert.equal(normalizeForMatch("Hello {{ name }},\n  welcome ${x} {y}"), "Hello , welcome");
  assert.equal(matchFound("Hello {name}!", "Hello, {{name}}!"), false);
  assert.equal(matchFound("Hello, {name}!", "Hello, {{name}}!"), true);
  assert.equal(matchFound("Total: Save now", "Save"), true);
  assert.equal(matchFound("anything", "{{count}}"), false);
});

test("seeded order is stable and depends on the seed", () => {
  const ids = ["a", "b", "c", "d", "e"];
  assert.deepEqual(seededOrder(ids), seededOrder([...ids].reverse()));
  assert.notDeepEqual(seededOrder(ids), seededOrder(ids, "other-seed"));
});

test("amended found rule: nearest new candidate within 20 lines above, never one the clone already had", () => {
  const site = { file: "a.tsx", line: 24, position: "jsx-text", key: "k", value: "Remove token" };
  const c = (line: number, text: string, file = "a.tsx") => ({ file, line, text, id: `${file}:${line}` });
  assert.deepEqual(amendedMatch(site, [c(21, "{x} Remove token"), c(18, "Remove token now")], new Set())?.map((x) => x.line), [21]);
  assert.equal(amendedMatch(site, [c(3, "Remove token")], new Set()), null);
  assert.equal(amendedMatch(site, [c(25, "Remove token")], new Set()), null);
  assert.equal(amendedMatch(site, [c(21, "Remove token", "b.tsx")], new Set()), null);
  assert.equal(amendedMatch(site, [c(24, "Remove token")], new Set(["a.tsx\u000024\u0000Remove token"])), null);
});
