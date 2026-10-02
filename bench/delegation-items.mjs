// Delegation A/B (bench/PREREG.md): fetches a public repo at a pinned commit, extracts the candidate items and builds the labels by a fixed rule.
// Labels come from code only (TRACKED_RULE below); no human has reviewed them. Repo contents and item texts are never committed.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/;
export const COMMENT_BEFORE = /(\/\/|\/\*|\*|#|<!--)[^\n]*\b(TODO|FIXME|XXX|HACK)\b/;
export const EXCLUDED_DIRS = /(^|\/)(test|tests|__tests__|fixtures|node_modules|dist|vendor|third_party|__snapshots__|\.git)(\/|$)/;
export const SOURCE_EXT = /\.(js|mjs|cjs|ts|py)$/;

// The registered rule. An item is "tracked" when its text holds an issue or pull request number, a URL, or a named owner after the marker.
export const TRACKED_RULE = {
  issue: /#\d{1,6}\b/,
  gh: /\b(gh|GH|issue|issues|pull|PR)[ -]?#?\d{1,6}\b/,
  url: /https?:\/\//,
  owner_paren: /\b(TODO|FIXME|XXX|HACK)\(\s*@?[\w.-]+\s*\)/,
  owner_at: /\b(TODO|FIXME|XXX|HACK)\s*:?\s*@[\w-]+/,
};
export const isTracked = (text) => Object.values(TRACKED_RULE).some((re) => re.test(text));

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function fetchRepo({ cacheDir, repo, sha }) {
  const dir = join(cacheDir, repo.replace("/", "__"), sha);
  const run = (args, cwd) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${String(r.stderr).slice(0, 200)}`);
    return r.stdout.trim();
  };
  if (!existsSync(join(dir, ".git"))) {
    mkdirSync(dir, { recursive: true });
    run(["init", "-q"], dir);
    run(["fetch", "-q", "--depth", "1", `https://github.com/${repo}`, sha], dir);
    run(["checkout", "-q", "FETCH_HEAD"], dir);
  }
  const head = run(["rev-parse", "HEAD"], dir);
  if (head !== sha) throw new Error(`${repo}: checked out ${head}, expected ${sha}`);
  return dir;
}

function walk(root, dir = root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const rel = relative(root, path).split(sep).join("/");
    if (EXCLUDED_DIRS.test(rel)) continue;
    const st = statSync(path);
    if (st.isDirectory()) walk(root, path, out);
    else if (SOURCE_EXT.test(name) && !/\.min\./.test(name)) out.push(rel);
  }
  return out;
}

// Candidate items: every source line under the case's path pattern with a marker word inside a comment, in file and line order.
// Each stratum (tracked, untracked) is cut to its cap by a seeded hash, so a case is enriched in tracked items; the order of the kept items is unchanged.
export function extractItems(repoDir, { pathPattern, tracked, untracked, seed }) {
  const re = new RegExp(pathPattern);
  const all = [];
  for (const file of walk(repoDir).filter((f) => re.test(f))) {
    readFileSync(join(repoDir, file), "utf8").split("\n").forEach((line, i) => {
      if (!COMMENT_BEFORE.test(line)) return;
      const text = line.trim().slice(0, 400);
      all.push({ where: `${file}:${i + 1}`, text, label: isTracked(text) });
    });
  }
  const cut = (label, cap) => all.filter((it) => it.label === label).sort((a, b) => sha256(`${seed}:${a.where}`).localeCompare(sha256(`${seed}:${b.where}`))).slice(0, cap);
  const keep = new Set([...cut(true, tracked), ...cut(false, untracked)]);
  return all.filter((it) => keep.has(it)).map((it, i) => ({ id: `n${String(i + 1).padStart(3, "0")}`, where: it.where, text: it.text, label: it.label }));
}

// Hash of what the label set is: id, label and text hash of every item, in order. Pinned per case in cases-delegation.json.
export const itemsHash = (items) => sha256(items.map((it) => `${it.id}\t${it.label ? 1 : 0}\t${sha256(it.text)}`).join("\n"));

// Items as the arms see them (no label, no where): id and text.
export const armItemsJsonl = (items) => items.map((it) => JSON.stringify({ id: it.id, text: it.text })).join("\n") + "\n";
