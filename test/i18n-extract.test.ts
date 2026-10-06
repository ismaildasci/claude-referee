// i18n: the candidate extractor on synthetic samples, the extract command, per-item judge context and the i18n pack.

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { commands } from "../src/cli/commands/index.ts";
import { parseItems } from "../src/cli/commands/judge.ts";
import { extractFile, looksTechnical } from "../src/engine/i18n-extract.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const found = (path: string, source: string): string[] => extractFile(path, source).map((c) => `${c.kind}:${c.text}`);

const TSX = `import React from "react";
import { t } from "i18next";
export function Form({ user, loading, error }) {
  toast.error("Could not save your profile.");
  console.log("Server started on port");
  logger.info({ message: "Retrying request now" });
  toast(t("Saved the thing"));
  alert(\`Hello \${user.name}, welcome\`);
  document.title = "Inbox page";
  const items = [{ label: "Settings", href: "/settings" }, { title: "ERR_CODE" }];
  const re = /<b>hello<\\/b>/g;
  return (
    <div className="card p-4 flex-row" id="main-panel">
      <h1>Welcome back, {user.name}!</h1>
      <input type="email" placeholder="Search products..." aria-label="Close dialog" data-testid="email-input" />
      <img src={logo} alt="Company logo" />
      <button onClick={save} title={loading ? "Saving..." : "Save"}>
        Save changes
      </button>
      <p>{loading ? "Loading..." : "Done"}</p>
      <Trans>Hello <b>world</b></Trans>
      <code>npm install foo</code>
      <span>{t("already translated")}</span>
      <span>{intl.formatMessage({ id: "a", defaultMessage: "Default text" })}</span>
      <a href="/terms">Terms of service</a>
      <>{error && "Something went wrong"}</>
    </div>
  );
}
`;

test("JSX and TSX: text, attributes, expression strings and UI calls are found, wrapped and technical strings are not", () => {
  assert.deepEqual(found("src/Form.tsx", TSX), [
    "ui-call:Could not save your profile.",
    "ui-call:Hello ${user.name}, welcome",
    "ui-assign:Inbox page",
    "ui-prop:Settings",
    "jsx-text:Welcome back, {user.name}!",
    "jsx-attr:Search products...",
    "jsx-attr:Close dialog",
    "jsx-attr:Company logo",
    "jsx-attr:Saving...",
    "jsx-attr:Save",
    "jsx-text:Save changes",
    "jsx-expr-string:Loading...",
    "jsx-expr-string:Done",
    "jsx-text:Terms of service",
    "jsx-expr-string:Something went wrong",
  ]);
});

test("a candidate carries file, line and where it sits; a second one on a line gets a suffix", () => {
  const all = extractFile("src/Form.tsx", TSX);
  const first = all[0];
  assert.equal(first?.id, "src/Form.tsx:4");
  assert.equal(first?.context, "src/Form.tsx:4 ui-call in toast.error(");
  assert.deepEqual(all.filter((c) => c.line === 15).map((c) => c.id), ["src/Form.tsx:15", "src/Form.tsx:15#2"]);
  assert.match(all.find((c) => c.text === "Save changes")?.context ?? "", /^src\/Form\.tsx:18 jsx-text in <button onClick=\{save\}/);
});

test("a .ts file is not read as JSX, so generics and comparisons stay code", () => {
  const ts = `const a = <T,>(x: T) => x;\nif (a < b && c > d) { toast.error("Upload failed, try again") }\nconst f = useState<string>("");\n`;
  assert.deepEqual(found("src/x.ts", ts), ["ui-call:Upload failed, try again"]);
});

test("object keys: UI keys count, other keys and strings inside translation or log calls do not", () => {
  const ts = `
notification.open({ message: "Upload complete", key: "upload-done", duration: 3 });
const menu = { label: "Settings", icon: "gear", name: "Settings page" };
t("welcome", { defaultValue: "Welcome back" });
logger.warn({ message: "Pool exhausted, waiting" });
it("shows the title", () => { expect(page.title).toBe("Home page"); });
const q = { text: "SELECT id FROM users WHERE id = $1", values: [1] };
`;
  assert.deepEqual(found("src/y.ts", ts), ["ui-prop:Upload complete", "ui-prop:Settings"]);
});

test("tagged templates of a translation function are skipped", () => {
  assert.deepEqual(found("src/z.ts", "toast.info(t`Saved ${n} items`);\nalert(`Plain ${n} items`);\n"), ["ui-call:Plain ${n} items"]);
});

