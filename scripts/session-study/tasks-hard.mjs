// Loader of the hard-task study set (docs/decisions/session-hard-tasks.md): one directory per task under hard-tasks/ with task.json, starter/, solution/, wrong/ and verify.mjs or verify.py.
// Files are read in sorted order so the manifest hash is stable; the verifier body runs after the prelude in tasks.mjs and never sits inside a task tree.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./hard-tasks/", import.meta.url));

function readTree(dir, prefix = "") {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) Object.assign(out, readTree(full, rel));
    else out[rel] = readFileSync(full, "utf8");
  }
  return out;
}

function load(id) {
  const dir = join(ROOT, id);
  const meta = JSON.parse(readFileSync(join(dir, "task.json"), "utf8"));
  const verifyFile = meta.lang === "python" ? "verify.py" : "verify.mjs";
  return {
    id,
    kind: meta.kind,
    lang: meta.lang,
    prompt: meta.prompt,
    files: readTree(join(dir, "starter")),
    solution: readTree(join(dir, "solution")),
    wrong: existsSync(join(dir, "wrong")) ? readTree(join(dir, "wrong")) : null,
    visible: meta.visible === true,
    verify: readFileSync(join(dir, verifyFile), "utf8"),
  };
}

export const HARD_TASKS = existsSync(ROOT) ? readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory()).sort().map(load) : [];
