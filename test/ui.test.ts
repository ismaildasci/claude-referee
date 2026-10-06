// The local dashboard: Host, Origin and token checks, label writes, excerpt handling, export traversal and shutdown on signal.
// The server runs in-process on a random port with a temp data directory; raw http is used so Host and Origin can be forged.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import { test } from "node:test";
import { Script } from "node:vm";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { writeCache } from "../src/engine/cache.ts";
import { projectId } from "../src/engine/datadir.ts";
import { appendReceipt, overruleReceipt, type Receipt } from "../src/engine/receipts.ts";
import { appendStop, labelsFile, readStops } from "../src/engine/stopgate/stops.ts";
import type { StopRecord } from "../src/engine/stopgate/types.ts";
import { startUi, type UiServer } from "../src/ui/server.ts";
import { APP_JS, INDEX_HTML } from "../src/ui/page.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const XSS = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

interface Reply {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: string;
}

function raw(port: number, options: { method?: string; path: string; headers?: Record<string, string>; body?: string }): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, method: options.method ?? "GET", path: options.path, headers: options.headers, setHost: false, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(options.body);
  });
}

function stop(id: string, project: string, extra: Partial<StopRecord> = {}): StopRecord {
  return {
    id,
    ts: "2026-09-29T09:06:00.000Z",
    session_id: "sess-ui",
    project,
    mode: "shadow",
    edits: 2,
    checks: 1,
    ms: 800,
    decision: { claims_done: 0.9, claims_verified: 0.1, verification_applies: 1, outcome: {}, would_block: true },
    task_excerpt: `add a page ${XSS}`,
    final_excerpt: `done ${XSS}`,
    ...extra,
  };
}

async function setup(): Promise<{ ui: UiServer; dataDir: string; cwd: string; project: string; get: (path: string, headers?: Record<string, string>) => Promise<Reply>; auth: Record<string, string> }> {
  const dataDir = tempDir();
  const cwd = tempDir();
  const home = tempDir();
  const project = projectId(cwd);
  appendStop(dataDir, stop("sone", project));
  appendStop(dataDir, stop("stwo", project, { decision: { claims_done: 0.2, claims_verified: 0.1, verification_applies: 1, outcome: {}, would_block: false } }));
  appendStop(dataDir, stop("sother", "otherproject1"));
  const ui = await startUi({ dataDir, cwd, home, env: { HOME: home }, now: () => Date.parse("2026-09-30T12:00:00Z") });
  const auth = { "x-referee-token": ui.token, host: `127.0.0.1:${ui.port}` };
  return { ui, dataDir, cwd, project, auth, get: (path, headers) => raw(ui.port, { path, headers: { ...auth, ...headers } }) };
}

test("binds 127.0.0.1 with a 128-bit token in the URL fragment", async () => {
  const s = await setup();
  try {
    assert.match(s.ui.token, /^[0-9a-f]{32}$/);
    assert.equal(s.ui.urlWithToken, `http://127.0.0.1:${s.ui.port}/#t=${s.ui.token}`);
    assert.equal(new URL(s.ui.urlWithToken).search, "");
  } finally {
    await s.ui.close();
  }
});

test("a wrong Host is rejected on every route, including the shell", async () => {
  const s = await setup();
  try {
    const hosts = ["evil.example", `evil.example:${s.ui.port}`, `localhost:${s.ui.port}`, "127.0.0.1", `127.0.0.1:${s.ui.port + 1}`, `127.0.0.1.evil.example:${s.ui.port}`];
    for (const path of ["/", "/app.js", "/api/queue", "/api/export?kind=stops"]) {
      for (const host of hosts) {
        const r = await raw(s.ui.port, { path, headers: { host, "x-referee-token": s.ui.token } });
        assert.equal(r.status, 403, `${host} ${path}`);
        assert.doesNotMatch(r.body, /add a page/);
      }
    }
  } finally {
    await s.ui.close();
  }
});