test("Vue: template text and static attributes are found, bound, wrapped and code content is not; the script is scanned for UI calls", () => {
  const vue = `<template>
  <div class="a">
    <button @click="add" title="Remove item">Add to cart</button>
    <p v-if="!items.length">Your cart is empty</p>
    <span>{{ count }}</span>
    <span>{{ 'Sign in' }}</span>
    <span>{{ $t('x') }}</span>
    <input :placeholder="$t('y')" placeholder="Type a message" />
    <p v-t="'k'">Wrapped</p>
    <code>npm run build</code>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
const msg = ref("hello world");
notify({ title: "Upload complete" });
</script>
`;
  assert.deepEqual(found("src/A.vue", vue), ["vue-attr:Remove item", "vue-text:Add to cart", "vue-text:Your cart is empty", "vue-text:Sign in", "vue-attr:Type a message", "ui-prop:Upload complete"]);
});

test("HTML templates inside script elements are scanned; other scripts are not", () => {
  const html = `<script type="text/javascript">RED.nodes.registerType("ftp", { label: "Not me" });</script>
<script type="text/x-red" data-template-name="ftp">
  <div class="form-row">
    <label for="node-input-name"><i class="fa fa-tag"></i> <span>Connection name</span></label>
    <input type="text" id="node-input-name" placeholder="Leave empty for the host name">
    <label for="node-input-host"><span data-i18n="ftp.label.host"></span></label>
    <input type="text" id="node-input-port" data-i18n="[placeholder]ftp.placeholder.port">
  </div>
</script>
<script type="text/html" data-help-name="ftp"><p>Uploads a file to the server.</p><pre>ftp://host</pre></script>
<script type="text/markdown" data-help-name="ftp-md">Downloads a file from the server.</script>
<script type="module">document.title = "Also not me";</script>
<p>Outside text</p>`;
  assert.deepEqual(found("ftp.html", html), ["html-text:Connection name", "html-attr:Leave empty for the host name", "html-text:Uploads a file to the server.", "html-text:Outside text"]);
  assert.deepEqual(found("open.html", `<script type="text/template"><p>Never closed`), ["html-text:Never closed"]);
  assert.deepEqual(found("B.vue", `<template>\n  <div>\n    <script type="text/x-template" id="row"><span>Row label</span></script>\n  </div>\n</template>\n`), ["vue-text:Row label"]);
});

test("Vue: a mustache with braces in its expression is still a mustache, on one line or several", () => {
  const vue = `<template>
  <p>{{ $t('e', { x: 1 }) }}</p>
  <p>{{
    $t('global.form.valueMustBeBetween', {
      min: 0,
      max: 65535,
    })
  }}</p>
  <p>{{ fmt({ a: '}}' }) }} / {{ b }}</p>
  <p>Total: {{ sum({ a: 1 }) }} items</p>
  <p>{{ 'Literal text' }}</p>
</template>
`;
  assert.deepEqual(found("src/B.vue", vue), ["vue-text:Total: {{ sum({ a: 1 }) }} items", "vue-text:Literal text"]);
});

test("HTML: text, attributes, meta description and submit buttons are found; scripts, code, pre and translate markers are not", () => {
  const html = `<!doctype html><html><head><title>Pricing and plans</title>
<meta name="description" content="Plan your trips with friends">
<script>var x = "Not me";</script></head>
<body><h2>Contact us</h2><input type="submit" value="Send message"><img src="a.png" alt="Team photo">
<p translate="no">Acme</p><p data-i18n="k">Wrapped text</p><pre>git push origin main</pre>
<p i18n>Angular text</p><input placeholder="Name" i18n-placeholder>
<button class="btn btn-primary">Subscribe</button><select><option value="">Select a country</option></select></body></html>`;
  assert.deepEqual(found("public/index.html", html), [
    "html-text:Pricing and plans",
    "html-attr:Plan your trips with friends",
    "html-text:Contact us",
    "html-attr:Send message",
    "html-attr:Team photo",
    "html-text:Subscribe",
    "html-text:Select a country",
  ]);
});

test("technical strings are recognised, ordinary words and sentences are not", () => {
  for (const t of ["", "123", "·", "https://example.test/a", "/api/users", "./a/b", "logo.png", "btn-primary", "user.profile.name", "ERR_CONNECTION_REFUSED", "fooBarBaz", "#fff", "10px", "x-request-id", "^[a-z]+$", "SELECT id FROM users", "npm run build", "ECONNRESET", "a@b.test", "text-sm font-bold", "{count}"]) {
    assert.equal(looksTechnical(t), true, t);
  }
  for (const t of ["Save", "OK", "Name:", "Yes/No", "Loading...", "Welcome back, {user.name}!", "Order #{id} confirmed", "Press Ctrl+S to save", "sign-in required here", "cancel", "Éditer le profil", "保存"]) {
    assert.equal(looksTechnical(t), false, t);
  }
});

