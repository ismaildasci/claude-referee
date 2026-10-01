// lint-pack: static checks of a pack directory's questions; --recorded <evals dir> also checks recorded answers for questions that score high on everything.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { RefereeError } from "../../engine/errors.ts";
import { lintQuestions, lintRecorded, type Finding } from "../../engine/lint.ts";
import { parseRecordings } from "../../engine/evals.ts";
import type { Command } from "../types.ts";

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new RefereeError("bad_input", `Not valid JSON: ${path}`);
  }
}

function recordedNouls(root: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!existsSync(root)) throw new RefereeError("bad_input", `No evals directory: ${root}`);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = join(root, entry.name, "recorded.jsonl");
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const latest = new Map<string, Record<string, unknown>>();
    for (const line of parseRecordings(readFileSync(file, "utf8"))) latest.set(String(line.case), line.answers as Record<string, unknown>);
    for (const answers of latest.values()) {
      for (const [key, answer] of Object.entries(answers ?? {})) {
        const a = answer as { type?: string; noul?: number };
        if (a?.type === "noul" && typeof a.noul === "number") (out[`${entry.name}:${key.replace(/[0-9]+$/, "").replace(/^claim:.*$/, "claim")}`] ??= []).push(a.noul);
      }
    }
  }
  return out;
}

export const lintPack: Command = {
  name: "lint-pack",
  describe: {
    summary: "Check a pack's questions against TypeSafe's question-writing rules.",
    inputs: {
      "<pack dir>": "A directory with pack.json and questions/*.json.",
      "--recorded <evals dir>": "Also flag a Noul whose recorded answers are high on every input (10th percentile at or above 0.5).",
    },
    outputs: {
      verdict: "clean, warnings or errors",
      findings: "Each with rule, severity, question and message",
      questions: "Number of questions checked",
    },
    errors: ["bad_input"],
    effects: "Reads files only; no network.",
    cost: "Free.",
  },
  options: { recorded: { type: "string" } },
  async run(context) {
    const target = context.positionals[0];
    if (!target) throw new RefereeError("bad_input", "Give the pack directory.", { next_step: "Example: lint-pack plugins/evidence-referee/packs/generic" });
    const dir = resolve(context.io.cwd, target);
    if (!existsSync(join(dir, "pack.json"))) throw new RefereeError("bad_input", `No pack.json in ${dir}.`);
    const meta = readJson(join(dir, "pack.json")) as { model?: unknown };
    const questions: Record<string, unknown> = {};
    const qdir = join(dir, "questions");
    if (existsSync(qdir)) for (const file of readdirSync(qdir).filter((f) => f.endsWith(".json")).sort()) Object.assign(questions, readJson(join(qdir, file)) as object);
    const findings: Finding[] = lintQuestions(questions, meta.model);
    const recorded = context.values["recorded"];
    if (typeof recorded === "string") findings.push(...lintRecorded(recordedNouls(resolve(context.io.cwd, recorded))));
    const verdict = findings.some((f) => f.severity === "error") ? "errors" : findings.length ? "warnings" : "clean";
    return { ok: true, verdict, questions: Object.keys(questions).length, findings, next_step: verdict === "clean" ? undefined : "Fix the findings; each message says what to change." };
  },
};