test("a wrong, null or missing Origin is rejected where it matters", async () => {
  const s = await setup();
  try {
    for (const origin of ["http://evil.example", "null", `http://localhost:${s.ui.port}`, `https://127.0.0.1:${s.ui.port}`, `http://127.0.0.1:${s.ui.port + 1}`]) {
      assert.equal((await s.get("/api/queue", { origin })).status, 403, origin);
      const post = await raw(s.ui.port, { method: "POST", path: "/api/label", headers: { ...s.auth, origin, "content-type": "application/json" }, body: JSON.stringify({ id: "sone", label: "right" }) });
      assert.equal(post.status, 403, origin);
    }
    const noOrigin = await raw(s.ui.port, { method: "POST", path: "/api/label", headers: { ...s.auth, "content-type": "application/json" }, body: JSON.stringify({ id: "sone", label: "right" }) });
    assert.equal(noOrigin.status, 403);
    assert.equal((await s.get("/api/queue", { "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal(existsSync(labelsFile(s.dataDir)), false);
    assert.equal((await s.get("/api/queue", { origin: s.ui.origin, "sec-fetch-site": "same-origin" })).status, 200);
  } finally {
    await s.ui.close();
  }
});

test("a missing or wrong token is rejected on every API route", async () => {
  const s = await setup();
  try {
    const host = s.auth["host"] ?? "";
    const bad = [undefined, "", "0".repeat(32), s.ui.token.slice(0, -1), s.ui.token + "0", s.ui.token.toUpperCase()];
    for (const path of ["/api/flow", "/api/queue", "/api/overview", "/api/privacy", "/api/export?kind=stops"]) {
      for (const token of bad) {
        const r = await raw(s.ui.port, { path, headers: token === undefined ? { host } : { host, "x-referee-token": token } });
        assert.equal(r.status, 401, `${path} ${String(token)}`);
        assert.doesNotMatch(r.body, /add a page/);
      }
    }
    const viaQuery = await raw(s.ui.port, { path: `/api/queue?token=${s.ui.token}`, headers: { host } });
    assert.equal(viaQuery.status, 401);
    const post = await raw(s.ui.port, { method: "POST", path: "/api/label", headers: { host, origin: s.ui.origin, "content-type": "application/json", "x-referee-token": "nope" }, body: JSON.stringify({ id: "sone", label: "right" }) });
    assert.equal(post.status, 401);
    assert.equal(existsSync(labelsFile(s.dataDir)), false);
  } finally {
    await s.ui.close();
  }
});

test("a valid label is written to labels.jsonl and leaves the queue; bad ones are refused", async () => {
  const s = await setup();
  try {
    const before = JSON.parse((await s.get("/api/queue")).body) as { total: number; stops: { id: string }[] };
    assert.deepEqual(before.stops.map((x) => x.id), ["sone"]);
    const post = (body: string, type = "application/json") => raw(s.ui.port, { method: "POST", path: "/api/label", headers: { ...s.auth, origin: s.ui.origin, "content-type": type }, body });
    assert.equal((await post(JSON.stringify({ id: "sone", label: "maybe" }))).status, 400);
    assert.equal((await post(JSON.stringify({ id: "../x", label: "right" }))).status, 400);
    assert.equal((await post("not json")).status, 400);
    assert.equal((await post(JSON.stringify({ id: "sone", label: "right" }), "text/plain")).status, 415);
    assert.equal((await post(JSON.stringify({ id: "stwo", label: "right" }))).status, 404);
    assert.equal((await post(JSON.stringify({ id: "sother", label: "right" }))).status, 404);
    assert.equal((await post(JSON.stringify({ id: "missing", label: "right" }))).status, 404);
    assert.equal((await post("x".repeat(5000))).status, 413);
    assert.equal(existsSync(labelsFile(s.dataDir)), false);
    const ok = await post(JSON.stringify({ id: "sone", label: "wrong" }));
    assert.equal(ok.status, 200);
    const lines = readFileSync(labelsFile(s.dataDir), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { id: string; label: string; labelled_at: string });
    assert.equal(lines.length, 1);
    assert.deepEqual({ id: lines[0]?.id, label: lines[0]?.label, at: lines[0]?.labelled_at }, { id: "sone", label: "wrong", at: "2026-09-30T12:00:00.000Z" });
    assert.equal(readStops(s.dataDir).find((r) => r.id === "sone")?.label, "wrong");
    const after = JSON.parse((await s.get("/api/queue")).body) as { total: number };
    assert.equal(after.total, 0);
  } finally {
    await s.ui.close();
  }
});

test("the weak hint is shown in the queue and never applied as a label", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const home = tempDir();
  const project = projectId(cwd);
  const dir = join(home, ".claude", "projects", cwd.replace(/[^A-Za-z0-9]/g, "-"));
  mkdirSync(dir, { recursive: true });
  const line = (type: string, ts: string, content: unknown) => JSON.stringify({ type, timestamp: ts, message: { role: type, content } });
  writeFileSync(join(dir, "sess-ui.jsonl"), [line("user", "2026-09-29T09:00:00.000Z", "add a login page"), line("assistant", "2026-09-29T09:05:00.000Z", [{ type: "text", text: "done" }]), line("user", "2026-09-29T10:30:00.000Z", "it is broken, the page crashes")].join("\n") + "\n");
  appendStop(dataDir, stop("shint", project));
  const ui = await startUi({ dataDir, cwd, home, env: { HOME: home }, now: () => 0 });
  try {
    const r = await raw(ui.port, { path: "/api/queue", headers: { host: `127.0.0.1:${ui.port}`, "x-referee-token": ui.token } });
    const body = JSON.parse(r.body) as { stops: { suggestion: unknown }[] };
    assert.deepEqual(body.stops[0]?.suggestion, { label: "right", reason: "reported_broken", source: "next_message" });
    assert.doesNotMatch(r.body, /page crashes/);
    assert.equal(existsSync(labelsFile(dataDir)), false);
    assert.equal(readStops(dataDir)[0]?.label, undefined);
  } finally {
    await ui.close();
  }
});

test("excerpts only ever leave as JSON or a download, and the page never parses HTML", async () => {
  const s = await setup();
  try {
    for (const path of ["/api/flow", "/api/queue", "/api/overview", "/api/privacy", "/api/export?kind=stops", "/api/export?kind=receipts", "/api/export?kind=labels", "/api/nope", "/nope"]) {
      const r = await s.get(path);
      const type = String(r.headers["content-type"]);
      assert.doesNotMatch(type, /html/, path);
      assert.equal(r.headers["x-content-type-options"], "nosniff", path);
    }
    const queue = await s.get("/api/queue");
    assert.match(String(queue.headers["content-type"]), /^application\/json/);
    const parsed = JSON.parse(queue.body) as { stops: { task_excerpt: string }[] };
    assert.ok(parsed.stops[0]?.task_excerpt.includes(XSS));
    assert.equal((await s.get("/api/privacy")).body.includes("onerror"), false);
    assert.doesNotMatch(APP_JS, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|srcdoc/);
    assert.doesNotThrow(() => new Script(APP_JS));
    assert.doesNotMatch(INDEX_HTML,/<script>|onclick=|style=|https?:\/\//);
    const shell = await s.get("/");
    assert.match(String(shell.headers["content-type"]), /^text\/html/);
    assert.equal(shell.body.includes("add a page"), false);
    for (const path of ["/", "/app.js", "/app.css", "/api/queue"]) {
      const h = (await s.get(path)).headers;
      assert.match(String(h["content-security-policy"]), /default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'/);
      assert.equal(h["referrer-policy"], "no-referrer");
      assert.equal(h["cache-control"], "no-store");
      assert.equal(h["access-control-allow-origin"], undefined);
    }
  } finally {
    await s.ui.close();
  }
});

test("there is no CORS: preflights are refused and no allow header is ever sent", async () => {
  const s = await setup();
  try {
    const pre = await raw(s.ui.port, { method: "OPTIONS", path: "/api/label", headers: { host: `127.0.0.1:${s.ui.port}`, origin: "http://evil.example", "access-control-request-method": "POST" } });
    assert.equal(pre.status, 405);
    assert.equal(pre.headers["access-control-allow-origin"], undefined);
  } finally {
    await s.ui.close();
  }
});

test("export takes a kind from an allow-list and never a path", async () => {
  const s = await setup();
  try {
    const stops = await s.get("/api/export?kind=stops");
    assert.equal(stops.status, 200);
    assert.match(String(stops.headers["content-disposition"]), /^attachment; filename="claude-referee-stops\.jsonl"$/);
    const rows = stops.body.trim().split("\n").map((l) => JSON.parse(l) as { id: string });
    assert.deepEqual(rows.map((r) => r.id).sort(), ["sone", "stwo"]);
    for (const kind of ["../../etc/passwd", "..%2f..%2fetc%2fpasswd", "/etc/passwd", "stops/../../x", "stops.jsonl", "receipts%00", "", "all", "labels%26kind%3Dx"]) {
      const r = await s.get(`/api/export?kind=${kind}`);
      assert.equal(r.status, 400, kind);
      assert.doesNotMatch(r.body, /root:|add a page/);
    }
    assert.equal((await s.get("/api/export")).status, 400);
    for (const path of ["/%2e%2e/%2e%2e/etc/passwd", "/../../etc/passwd", "/app.js/../../../etc/passwd", "/api/../etc/passwd", "/stops.jsonl", "/labels.jsonl", "//etc/passwd", "/api/export/../../x"]) {
      const r = await s.get(path);
      assert.ok([400, 404].includes(r.status), `${path} ${r.status}`);
      assert.doesNotMatch(r.body, /root:|add a page/);
    }
  } finally {
    await s.ui.close();
  }
});

test("overview and privacy report counts without echoing stored text", async () => {
  const s = await setup();
  try {
    const overview = JSON.parse((await s.get("/api/overview")).body) as { stops: { stops: number; would_block: number; precision: number | null; unlabelled_would_block: number }; threshold_suggestion: { available: boolean } };
    assert.equal(overview.stops.stops, 2);
    assert.equal(overview.stops.would_block, 1);
    assert.equal(overview.stops.unlabelled_would_block, 1);
    assert.equal(overview.stops.precision, null);
    assert.equal(overview.threshold_suggestion.available, false);
    const privacy = JSON.parse((await s.get("/api/privacy")).body) as { stored: { name: string; bytes: number }[]; counts: { stops_this_project: number; stops_all_projects: number }; would_be_sent: unknown[] };
    assert.equal(privacy.counts.stops_this_project, 2);
    assert.equal(privacy.counts.stops_all_projects, 3);
    assert.ok(privacy.stored.some((f) => f.name === "stops.jsonl" && f.bytes > 0));
    assert.ok(privacy.would_be_sent.length >= 5);
  } finally {
    await s.ui.close();
  }
});

test("the ui command listens, prints the URL once, and closes on SIGTERM", async () => {
  const dataDir = tempDir();
  const io = memoryIo({ env: { REFEREE_DATA_DIR: dataDir } });
  const running = run(["ui", "--no-open"], io, commands);
  for (let i = 0; i < 200 && io.out.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
  const listening = JSON.parse(io.out[0] ?? "{}") as { verdict: string; url: string; opened: boolean };
  assert.equal(listening.verdict, "listening");
  assert.equal(listening.opened, false);
  const url = new URL(listening.url);
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.hash, /^#t=[0-9a-f]{32}$/);
  const port = Number(url.port);
  const token = url.hash.slice(3);
  const up = await raw(port, { path: "/api/overview", headers: { host: `127.0.0.1:${port}`, "x-referee-token": token } });
  assert.equal(up.status, 200);
  process.emit("SIGTERM");
  assert.equal(await running, 0);
  assert.equal(JSON.parse(io.out.at(-1) ?? "{}").verdict, "closed");
  assert.equal(io.out.join("").split(token).length - 1, 1);
  await assert.rejects(raw(port, { path: "/", headers: { host: `127.0.0.1:${port}` } }), /ECONNREFUSED/);
});

test("ui validates --port and reports a port in use", async () => {
  const bad = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() } });
  assert.equal(await run(["ui", "--port", "99999", "--no-open"], bad, commands), 1);
  assert.equal(bad.json()["error"], "bad_input");
  const s = await setup();
  try {
    const taken = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() } });
    assert.equal(await run(["ui", "--port", String(s.ui.port), "--no-open"], taken, commands), 1);
    assert.equal(taken.json()["error"], "bad_input");
  } finally {
    await s.ui.close();
  }
});

