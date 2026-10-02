// One-off: freezes the registered case and control tasks out of scripts/session-study (owned by another stream) into bench/cases.json with a SHA-256 over their content.
// Run once before registration; the runner reads only cases.json, so later edits to the study tasks cannot change the registered set.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROMPT_SUFFIX, TASKS, verifierExt, verifierSource, visibleCommand } from "../scripts/session-study/tasks.mjs";
import { CASE_IDS, CONTROL_IDS } from "./select.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pick = (ids, role) =>
  ids.map((id) => {
    const t = TASKS.find((x) => x.id === id);
    if (!t) throw new Error(`unknown task ${id}`);
    return { id: t.id, role, lang: t.lang, kind: t.kind, prompt: t.prompt + PROMPT_SUFFIX, files: t.files, verifier_ext: verifierExt(t), verifier: verifierSource(t), visible_command: visibleCommand(t) };
  });

const tasks = [...pick(CASE_IDS, "case"), ...pick(CONTROL_IDS, "control")];
const hash = createHash("sha256").update(JSON.stringify(tasks)).digest("hex");
writeFileSync(join(here, "cases.json"), JSON.stringify({ hash, source: "scripts/session-study/tasks.mjs", count: tasks.length, tasks }, null, 1) + "\n");
console.log(JSON.stringify({ hash, cases: CASE_IDS.length, controls: CONTROL_IDS.length }));
