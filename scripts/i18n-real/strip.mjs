// Step 2 of the i18n real-code hold-out: content filter and the stripped copies (docs/decisions/i18n-pack-eval.md, amendment of 2026-10-06).
// Usage: node strip.mjs --out DIR [--lists DIR] [--take N] [--after FILE] [--html-stars N] [--html-min N]. Reads search-*.json and metadata.json from --lists (default DIR);
// clones into DIR/clones, writes DIR/copies, DIR/content-filter.json, DIR/repos.json, DIR/sites/<slug>.jsonl. --after: a content-filter.json whose repositories are skipped (second sample, docs/decisions/i18n-real-2.md).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { collectFiles } from "../../src/engine/i18n-extract.ts";
import { fileNamespace, localeNamespace, metadataVerdict, MIN_SITES, resolveKey, stripHtml, stripScript } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const OUT = flag("out");
if (!OUT) throw new Error("--out DIR is required");
const LISTS = flag("lists", OUT);
const AFTER = flag("after");
const HTML_STARS = Number(flag("html-stars", "0"));
const HTML_MIN = Number(flag("html-min", String(MIN_SITES)));
const FRAMEWORKS = ["react", "vue", "html"];
const TAKE = Number(flag("take", "2"));
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", "vendor", ".git", ".next", ".nuxt", ".svelte-kit", ".turbo", "__tests__", "__snapshots__"]);
const meta = JSON.parse(readFileSync(join(LISTS, "metadata.json"), "utf8"));
const earlier = AFTER ? JSON.parse(readFileSync(AFTER, "utf8")) : {};
const slug = (repo) => repo.replace("/", "__");
const rel = (root, abs) => relative(root, abs).split(sep).join("/");
for (const d of ["clones", "copies", "sites"]) mkdirSync(join(OUT, d), { recursive: true });

function walk(root, dir = root, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(root, join(dir, e.name), out); }
    else if (e.isFile()) out.push(rel(root, join(dir, e.name)));
  }
  return out;
}

function clone(repo) {
  const dir = join(OUT, "clones", slug(repo));
  if (!existsSync(join(dir, ".git"))) {
    rmSync(dir, { recursive: true, force: true });
    execFileSync("git", ["clone", "--quiet", "--depth", "1", "--no-tags", `https://github.com/${repo}.git`, dir], { stdio: ["ignore", "ignore", "pipe"], timeout: 600_000 });
  }
  return { dir, sha: execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
}

function examine(repo, framework, min) {
  const { dir, sha } = clone(repo);
  const namespaces = [];
  const localeFiles = [];
  for (const f of walk(dir)) {
    const name = localeNamespace(f);
    if (name === null) continue;
    try { namespaces.push({ name, data: JSON.parse(readFileSync(join(dir, f), "utf8")) }); localeFiles.push(f); } catch { /* not JSON */ }
  }
  const row = { repo, framework, sha, locale_files: localeFiles };
  if (namespaces.length === 0) return { row: { ...row, pass: false, why: "no_english_json" } };
  const copy = join(OUT, "copies", slug(repo));
  rmSync(copy, { recursive: true, force: true });
  cpSync(dir, copy, { recursive: true, filter: (src) => !src.split(sep).includes(".git") });
  const readSet = new Set(collectFiles(copy, ["."], false).files.map((f) => rel(copy, f)));
  const sites = [];
  const skips = [];
  for (const abs of collectFiles(copy, ["."], true).files) {
    const f = rel(copy, abs);
    const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
    const source = readFileSync(abs, "utf8");
    let r;
    if (framework === "html") {
      if (ext !== ".html" && ext !== ".htm") continue;
      r = stripHtml(f, source, (key) => resolveKey(key, namespaces));
    } else {
      if (ext === ".html" || ext === ".htm") continue;
      const fileNs = framework === "react" ? fileNamespace(source) : {};
      r = stripScript(f, source, framework, (key) => resolveKey(key, namespaces, fileNs));
    }
    if (r.sites.length > 0) writeFileSync(abs, r.source);
    for (const s of r.sites) sites.push({ ...s, read: readSet.has(f) });
    skips.push(...r.skips.map((s) => ({ ...s, read: readSet.has(f) })));
  }
  const read = sites.filter((s) => s.read).length;
  const byReason = {};
  for (const s of skips.filter((x) => x.read)) byReason[s.reason] = (byReason[s.reason] ?? 0) + 1;
  const out = { ...row, files_read: readSet.size, sites_read: read, sites_unread: sites.length - read, skips_read: byReason, pass: read >= min, why: read >= min ? "ok" : "too_few_sites" };
  return { row: out, sites };
}

const table = {};
const chosen = [];
for (const framework of FRAMEWORKS) {
  const list = JSON.parse(readFileSync(join(LISTS, `search-${framework}.json`), "utf8"));
  table[framework] = [];
  const seen = new Set(Object.values(earlier).flat().map((r) => r.repo));
  const last = Math.max(-1, ...(earlier[framework] ?? []).map((r) => list.repos.indexOf(r.repo)));
  const start = framework === "html" ? 0 : last + 1;
  const html = framework === "html" && HTML_STARS > 0;
  for (const repo of list.repos.slice(start)) {
    if (table[framework].filter((r) => r.pass).length >= TAKE) break;
    if (seen.has(repo)) continue;
    if (!metadataVerdict(meta[repo], html ? HTML_STARS : undefined).pass) continue;
    let result;
    try { result = examine(repo, framework, framework === "html" ? HTML_MIN : MIN_SITES); } catch (error) { result = { row: { repo, framework, pass: false, why: "clone_failed", error: String(error.message).slice(0, 200) } }; }
    table[framework].push(result.row);
    console.error(`${framework} ${repo}: ${result.row.why} (${result.row.sites_read ?? 0} sites read)`);
    if (result.row.pass) {
      chosen.push({ framework, repo, sha: result.row.sha, license: meta[repo].license, stars: meta[repo].stars, url: `https://github.com/${repo}` });
      writeFileSync(join(OUT, "sites", `${slug(repo)}.jsonl`), result.sites.map((s) => JSON.stringify(s)).join("\n") + "\n");
    } else rmSync(join(OUT, "copies", slug(repo)), { recursive: true, force: true });
  }
}
writeFileSync(join(OUT, "content-filter.json"), `${JSON.stringify(table, null, 1)}\n`);
writeFileSync(join(OUT, "repos.json"), `${JSON.stringify(chosen, null, 1)}\n`);
console.error(`chosen: ${chosen.map((c) => c.repo).join(", ")}`);
