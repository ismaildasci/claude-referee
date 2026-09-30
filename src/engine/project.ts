// Finds .claude/referee.json upward from cwd and merges .claude/referee.local.json over it.
// Project files pick a pack and hooks and can only raise thresholds; key, key command and packs_dir are ignored.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { RefereeError } from "./errors.ts";
import type { Area, Thresholds } from "./pack.ts";

export type StopGate = "off" | "shadow" | "active";

export interface ProjectConfig {
  readonly root: string;
  readonly pack: string;
  readonly areas: readonly Area[] | undefined;
  readonly hooks: { readonly sessionStart: boolean; readonly stopGate: StopGate; readonly preModelSwitch: boolean };
  readonly thresholds: Thresholds | undefined;
}

interface RawProject {
  pack?: unknown;
  areas?: unknown;
  hooks?: { sessionStart?: unknown; stopGate?: unknown; preModelSwitch?: unknown };
  thresholds?: unknown;
}

function readProjectFile(path: string): RawProject {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("not an object");
    return raw as RawProject;
  } catch {
    throw new RefereeError("bad_project", `Project file is not a JSON object: .claude/${path.split(/[\\/]/).pop()}`);
  }
}

function checkAreas(raw: unknown): Area[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw new RefereeError("bad_project", "areas must be an array.");
  return raw.map((a: { prefix?: unknown; checks?: unknown; evidence?: unknown; pack?: unknown }) => {
    if (typeof a?.prefix !== "string" || !Array.isArray(a.checks) || !a.checks.every((c) => typeof c === "string")) {
      throw new RefereeError("bad_project", "Each area needs a prefix string and a checks array of strings.");
    }
    return {
      prefix: a.prefix,
      checks: a.checks as string[],
      ...(Array.isArray(a.evidence) ? { evidence: a.evidence.filter((e): e is string => typeof e === "string") } : {}),
      ...(typeof a.pack === "string" ? { pack: a.pack } : {}),
    };
  });
}

export function findProjectFile(cwd: string): string | null {
  let dir = cwd;
  for (;;) {
    const file = join(dir, ".claude", "referee.json");
    if (existsSync(file)) return file;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadProject(cwd: string): ProjectConfig | null {
  const file = findProjectFile(cwd);
  if (!file) return null;
  const base = readProjectFile(file);
  const localFile = join(dirname(file), "referee.local.json");
  const local = existsSync(localFile) ? readProjectFile(localFile) : {};
  const merged: RawProject = { ...base, ...local, hooks: { ...base.hooks, ...local.hooks } };
  if (typeof merged.pack !== "string" || !merged.pack) throw new RefereeError("bad_project", "The project file needs a pack name, for example {\"pack\": \"generic\"}.");
  const gate = merged.hooks?.stopGate;
  return {
    root: dirname(dirname(file)),
    pack: merged.pack,
    areas: checkAreas(merged.areas),
    hooks: {
      sessionStart: merged.hooks?.sessionStart !== false,
      stopGate: gate === "shadow" || gate === "active" ? gate : "off",
      preModelSwitch: merged.hooks?.preModelSwitch === true,
    },
    thresholds: typeof merged.thresholds === "object" && merged.thresholds !== null ? (merged.thresholds as Thresholds) : undefined,
  };
}

export function areaFor(areas: readonly Area[] | undefined, root: string, cwd: string): Area | null {
  if (!areas?.length) return null;
  const rel = relative(root, cwd).split(sep).join("/");
  const path = rel === "" ? "" : `${rel}/`;
  const matches = areas.filter((a) => path.startsWith(a.prefix) || a.prefix === "" || a.prefix === "./");
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}
