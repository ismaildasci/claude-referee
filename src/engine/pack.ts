// Packs are data only: questions, thresholds, briefing text, redaction patterns and default areas.
// Lookup order: packs_dir plugin setting, REFEREE_PACKS_DIR, then the packs shipped next to the bundle.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Question } from "@typesafe-ai/sdk";
import type { Env } from "./config.ts";
import { RefereeError } from "./errors.ts";
import type { PackPatterns } from "./redact.ts";

export interface Area {
  readonly prefix: string;
  readonly checks: readonly string[];
  readonly evidence?: readonly string[];
  readonly pack?: string;
}

export type Thresholds = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface Pack {
  readonly name: string;
  readonly version: string;
  readonly model: string;
  readonly dir: string;
  readonly hash: string;
  readonly questions: Readonly<Record<string, Question>>;
  readonly thresholds: Thresholds;
  readonly cheatsheet: Readonly<Record<string, string>>;
  readonly redact: PackPatterns | undefined;
  readonly areas: readonly Area[] | undefined;
}

export interface PackInfo {
  readonly name: string;
  readonly version: string;
  readonly hash: string;
  readonly source: "setting" | "env" | "bundled";
}

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function bundledPackDirs(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return [join(here, "packs"), join(here, "..", "packs"), join(here, "..", "..", "plugins", "evidence-referee", "packs")];
}

export function packDirs(env: Env, bundled: readonly string[] = bundledPackDirs()): { dir: string; source: PackInfo["source"] }[] {
  const out: { dir: string; source: PackInfo["source"] }[] = [];
  const setting = env["CLAUDE_PLUGIN_OPTION_PACKS_DIR"]?.trim();
  const fromEnv = env["REFEREE_PACKS_DIR"]?.trim();
  if (setting) out.push({ dir: setting, source: "setting" });
  if (fromEnv) out.push({ dir: fromEnv, source: "env" });
  for (const dir of bundled) if (existsSync(dir)) out.push({ dir, source: "bundled" });
  return out;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new RefereeError("bad_pack", `Pack file is not valid JSON: ${path.split(/[\\/]/).slice(-2).join("/")}`);
  }
}

function listFiles(dir: string, ext: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort() : [];
}

function hashDir(dir: string): string {
  const hash = createHash("sha256");
  const walk = (d: string, rel: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path, `${rel}${entry.name}/`);
      else if (entry.isFile()) hash.update(`${rel}${entry.name}\0`).update(readFileSync(path)).update("\0");
    }
  };
  walk(dir, "");
  return hash.digest("hex").slice(0, 12);
}

function checkQuestions(raw: unknown, file: string): Record<string, Question> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new RefereeError("bad_pack", `Questions file must be an object: ${file}`);
  for (const [id, q] of Object.entries(raw)) {
    const type = (q as { type?: unknown }).type;
    if (type !== "noul" && type !== "choice" && type !== "score") throw new RefereeError("bad_pack", `Question ${id} has no valid type.`);
  }
  return raw as Record<string, Question>;
}

function checkThresholds(raw: unknown): Thresholds {
  const out: Record<string, Record<string, number>> = {};
  for (const [id, values] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
    out[id] = {};
    for (const [k, v] of Object.entries((values ?? {}) as Record<string, unknown>)) {
      if (typeof v !== "number" || v < 0 || v > 1) throw new RefereeError("bad_pack", `Threshold ${id}.${k} must be a number from 0 to 1.`);
      out[id][k] = v;
    }
  }
  return out;
}

function findPackDir(name: string, dirs: readonly { dir: string }[]): string | null {
  for (const { dir } of dirs) {
    const candidate = join(dir, name);
    if (existsSync(join(candidate, "pack.json"))) return candidate;
  }
  return null;
}

export function loadPack(name: string, dirs: readonly { dir: string }[], seen: readonly string[] = []): Pack {
  if (!NAME.test(name)) throw new RefereeError("pack_not_found", `Invalid pack name: ${name.slice(0, 64)}`);
  if (seen.includes(name)) throw new RefereeError("bad_pack", `Pack extends itself: ${[...seen, name].join(" > ")}`);
  const dir = findPackDir(name, dirs);
  if (!dir) {
    throw new RefereeError("pack_not_found", `Pack not found: ${name}`, { next_step: "Check the pack name in .claude/referee.json and the packs_dir setting." });
  }
  const meta = readJson(join(dir, "pack.json")) as { name?: unknown; version?: unknown; model?: unknown; extends?: unknown };
  const parent = typeof meta.extends === "string" ? loadPack(meta.extends, dirs, [...seen, name]) : null;
  const questions: Record<string, Question> = { ...parent?.questions };
  for (const file of listFiles(join(dir, "questions"), ".json")) Object.assign(questions, checkQuestions(readJson(join(dir, "questions", file)), file));
  const thresholds = { ...parent?.thresholds, ...(existsSync(join(dir, "thresholds.json")) ? checkThresholds(readJson(join(dir, "thresholds.json"))) : {}) };
  const cheatsheet: Record<string, string> = { ...parent?.cheatsheet };
  for (const file of listFiles(join(dir, "cheatsheet"), ".md")) cheatsheet[file.replace(/\.md$/, "")] = readFileSync(join(dir, "cheatsheet", file), "utf8");
  const own = existsSync(join(dir, "redact.json")) ? (readJson(join(dir, "redact.json")) as PackPatterns) : undefined;
  const redact: PackPatterns | undefined =
    parent?.redact || own ? { stop: [...(parent?.redact?.stop ?? []), ...(own?.stop ?? [])], replace: [...(parent?.redact?.replace ?? []), ...(own?.replace ?? [])] } : undefined;
  const areas = existsSync(join(dir, "areas.json")) ? (readJson(join(dir, "areas.json")) as Area[]) : parent?.areas;
  return {
    name,
    version: typeof meta.version === "string" ? meta.version : "0.0.0",
    model: typeof meta.model === "string" ? meta.model : (parent?.model ?? ""),
    dir,
    hash: hashDir(dir),
    questions,
    thresholds,
    cheatsheet,
    redact,
    areas,
  };
}

export function listPacks(dirs: readonly { dir: string; source: PackInfo["source"] }[]): PackInfo[] {
  const seen = new Set<string>();
  const out: PackInfo[] = [];
  for (const { dir, source } of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || seen.has(entry.name) || !existsSync(join(dir, entry.name, "pack.json"))) continue;
      seen.add(entry.name);
      const meta = readJson(join(dir, entry.name, "pack.json")) as { version?: unknown };
      out.push({ name: entry.name, version: typeof meta.version === "string" ? meta.version : "0.0.0", hash: hashDir(join(dir, entry.name)), source });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function threshold(pack: Pack, project: Thresholds | undefined, question: string, key: string, fallback: number): number {
  const base = pack.thresholds[question]?.[key] ?? fallback;
  const override = project?.[question]?.[key];
  return typeof override === "number" && override > base ? Math.min(override, 1) : base;
}

// For a condition that holds when a value is below the threshold (a block needs claims_verified < t): a project may only lower it, which fires less.
export function thresholdBelow(pack: Pack, project: Thresholds | undefined, question: string, key: string, fallback: number): number {
  const base = pack.thresholds[question]?.[key] ?? fallback;
  const override = project?.[question]?.[key];
  return typeof override === "number" && override < base ? Math.max(override, 0) : base;
}