test("judge items accept a context of their own", () => {
  assert.deepEqual(parseItems('[{"id":"a:1","text":"Save","context":"a.tsx:1 jsx-text"},{"text":"x","context":"  "}]'), [{ id: "a:1", text: "Save", context: "a.tsx:1 jsx-text" }, { id: "2", text: "x" }]);
});

async function withJev<T>(fn: (url: string, requests: { state: unknown }[]) => Promise<T>): Promise<T> {
  const server = await fakeJev((r) => Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: (r.state as { item: string }).item.startsWith("Save") ? 0.95 : 0.03 }])));
  try {
    return await fn(server.url, server.requests);
  } finally {
    await server.close();
  }
}

test("extract writes judge items, then judge --pack i18n sends one request per item with its own context", async () => {
  const cwd = tempDir();
  mkdirSync(join(cwd, "src"));
  mkdirSync(join(cwd, "node_modules/x"), { recursive: true });
  writeFileSync(join(cwd, "src/Form.tsx"), `export const F = () => (<div><button className="b">Save changes</button><span id="k">user-id</span></div>);\nconsole.log("Booting the form");\n`);
  writeFileSync(join(cwd, "src/Form.test.tsx"), `toast("Test only text");\n`);
  writeFileSync(join(cwd, "node_modules/x/i.js"), `alert("Vendored text");\n`);
  const io = memoryIo({ cwd });
  const code = await run(["extract", ".", "--out", "items.jsonl"], io, commands);
  const summary = io.json();
  assert.equal(code, 0);
  assert.equal(summary["verdict"], "extracted");
  assert.deepEqual([summary["files"], summary["candidates"], summary["written"]], [1, 1, 1]);
  const lines = readFileSync(join(cwd, "items.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, string>);
  assert.deepEqual(lines, [{ id: "src/Form.tsx:1", text: "Save changes", context: "src/Form.tsx:1 jsx-text in <button className=\"b\">", kind: "jsx-text" }]);

  await withJev(async (url, requests) => {
    const jio = memoryIo({ cwd, env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: url, REFEREE_DATA_DIR: tempDir() } });
    const jcode = await run(["judge", "--pack", "i18n", "--question", "string.translatable", "--items", "items.jsonl", "--context", "shared"], jio, commands);
    const out = jio.json();
    assert.equal(jcode, 0);
    assert.equal(out["verdict"], "flagged");
    assert.deepEqual(out["flagged"], ["src/Form.tsx:1"]);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0]?.state, { item: "Save changes", context: "src/Form.tsx:1 jsx-text in <button className=\"b\">" });
  });
});

test("extract --limit and --offset page through the candidates, and it needs paths that exist", async () => {
  const cwd = tempDir();
  writeFileSync(join(cwd, "a.html"), "<p>First line here</p><p>Second line here</p><p>Third line here</p>");
  const io = memoryIo({ cwd });
  await run(["extract", "a.html", "--offset", "1", "--limit", "1"], io, commands);
  const out = io.json();
  assert.equal(out["candidates"], 3);
  assert.deepEqual((out["preview"] as { text: string }[]).map((p) => p.text), ["Second line here"]);
  const none = memoryIo({ cwd });
  assert.equal(await run(["extract", "missing"], none, commands), 1);
  assert.equal(none.json()["error"], "bad_input");
  const bad = memoryIo({ cwd });
  assert.equal(await run(["extract", "a.html", "--limit", "x"], bad, commands), 1);
});

test("the i18n pack lints clean and extends generic", async () => {
  const pack = join(dirname(fileURLToPath(import.meta.url)), "../plugins/claude-referee/packs/i18n");
  const io = memoryIo();
  assert.equal(await run(["lint-pack", pack], io, commands), 0);
  assert.equal(io.json()["verdict"], "clean");
  const meta = JSON.parse(readFileSync(join(pack, "pack.json"), "utf8")) as { extends: string; model: string };
  assert.deepEqual([meta.extends, meta.model], ["generic", "jev-1.13.0"]);
  const th = JSON.parse(readFileSync(join(pack, "thresholds.json"), "utf8")) as Record<string, Record<string, number>>;
  assert.equal(th["string.translatable"]?.["auto"], 0.9);
});

test("extractFile skips template strings inside raw JSX tags and mime types", () => {
  assert.deepEqual(found("a.tsx", "export const A = () => <style>{`.a { color: red }`}</style>;"), []);
  assert.deepEqual(found("a.ts", 'const x = { title: "application/json" };'), []);
  assert.equal(looksTechnical("text/html"), true);
  assert.equal(looksTechnical("Yes/No"), false);
});
