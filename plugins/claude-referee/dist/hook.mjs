#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/hooks/main.ts
import { homedir } from "node:os";
import { dirname as dirname3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/hooks/session-start.ts
import { appendFileSync as appendFileSync2 } from "node:fs";
import { join as join5 } from "node:path";

// src/engine/datadir.ts
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// src/engine/config.ts
var KIT = "claude-referee";
var MARKETPLACE = "claude-referee";
var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;

// src/engine/datadir.ts
function pluginDataId() {
  return `${KIT}@${MARKETPLACE}`.replace(/[^A-Za-z0-9_-]/g, "-");
}
__name(pluginDataId, "pluginDataId");
function resolveDataDir(env, home, cwd, flag) {
  if (flag) return resolve(cwd, flag);
  const fromEnv = env["CLAUDE_PLUGIN_DATA"]?.trim() || env["REFEREE_DATA_DIR"]?.trim();
  if (fromEnv) return fromEnv;
  const configDir = env["CLAUDE_CONFIG_DIR"]?.trim() || join(home, ".claude");
  return join(configDir, "plugins", "data", pluginDataId());
}
__name(resolveDataDir, "resolveDataDir");
function projectRoot(cwd) {
  let root = cwd;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2e3 }).trim() || cwd;
  } catch {
    root = cwd;
  }
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}
__name(projectRoot, "projectRoot");
function projectId(cwd) {
  return createHash("sha256").update(projectRoot(cwd)).digest("hex").slice(0, 12);
}
__name(projectId, "projectId");

// src/engine/pack.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync, readFileSync, readdirSync as readdirSync2 } from "node:fs";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";

// src/engine/errors.ts
var RefereeError = class extends Error {
  static {
    __name(this, "RefereeError");
  }
  code;
  details;
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RefereeError";
    this.code = code;
    this.details = details;
  }
};

// src/engine/pack.ts
var NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
function bundledPackDirs() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [join2(here, "packs"), join2(here, "..", "packs"), join2(here, "..", "..", "plugins", "claude-referee", "packs")];
}
__name(bundledPackDirs, "bundledPackDirs");
function packDirs(env, bundled = bundledPackDirs()) {
  const out = [];
  const setting = env["CLAUDE_PLUGIN_OPTION_PACKS_DIR"]?.trim();
  const fromEnv = env["REFEREE_PACKS_DIR"]?.trim();
  if (setting) out.push({ dir: setting, source: "setting" });
  if (fromEnv) out.push({ dir: fromEnv, source: "env" });
  for (const dir of bundled) if (existsSync(dir)) out.push({ dir, source: "bundled" });
  return out;
}
__name(packDirs, "packDirs");
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new RefereeError("bad_pack", `Pack file is not valid JSON: ${path.split(/[\\/]/).slice(-2).join("/")}`);
  }
}
__name(readJson, "readJson");
function listFiles(dir, ext) {
  return existsSync(dir) ? readdirSync2(dir).filter((f) => f.endsWith(ext)).sort() : [];
}
__name(listFiles, "listFiles");
function hashDir(dir) {
  const hash = createHash2("sha256");
  const walk = /* @__PURE__ */ __name((d, rel) => {
    for (const entry of readdirSync2(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join2(d, entry.name);
      if (entry.isDirectory()) walk(path, `${rel}${entry.name}/`);
      else if (entry.isFile()) hash.update(`${rel}${entry.name}\0`).update(readFileSync(path)).update("\0");
    }
  }, "walk");
  walk(dir, "");
  return hash.digest("hex").slice(0, 12);
}
__name(hashDir, "hashDir");
function checkQuestions(raw, file) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new RefereeError("bad_pack", `Questions file must be an object: ${file}`);
  for (const [id, q] of Object.entries(raw)) {
    const type = q.type;
    if (type !== "noul" && type !== "choice" && type !== "score") throw new RefereeError("bad_pack", `Question ${id} has no valid type.`);
  }
  return raw;
}
__name(checkQuestions, "checkQuestions");
function checkThresholds(raw) {
  const out = {};
  for (const [id, values] of Object.entries(raw ?? {})) {
    out[id] = {};
    for (const [k, v] of Object.entries(values ?? {})) {
      if (typeof v !== "number" || v < 0 || v > 1) throw new RefereeError("bad_pack", `Threshold ${id}.${k} must be a number from 0 to 1.`);
      out[id][k] = v;
    }
  }
  return out;
}
__name(checkThresholds, "checkThresholds");
function findPackDir(name, dirs) {
  for (const { dir } of dirs) {
    const candidate = join2(dir, name);
    if (existsSync(join2(candidate, "pack.json"))) return candidate;
  }
  return null;
}
__name(findPackDir, "findPackDir");
function loadPack(name, dirs, seen = []) {
  if (!NAME.test(name)) throw new RefereeError("pack_not_found", `Invalid pack name: ${name.slice(0, 64)}`);
  if (seen.includes(name)) throw new RefereeError("bad_pack", `Pack extends itself: ${[...seen, name].join(" > ")}`);
  const dir = findPackDir(name, dirs);
  if (!dir) {
    throw new RefereeError("pack_not_found", `Pack not found: ${name}`, { next_step: "Check the pack name in .claude/referee.json and the packs_dir setting." });
  }
  const meta = readJson(join2(dir, "pack.json"));
  const parent = typeof meta.extends === "string" ? loadPack(meta.extends, dirs, [...seen, name]) : null;
  const questions = { ...parent?.questions };
  for (const file of listFiles(join2(dir, "questions"), ".json")) Object.assign(questions, checkQuestions(readJson(join2(dir, "questions", file)), file));
  const thresholds = { ...parent?.thresholds, ...existsSync(join2(dir, "thresholds.json")) ? checkThresholds(readJson(join2(dir, "thresholds.json"))) : {} };
  const cheatsheet = { ...parent?.cheatsheet };
  for (const file of listFiles(join2(dir, "cheatsheet"), ".md")) cheatsheet[file.replace(/\.md$/, "")] = readFileSync(join2(dir, "cheatsheet", file), "utf8");
  const own = existsSync(join2(dir, "redact.json")) ? readJson(join2(dir, "redact.json")) : void 0;
  const redact = parent?.redact || own ? { stop: [...parent?.redact?.stop ?? [], ...own?.stop ?? []], replace: [...parent?.redact?.replace ?? [], ...own?.replace ?? []] } : void 0;
  const areas = existsSync(join2(dir, "areas.json")) ? readJson(join2(dir, "areas.json")) : parent?.areas;
  return {
    name,
    version: typeof meta.version === "string" ? meta.version : "0.0.0",
    model: typeof meta.model === "string" ? meta.model : parent?.model ?? "",
    dir,
    hash: hashDir(dir),
    questions,
    thresholds,
    cheatsheet,
    redact,
    areas
  };
}
__name(loadPack, "loadPack");