test("queue render never auto-focuses a label button", () => {
  assert.doesNotMatch(APP_JS, /\b(right|wrong|skip|back)\.focus\(\)/);
  assert.match(APP_JS, /card\.tabIndex = -1/);
  assert.match(APP_JS, /card\.focus\(\)/);
});

test("bidi control characters in excerpts reach the page as visible code points; the store keeps them", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const home = tempDir();
  appendStop(dataDir, stop("sbidi", projectId(cwd), { task_excerpt: "fix ‮gnirts desrever‬ here", final_excerpt: "ok ⁧x⁩ ‏؜‎" }));
  const ui = await startUi({ dataDir, cwd, home, env: { HOME: home }, now: () => 0 });
  try {
    const r = await raw(ui.port, { path: "/api/queue", headers: { host: `127.0.0.1:${ui.port}`, "x-referee-token": ui.token } });
    const first = (JSON.parse(r.body) as { stops: { task_excerpt: string; final_excerpt: string }[] }).stops[0];
    assert.equal(first?.task_excerpt, "fix [U+202E]gnirts desrever[U+202C] here");
    assert.equal(first?.final_excerpt, "ok [U+2067]x[U+2069] [U+200F][U+061C][U+200E]");
    assert.equal(readStops(dataDir)[0]?.task_excerpt, "fix ‮gnirts desrever‬ here");
  } finally {
    await ui.close();
  }
});

