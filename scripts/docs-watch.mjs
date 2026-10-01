// Docs watcher: hashes TypeSafe's models.md, api.md and llms.txt and compares them with docs-watch.json. Run weekly in CI, no key needed.
// Exit 1 when a page changed or can't be fetched; --update records the current hashes. The limits row is printed so a change is easy to read.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "https://docs.typesafe.ai/";
export const PAGES = ["models.md", "api.md", "llms.txt"];
const FILE = fileURLToPath(new URL("../docs-watch.json", import.meta.url));

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function facts(page, text) {
  if (page === "models.md") return { rate_limits: (text.match(/^.*Rate limits.*\|.*$/m) ?? [""])[0].trim(), models: [...new Set(text.match(/jev-[0-9][\w.]*/g) ?? [])].sort() };
  if (page === "llms.txt") return { links: (text.match(/^- \[/gm) ?? []).length };
  return {};
}

export function compare(recorded, current) {
  const changed = [];
  for (const page of PAGES) {
    if (recorded[page]?.sha256 !== current[page]?.sha256) changed.push({ page, was: recorded[page]?.facts ?? null, now: current[page]?.facts ?? null });
  }
  return changed;
}

async function fetchAll() {
  const out = {};
  for (const page of PAGES) {
    const res = await fetch(BASE + page, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
    const text = await res.text();
    out[page] = { sha256: sha256(text), facts: facts(page, text) };
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const current = await fetchAll();
  if (process.argv.includes("--update")) {
    writeFileSync(FILE, JSON.stringify(current, null, 2) + "\n");
    console.log("docs-watch.json updated");
  } else {
    const changed = compare(JSON.parse(readFileSync(FILE, "utf8")), current);
    if (changed.length === 0) console.log("TypeSafe docs unchanged");
    else {
      console.log(JSON.stringify(changed, null, 2));
      console.log("Changed pages above. Read them, update docs and the thresholds if needed, then run: node scripts/docs-watch.mjs --update");
      process.exitCode = 1;
    }
  }
}