// src/engine/project.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { dirname as dirname2, join as join3, relative, sep } from "node:path";
function readProjectFile(path) {
  try {
    const raw = JSON.parse(readFileSync2(path, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("not an object");
    return raw;
  } catch {
    throw new RefereeError("bad_project", `Project file is not a JSON object: .claude/${path.split(/[\\/]/).pop()}`);
  }
}
__name(readProjectFile, "readProjectFile");
function checkAreas(raw) {
  if (raw === void 0) return void 0;
  if (!Array.isArray(raw)) throw new RefereeError("bad_project", "areas must be an array.");
  return raw.map((a) => {
    if (typeof a?.prefix !== "string" || !Array.isArray(a.checks) || !a.checks.every((c) => typeof c === "string")) {
      throw new RefereeError("bad_project", "Each area needs a prefix string and a checks array of strings.");
    }
    return {
      prefix: a.prefix,
      checks: a.checks,
      ...Array.isArray(a.evidence) ? { evidence: a.evidence.filter((e) => typeof e === "string") } : {},
      ...typeof a.pack === "string" ? { pack: a.pack } : {}
    };
  });
}
__name(checkAreas, "checkAreas");
function findProjectFile(cwd) {
  let dir = cwd;
  for (; ; ) {
    const file = join3(dir, ".claude", "referee.json");
    if (existsSync2(file)) return file;
    const parent = dirname2(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
__name(findProjectFile, "findProjectFile");
function loadProject(cwd) {
  const file = findProjectFile(cwd);
  if (!file) return null;
  const base = readProjectFile(file);
  const localFile = join3(dirname2(file), "referee.local.json");
  const local = existsSync2(localFile) ? readProjectFile(localFile) : {};
  const merged = { ...base, ...local, hooks: { ...base.hooks, ...local.hooks } };
  if (typeof merged.pack !== "string" || !merged.pack) throw new RefereeError("bad_project", 'The project file needs a pack name, for example {"pack": "generic"}.');
  const gate = merged.hooks?.stopGate;
  return {
    root: dirname2(dirname2(file)),
    pack: merged.pack,
    areas: checkAreas(merged.areas),
    hooks: {
      sessionStart: merged.hooks?.sessionStart !== false,
      stopGate: gate === "shadow" || gate === "active" ? gate : "off",
      preModelSwitch: merged.hooks?.preModelSwitch === true
    },
    thresholds: typeof merged.thresholds === "object" && merged.thresholds !== null ? merged.thresholds : void 0
  };
}
__name(loadProject, "loadProject");
function areaFor(areas, root, cwd) {
  if (!areas?.length) return null;
  const rel = relative(root, cwd).split(sep).join("/");
  const path = rel === "" ? "" : `${rel}/`;
  const matches = areas.filter((a) => path.startsWith(a.prefix) || a.prefix === "" || a.prefix === "./");
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
}
__name(areaFor, "areaFor");

// src/engine/receipts.ts
import { appendFileSync, existsSync as existsSync3, mkdirSync, readdirSync as readdirSync3, readFileSync as readFileSync3 } from "node:fs";
import { join as join4 } from "node:path";
function newReceiptId(now, random = Math.random) {
  const tail = Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  return `r${now.toString(36)}${tail}`;
}
__name(newReceiptId, "newReceiptId");
function receiptsDir(dataDir) {
  return join4(dataDir, "receipts");
}
__name(receiptsDir, "receiptsDir");
function appendReceipt(dataDir, receipt) {
  try {
    const dir = join4(receiptsDir(dataDir), receipt.project);
    mkdirSync(dir, { recursive: true });
    appendFileSync(join4(dir, `${receipt.ts.slice(0, 7)}.jsonl`), JSON.stringify(receipt) + "\n");
    return true;
  } catch {
    return false;
  }
}
__name(appendReceipt, "appendReceipt");

// src/hooks/session-start.ts
var BRIEFING_LIMIT = 800;
function quote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
__name(quote, "quote");
function fit(text) {
  if (text.length <= BRIEFING_LIMIT) return text;
  const cut = text.slice(0, BRIEFING_LIMIT);
  return cut.slice(0, Math.max(cut.lastIndexOf("\n"), 0)) || cut;
}
__name(fit, "fit");
async function sessionStart(io2, pluginRoot2) {
  const started = io2.now();
  const { env } = io2;
  if (env["REFEREE_HOOKS"] === "off" || /^(?:false|0|no|off)$/i.test(env["CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED"]?.trim() ?? "")) return null;
  let input;
  try {
    input = JSON.parse(await io2.readStdin());
  } catch {
    return null;
  }
  if (typeof input?.cwd !== "string") return null;
  const cwd = input.cwd;
  const project = loadProject(cwd);
  if (!project?.hooks.sessionStart) return null;
  const dirs = packDirs(env);
  let pack = loadPack(project.pack, dirs);
  const area = areaFor(project.areas ?? pack.areas, project.root, cwd);
  if (area?.pack && area.pack !== pack.name) pack = loadPack(area.pack, dirs);
  const template = pack.cheatsheet["session"];
  if (!template) return null;
  const checks = area?.checks.length ? area.checks.join("; ") : "none listed in .claude/referee.json";
  const text = fit(
    template.replaceAll("{{pack}}", pack.name).replaceAll("{{cli}}", join5(pluginRoot2, "dist", "cli.mjs")).replaceAll("{{checks}}", checks).trim()
  );
  const dataDir = resolveDataDir(env, io2.home, cwd);
  const envFile = env["CLAUDE_ENV_FILE"];
  if (envFile) {
    const lines = [`export REFEREE_DATA_DIR=${quote(dataDir)}`, `export REFEREE_PACK=${quote(pack.name)}`];
    const packsDir = env["CLAUDE_PLUGIN_OPTION_PACKS_DIR"]?.trim();
    if (packsDir) lines.push(`export REFEREE_PACKS_DIR=${quote(packsDir)}`);
    const model = env["CLAUDE_PLUGIN_OPTION_MODEL"]?.trim();
    if (model) lines.push(`export REFEREE_MODEL=${quote(model)}`);
    try {
      appendFileSync2(envFile, lines.join("\n") + "\n");
    } catch {
    }
  }
  appendReceipt(dataDir, {
    id: newReceiptId(started),
    ts: new Date(started).toISOString(),
    command: "session-start",
    project: projectId(cwd),
    pack: pack.name,
    requests: 0,
    cached: 0,
    input_tokens: 0,
    cost_usd: 0,
    chars: text.length,
    ms: Math.max(0, io2.now() - started),
    ...typeof input.session_id === "string" ? { session_id: input.session_id } : {}
  });
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } });
}
__name(sessionStart, "sessionStart");

// src/hooks/main.ts
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
__name(readStdin, "readStdin");
var pluginRoot = process.env["CLAUDE_PLUGIN_ROOT"] || dirname3(dirname3(fileURLToPath2(import.meta.url)));
var io = { env: process.env, home: homedir(), now: /* @__PURE__ */ __name(() => Date.now(), "now"), readStdin };
try {
  if (process.argv[2] === "session-start") {
    const out = await sessionStart(io, pluginRoot);
    if (out) process.stdout.write(out);
  }
} catch {
  process.exitCode = 0;
}
process.exitCode = 0;
