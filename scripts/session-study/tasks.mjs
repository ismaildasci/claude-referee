// The frozen task set of the session base-rate study: starter trees, verifier sources and a manifest hash that the runner pins.
// Verifiers are written by the runner outside the task tree and are never part of what a session can see.

import { createHash } from "node:crypto";
import { NODE_TASKS } from "./tasks-node.mjs";
import { PYTHON_TASKS } from "./tasks-python.mjs";
import { HARD_TASKS } from "./tasks-hard.mjs";

export const KINDS = ["easy", "subtle", "weak", "notest", "ambiguous"];
export const TASKS = [...NODE_TASKS, ...PYTHON_TASKS];

const NODE_PRELUDE = `import assert from "node:assert/strict";\nimport { join } from "node:path";\nimport { pathToFileURL } from "node:url";\n\nconst dir = process.argv[2];\nconst load = (path) => import(pathToFileURL(join(dir, path)).href);\n\n`;
const PYTHON_PRELUDE = `import os\nimport sys\nimport tempfile\n\nroot = os.path.abspath(sys.argv[1])\nsys.path.insert(0, root)\nos.chdir(tempfile.gettempdir())\n\n`;

export const PROMPT_SUFFIX = "\n\nAnswer in English.";

export function promptFor(task) {
  return task.prompt + PROMPT_SUFFIX;
}

// Shell tasks are judged by a Node verifier that runs the script; every other language is judged in its own.
export const verifierLang = (task) => (task.lang === "python" ? "python" : "node");

export function verifierExt(task) {
  return verifierLang(task) === "node" ? "mjs" : "py";
}

export function verifierSource(task) {
  return (verifierLang(task) === "node" ? NODE_PRELUDE : PYTHON_PRELUDE) + task.verify;
}

// The command a verifier is run with, the task tree path comes last.
export function verifierCommand(task, verifierPath, treeDir) {
  return verifierLang(task) === "node" ? ["node", [verifierPath, treeDir]] : ["python3", [verifierPath, treeDir]];
}

// The command that runs the visible tests of a task, or null when it has none.
export function visibleCommand(task) {
  if (!task.visible) return null;
  return task.lang === "python" ? ["python3", ["-m", "unittest"]] : ["npm", ["test", "--silent"]];
}

export { HARD_TASKS };

export function taskById(id) {
  const found = [...TASKS, ...HARD_TASKS].find((t) => t.id === id);
  if (!found) throw new Error(`unknown task ${id}`);
  return found;
}

// The manifest pins everything a session can see or be judged by: the prompt, every starter file and the verifier source.
export function manifest(tasks = TASKS) {
  const entries = tasks.map((t) => ({ id: t.id, lang: t.lang, kind: t.kind, prompt: promptFor(t), files: t.files, verifier: verifierSource(t) }));
  const hash = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
  return { hash, count: tasks.length, ids: tasks.map((t) => t.id) };
}

export function validateTasks(tasks = TASKS, kinds = KINDS, langs = ["node", "python"]) {
  const problems = [];
  const seen = new Set();
  for (const t of tasks) {
    if (seen.has(t.id)) problems.push(`duplicate id ${t.id}`);
    seen.add(t.id);
    if (!kinds.includes(t.kind)) problems.push(`${t.id}: bad kind ${t.kind}`);
    if (!langs.includes(t.lang)) problems.push(`${t.id}: bad lang`);
    if (t.kind !== "easy" && !t.wrong) problems.push(`${t.id}: kind ${t.kind} needs a plausible wrong solution`);
    if (!t.prompt || !t.verify || !t.solution || !t.files) problems.push(`${t.id}: incomplete`);
  }
  return problems;
}