class FakeNode {
  children: FakeNode[] = [];
  attrs: Record<string, string> = {};
  className = "";
  tabIndex = 0;
  type = "";
  private own = "";
  readonly tag: string;
  constructor(tag: string) {
    this.tag = tag;
  }
  set textContent(v: string) {
    this.own = v;
    this.children = [];
  }
  get textContent(): string {
    return this.own + this.children.map((c) => c.textContent).join(" ");
  }
  get firstChild(): FakeNode | null {
    return this.children[0] ?? null;
  }
  appendChild(c: FakeNode): FakeNode {
    this.children.push(c);
    return c;
  }
  removeChild(c: FakeNode): FakeNode {
    this.children.splice(this.children.indexOf(c), 1);
    return c;
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  listeners: Record<string, (() => void)[]> = {};
  addEventListener(type: string, f: () => void): void {
    (this.listeners[type] ??= []).push(f);
  }
  click(): void {
    (this.listeners["click"] ?? []).forEach((f) => f());
  }
  focus(): void {}
}

const FIRST_FLOW = "/api/flow?days=7&command=all";
const EMPTY_FLOW = { days: 7, command: "all", commands: [], total: 0, shown: 0, events: [] };

function fakePage(hash: string, queue: unknown, more: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = { [FIRST_FLOW]: EMPTY_FLOW, ...more };
  const nodes: Record<string, FakeNode> = { main: new FakeNode("main"), status: new FakeNode("p"), tabs: new FakeNode("nav") };
  const on: Record<string, (() => void)[]> = {};
  const location = { hash, pathname: "/" };
  const fetched: { path: string; token: string }[] = [];
  new Script(APP_JS).runInNewContext({
    URLSearchParams,
    setTimeout,
    location,
    history: { replaceState: () => void (location.hash = "") },
    document: { getElementById: (id: string) => nodes[id], createElement: (tag: string) => new FakeNode(tag), addEventListener: () => undefined, body: new FakeNode("body") },
    window: { addEventListener: (type: string, f: () => void) => void (on[type] ??= []).push(f) },
    fetch: (path: string, init: { headers: Record<string, string> }) => {
      fetched.push({ path, token: init.headers["X-Referee-Token"] ?? "" });
      return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(path in routes ? routes[path] : queue) });
    },
  });
  return { main: nodes["main"] as FakeNode, tabs: nodes["tabs"] as FakeNode, location, fetched, fire: (type: string) => (on[type] ?? []).forEach((f) => f()) };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("the tokened URL opened again in the same tab is picked up without a reload; other hashes are ignored", async () => {
  const page = fakePage("", { total: 0, stops: [] });
  assert.match(page.main.textContent, /No session token/);
  page.location.hash = "#main";
  page.fire("hashchange");
  await settle();
  assert.equal(page.fetched.length, 0);
  page.location.hash = "#t=abc123";
  page.fire("hashchange");
  await settle();
  assert.deepEqual(page.fetched, [{ path: FIRST_FLOW, token: "abc123" }]);
  assert.equal(page.location.hash, "");
  assert.match(page.main.textContent, /Nothing in this period/);
});

async function openTab(page: ReturnType<typeof fakePage>, name: string): Promise<void> {
  await settle();
  const tab = page.tabs.children.find((b) => b.textContent === name);
  assert.ok(tab, name);
  tab.click();
  await settle();
}

test("the queue card counts edits and checks in the singular and the plural", async () => {
  const card = (edits: number, checks: number) => ({ id: "s1", ts: "2026-10-06T06:00:00.000Z", edits, checks, claims_done: 0.9, claims_verified: 0.1, task_excerpt: "t", final_excerpt: "f", suggestion: null });
  const one = fakePage("#t=tok", { total: 1, stops: [card(1, 1)] });
  await openTab(one, "Labelling queue");
  assert.match(one.main.textContent, /- 1 edit, 1 check - done score 0\.90/);
  const many = fakePage("#t=tok", { total: 1, stops: [card(2, 0)] });
  await openTab(many, "Labelling queue");
  assert.match(many.main.textContent, /- 2 edits, 0 checks - done score 0\.90/);
});

test("the queue API carries the stored stop marks, zero when a stop has none", async () => {
  const dataDir = tempDir();
  const cwd = tempDir();
  const home = tempDir();
  appendStop(dataDir, stop("smarks", projectId(cwd), { ts: "2026-09-29T10:00:00.000Z", truncated_checks: 2, subagent_calls: 1, subagent_reports: 3, stale_pass: true }));
  appendStop(dataDir, stop("splain", projectId(cwd)));
  const ui = await startUi({ dataDir, cwd, home, env: { HOME: home }, now: () => 0 });
  try {
    const r = await raw(ui.port, { path: "/api/queue", headers: { host: `127.0.0.1:${ui.port}`, "x-referee-token": ui.token } });
    const stops = (JSON.parse(r.body) as { stops: { id: string; marks: unknown }[] }).stops;
    assert.deepEqual(stops.find((x) => x.id === "smarks")?.marks, { truncated_checks: 2, subagent_calls: 1, subagent_reports: 3, stale_pass: true });
    assert.deepEqual(stops.find((x) => x.id === "splain")?.marks, { truncated_checks: 0, subagent_calls: 0, subagent_reports: 0, stale_pass: false });
  } finally {
    await ui.close();
  }
});

test("the queue card lists the marks a stop has and says nothing when it has none", async () => {
  const card = (marks: unknown) => ({ id: "s1", ts: "2026-10-06T06:00:00.000Z", edits: 1, checks: 1, claims_done: 0.9, claims_verified: 0.1, task_excerpt: "t", final_excerpt: "f", suggestion: null, marks });
  const marked = fakePage("#t=tok", { total: 1, stops: [card({ truncated_checks: 2, subagent_calls: 1, subagent_reports: 1, stale_pass: true })] });
  await openTab(marked, "Labelling queue");
  assert.match(marked.main.textContent, /Marks \(read in code, not sent to Jev\): 2 checks with cut-off output; 1 subagent call; 1 subagent or background task finished; a check passed in the previous turn, none after this turn's edits/);
  const plain = fakePage("#t=tok", { total: 1, stops: [card({ truncated_checks: 0, subagent_calls: 0, subagent_reports: 0, stale_pass: false })] });
  await openTab(plain, "Labelling queue");
  assert.doesNotMatch(plain.main.textContent, /Marks/);
  const older = fakePage("#t=tok", { total: 1, stops: [{ ...card(undefined), marks: undefined }] });
  await openTab(older, "Labelling queue");
  assert.doesNotMatch(older.main.textContent, /Marks/);
});

test("overview numbers are grouped by thousands", async () => {
  const overview = {
    days: 30,
    receipts: { runs: 1234, requests: 12345, cached: 999, input_tokens: 1234567, cost_usd: 0.0512, by_command: { decide: 1400 } },
    stops: { stops: 1500, asked: 1200, would_block: 1000, labelled: 10, right: 6, wrong: 4, precision: 0.6, precision_ci95: [0.26, 0.88], false_block_rate: 0.4, false_block_rate_ci95: [0.12, 0.74], p95_ms: 2345, error_rate: 0, unlabelled_would_block: 990 },
    threshold_suggestion: { available: false, have: { right: 6, wrong: 4 }, need: { right: 10, wrong: 10 }, current: 0.7, suggested: null },
  };
  const page = fakePage("#t=tok", { total: 0, stops: [] }, { "/api/overview": overview });
  await settle();
  const tab = page.tabs.children.find((b) => b.textContent === "Overview");
  assert.ok(tab);
  tab.click();
  await settle();
  const text = page.main.textContent;
  for (const n of ["1,234", "12,345", "999", "1,234,567", "1,400", "1,500", "1,200", "1,000", "2,345", "990"]) assert.match(text, new RegExp(`(^|\\D)${n}(\\D|$)`), n);
  assert.match(text, /0\.0512/);
  const fractional = fakePage("#t=tok", { total: 0, stops: [] }, { "/api/overview": { ...overview, stops: { ...overview.stops, p95_ms: 1234.5678 } } });
  await settle();
  fractional.tabs.children.find((b) => b.textContent === "Overview")?.click();
  await settle();
  assert.match(fractional.main.textContent, /1234\.5678/);
});

function receipt(id: string, project: string, ts: string, extra: Partial<Receipt> = {}): Receipt {
  return { id, ts, command: "done", project, requests: 1, cached: 0, input_tokens: 100, cost_usd: 0.00001, ms: 500, ...extra };
}

const hexKey = (c: string) => c.repeat(64);

async function flowServer(fill: (dataDir: string, project: string) => void) {
  const dataDir = tempDir();
  const cwd = tempDir();
  const home = tempDir();
  fill(dataDir, projectId(cwd));
  const ui = await startUi({ dataDir, cwd, home, env: { HOME: home }, now: () => Date.parse("2026-09-30T12:00:00Z") });
  const get = async (query = "") => JSON.parse((await raw(ui.port, { path: `/api/flow${query}`, headers: { host: `127.0.0.1:${ui.port}`, "x-referee-token": ui.token } })).body) as Record<string, unknown> & { events: Record<string, unknown>[]; commands: string[] };
  return { ui, dataDir, get };
}

test("the flow API joins this project's receipts to Jev's stored answers and its stops, newest first", async () => {
  const s = await flowServer((dataDir, project) => {
    writeCache(dataDir, hexKey("a"), { ts: Date.parse("2026-09-30T11:00:00Z"), model: "jev-1.13.0", inputTokens: 1234, answers: { c1: { type: "noul", noul: 0.98 } } });
    writeCache(dataDir, hexKey("b"), {
      ts: Date.parse("2026-09-30T10:00:00Z"),
      model: "jev-1.13.0",
      inputTokens: 300,
      answers: {
        injection: { type: "noul", noul: 0.04 },
        "claim:1:a": { type: "choice", choice: "supports", confidence: 0.9, probabilities: { says_nothing: 0, contradicts: 0.1, supports: 0.9 } },
        [XSS]: { type: "score", score: 3.5, confidence: 0.7, legend: {} },
      } as never,
    });
    writeCache(dataDir, hexKey("e"), { ts: Date.parse("2026-09-30T09:00:00Z"), model: "jev-1.13.0", inputTokens: 1, answers: { c1: { type: "noul", noul: 0.5 } } });
    writeFileSync(join(tempDir(), "outside.json"), "{}");
    appendReceipt(dataDir, receipt("rA", project, "2026-09-30T11:00:00.000Z", { verdict: "met", pack: "generic", model: "jev-1.13.0", input_tokens: 1234, ms: 820, cache_keys: [hexKey("a")], session_id: "abcdef1234567" }));
    appendReceipt(dataDir, receipt("rB", project, "2026-09-30T10:00:00.000Z", { command: "claims", verdict: "supported", cache_keys: [hexKey("b"), "../../outside", hexKey("f")] }));
    appendReceipt(dataDir, receipt("rC", project, "2026-09-20T10:00:00.000Z", { command: "decide", verdict: "clear" }));
    appendReceipt(dataDir, receipt("rD", "otherproject1", "2026-09-30T11:30:00.000Z", { verdict: "met" }));
    appendReceipt(dataDir, receipt("rE", project, "2026-09-30T09:00:00.000Z", { verdict: "met", cache_keys: [hexKey("e")] }));
    overruleReceipt(dataDir, "rE", "2026-09-30T09:30:00.000Z");
    appendStop(dataDir, stop("s1", project, { ts: "2026-09-30T11:30:00.000Z", label: "right" }));
    const { decision: _asked, ...skipped } = stop("s2", project, { ts: "2026-09-30T08:00:00.000Z", skipped: "no_edits", edits: 0 });
    appendStop(dataDir, skipped);
  });
  try {
    const all = await s.get();
    assert.equal(all["days"], 7);
    assert.equal(all["command"], "all");
    assert.deepEqual(all.commands, ["claims", "done", "stop"]);
    assert.deepEqual(all.events.map((e) => e["id"]), ["s1", "rA", "rB", "rE", "s2"]);
    assert.equal(all["total"], 5);
    const [s1, rA, rB, rE, s2] = all.events;
    assert.deepEqual({ kind: rA?.["kind"], session: rA?.["session"], verdict: rA?.["verdict"], ms: rA?.["ms"], missing: rA?.["answers_missing"] }, { kind: "call", session: "abcdef12", verdict: "met", ms: 820, missing: 0 });
    assert.deepEqual(rA?.["answers"], [{ model: "jev-1.13.0", answered_at: "2026-09-30T11:00:00.000Z", questions: [{ id: "c1", type: "noul", value: "yes", p: 0.98, options: [] }] }]);
    const bq = (rB?.["answers"] as { questions: { id: string; value: string; p: number; options: { label: string; p: number }[] }[] }[])[0]?.questions ?? [];
    assert.equal(rB?.["answers_missing"], 2);
    assert.deepEqual(bq.find((q) => q.id === "injection"), { id: "injection", type: "noul", value: "no", p: 0.96, options: [] });
    assert.deepEqual(bq.find((q) => q.id === "claim:1:a")?.options, [{ label: "supports", p: 0.9 }, { label: "contradicts", p: 0.1 }, { label: "says_nothing", p: 0 }]);
    assert.deepEqual(bq.find((q) => q.id === XSS), { id: XSS, type: "score", value: "3.50", p: 0.7, options: [] });
    assert.deepEqual({ overruled: rE?.["overruled"], missing: rE?.["answers_missing"] }, { overruled: true, missing: 1 });
    assert.deepEqual({ kind: s1?.["kind"], would_block: s1?.["would_block"], label: s1?.["label"], session: s1?.["session"] }, { kind: "stop", would_block: true, label: "right", session: "sess-ui" });
    assert.deepEqual({ skipped: s2?.["skipped"], would_block: s2?.["would_block"], claims_done: s2?.["claims_done"] }, { skipped: "no_edits", would_block: null, claims_done: null });
    const month = await s.get("?days=30");
    assert.deepEqual(month.commands, ["claims", "decide", "done", "stop"]);
    assert.equal(month.events.some((e) => e["id"] === "rC"), true);
    assert.deepEqual((await s.get("?command=stop")).events.map((e) => e["id"]), ["s1", "s2"]);
    assert.deepEqual((await s.get("?command=done")).events.map((e) => e["id"]), ["rA", "rE"]);
    const odd = await s.get("?days=5&command=constructor");
    assert.deepEqual({ days: odd["days"], command: odd["command"], n: odd.events.length }, { days: 7, command: "all", n: 5 });
  } finally {
    await s.ui.close();
  }
});

test("the flow API shows the newest 200 events and reports the total", async () => {
  const s = await flowServer((dataDir, project) => {
    for (let i = 0; i < 205; i++) appendReceipt(dataDir, receipt(`r${i}`, project, new Date(Date.parse("2026-09-30T00:00:00Z") + i * 60_000).toISOString()));
  });
  try {
    const d = await s.get();
    assert.deepEqual({ total: d["total"], shown: d["shown"], n: d.events.length, first: d.events[0]?.["id"] }, { total: 205, shown: 200, n: 200, first: "r204" });
  } finally {
    await s.ui.close();
  }
});

function findAll(node: FakeNode, pred: (n: FakeNode) => boolean, out: FakeNode[] = []): FakeNode[] {
  if (pred(node)) out.push(node);
  node.children.forEach((c) => findAll(c, pred, out));
  return out;
}

test("the flow tab draws each call as ask, Jev, verdict, with answers on demand and filters that refetch", async () => {
  const call = (id: string, extra: Record<string, unknown>) => ({ kind: "call", id, ts: "2026-10-06T09:00:00.000Z", command: "done", pack: "generic", model: "jev-1.13.0", verdict: "met", error: null, requests: 1, cached: 0, input_tokens: 1234, cost_usd: 0.0001, ms: 820, session: "abcdef12", overruled: false, answers: [], answers_missing: 0, ...extra });
  const flowData = {
    days: 7,
    command: "all",
    commands: ["claims", "done", "stop"],
    total: 9,
    shown: 7,
    events: [
      call("c1", { answers: [{ model: "jev-1.13.0", answered_at: "2026-10-06T09:00:00.000Z", questions: [{ id: "claim:1:a", type: "choice", value: "supports", p: 0.9, options: [{ label: "supports", p: 0.9 }, { label: "contradicts", p: 0.1 }] }] }], answers_missing: 1 }),
      call("c2", { requests: 0, cached: 1, ms: 22 }),
      call("c3", { requests: 0, cached: 0, ms: 5, verdict: "missing" }),
      call("c4", { verdict: null, error: "timeout", command: "claims" }),
      call("c5", { overruled: true, verdict: "unsure" }),
      { kind: "stop", id: "s1", ts: "2026-10-05T09:00:00.000Z", mode: "shadow", session: "sess-ui", skipped: null, edits: 2, checks: 1, ms: 800, claims_done: 0.9, claims_verified: 0.1, would_block: true, label: "right" },
      { kind: "stop", id: "s2", ts: "2026-10-05T08:00:00.000Z", mode: "shadow", session: null, skipped: "no_edits", edits: 0, checks: 0, ms: 3, claims_done: null, claims_verified: null, would_block: null, label: null },
    ],
  };
  const page = fakePage("#t=tok", { total: 0, stops: [] }, { [FIRST_FLOW]: flowData, "/api/flow?days=30&command=all": EMPTY_FLOW });
  await settle();
  const text = page.main.textContent;
  for (const s of [
    "5 calls (3 requests to Jev, 1 answer from the cache), 2 done-gate stops",
    "Showing the newest 7 of 9",
    "Jev: 1 request, 1,234 tokens, 820 ms",
    "From the cache: 1 stored answer, 22 ms",
    "Decided in code, nothing sent to Jev, 5 ms",
    "Failed: timeout",
    "Overruled: voided",
    "Done-gate stop",
    "Jev: done 0.90, verified 0.10, 800 ms",
    "would block, labelled right",
    "Not asked: no edits",
    "Jev's answers: 1 question",
    "supports 0.90, contradicts 0.10",
    "1 stored answer is gone",
  ]) assert.ok(text.includes(s), s);
  const outs = findAll(page.main, (n) => n.className.startsWith("out ")).map((n) => [n.textContent, n.className]);
  assert.deepEqual(outs, [["met", "out v-ok"], ["met", "out v-ok"], ["missing", "out v-bad"], ["error", "out v-bad"], ["unsure", "out v-mid"], ["would block, labelled right", "out v-bad"], ["skipped", "out v-mid"]]);
  assert.equal(findAll(page.main, (n) => n.tag === "h3").length, 2);
  assert.equal(findAll(page.main, (n) => n.tag === "details").length, 1);
  const period = findAll(page.main, (n) => n.tag === "select")[0];
  assert.ok(period);
  (period as unknown as { value: string }).value = "30";
  (period.listeners["change"] ?? []).forEach((f) => f());
  await settle();
  assert.equal(page.fetched.at(-1)?.path, "/api/flow?days=30&command=all");
  assert.match(page.main.textContent, /Nothing in this period/);
});

test("a corrupt receipt or cache entry degrades to placeholders instead of failing the flow route", async () => {
  const s = await flowServer((dataDir, project) => {
    const dir = join(dataDir, "cache");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${hexKey("1")}.json`), JSON.stringify({ ts: 1e20, model: "m", answers: { c1: { type: "noul", noul: 0.9 } } }));
    writeFileSync(join(dir, `${hexKey("2")}.json`), JSON.stringify({ ts: Date.parse("2026-09-30T10:00:00Z"), model: 7, answers: { a: "x", b: null, c: { type: "other" }, d: { type: "choice", choice: "k", confidence: "high", probabilities: { k: "x", j: 0.2 } }, e: { type: "noul", noul: "0.9" } } }));
    appendReceipt(dataDir, receipt("rOk", project, "2026-09-30T11:00:00.000Z", { verdict: "met", cache_keys: [hexKey("1"), hexKey("2")] }));
    appendReceipt(dataDir, { ...receipt("rBad", project, "2026-09-30T10:00:00.000Z"), command: 5, verdict: 1, error: null, pack: {}, requests: "2", cache_keys: 5 } as unknown as Receipt);
  });
  try {
    const d = await s.get();
    assert.deepEqual(d.events.map((e) => e["id"]), ["rOk", "rBad"]);
    assert.deepEqual(d.commands, ["done"]);
    const [ok, bad] = d.events;
    assert.equal(ok?.["answers_missing"], 1);
    const qs = (ok?.["answers"] as { model: string; questions: { id: string; value: string; p: number | null; options: unknown[] }[] }[])[0];
    assert.equal(qs?.model, "7");
    assert.deepEqual(qs?.questions, [{ id: "d", type: "choice", value: "k", p: null, options: [{ label: "j", p: 0.2 }] }, { id: "e", type: "noul", value: "?", p: null, options: [] }]);
    assert.deepEqual({ command: bad?.["command"], verdict: bad?.["verdict"], error: bad?.["error"], pack: bad?.["pack"], requests: bad?.["requests"], answers: bad?.["answers"], missing: bad?.["answers_missing"] }, { command: "unknown", verdict: null, error: null, pack: null, requests: 0, answers: [], missing: 0 });
  } finally {
    await s.ui.close();
  }
});
