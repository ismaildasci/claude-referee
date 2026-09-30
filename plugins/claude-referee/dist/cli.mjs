// src/cli/commands/index.ts
var commands = [];

// src/cli/io.ts
import { homedir } from "node:os";
async function readAll(stream) {
  if (stream.isTTY) return "";
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
function processIo() {
  return {
    env: process.env,
    cwd: process.cwd(),
    home: homedir(),
    platform: process.platform,
    readStdin: () => readAll(process.stdin),
    write: (text) => void process.stdout.write(text),
    warn: (text) => void process.stderr.write(text),
    now: () => Date.now()
  };
}

// src/cli/run.ts
import { parseArgs } from "node:util";

// src/engine/config.ts
var KIT = "claude-referee";
var VERSION = "0.1.0";
var DETAIL_LIMIT = 1500;
var ERROR_LIMIT = 2e3;
var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;

// src/engine/errors.ts
var RefereeError = class extends Error {
  code;
  details;
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RefereeError";
    this.code = code;
    this.details = details;
  }
};
function isRefereeError(value) {
  return value instanceof RefereeError;
}

// src/engine/output.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
function roundNumber(key, value) {
  if (Number.isInteger(value)) return value;
  const digits = key.endsWith("_usd") ? 6 : 2;
  return Number(value.toFixed(digits));
}
function roundDeep(value, key = "") {
  if (typeof value === "number") return roundNumber(key, value);
  if (Array.isArray(value)) return value.map((item) => roundDeep(item, key));
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== void 0) out[k] = roundDeep(v, k);
    }
    return out;
  }
  return value;
}
function isScalar(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}
function summarize(result, path) {
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === "receipt") continue;
    if (isScalar(v) && JSON.stringify(v).length <= 300) out[k] = v;
  }
  out["details"] = path;
  if (result["receipt"] !== void 0) out["receipt"] = result["receipt"];
  return out;
}
function render(result, options = {}) {
  const rounded = roundDeep(result);
  if (options.pretty) return JSON.stringify(rounded, null, 2);
  const line = JSON.stringify(rounded);
  if (line.length <= DETAIL_LIMIT || !options.detailsDir || !options.receipt) return line;
  mkdirSync(options.detailsDir, { recursive: true });
  const path = join(options.detailsDir, `${options.receipt}.json`);
  writeFileSync(path, JSON.stringify(rounded, null, 2) + "\n");
  return JSON.stringify(summarize(rounded, path));
}
function renderError(error, pretty = false) {
  const body = { ok: false, error: error.code, message: error.message.slice(0, 500) };
  if (error.details.status !== void 0) body["status"] = error.details.status;
  if (error.details.retry_after_ms !== void 0) body["retry_after_ms"] = error.details.retry_after_ms;
  if (error.details.next_step !== void 0) body["next_step"] = error.details.next_step.slice(0, 600);
  const text = pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
  return text.length <= ERROR_LIMIT ? text : JSON.stringify({ ok: false, error: error.code });
}

// src/cli/run.ts
var GLOBAL_OPTIONS = {
  describe: { type: "boolean" },
  pretty: { type: "boolean" },
  "dry-run": { type: "boolean" },
  fresh: { type: "boolean" },
  verbose: { type: "boolean" },
  "data-dir": { type: "string" },
  pack: { type: "string" },
  "fail-on": { type: "string" }
};
function usage(commands2) {
  const width = Math.max(...commands2.map((c) => c.name.length), 4);
  const lines = commands2.map((c) => `  ${c.name.padEnd(width)}  ${c.describe.summary}`);
  return [
    `${KIT} ${VERSION}`,
    "",
    `Usage: ${KIT} <command> [options]`,
    "",
    "Commands:",
    ...lines,
    "",
    "Every command accepts --describe (JSON contract), --pretty and --data-dir.",
    "Commands that ask Jev also accept --dry-run, --fresh and --fail-on <verdict,...>."
  ].join("\n");
}
function flagsFrom(values) {
  const str = (key) => typeof values[key] === "string" ? values[key] : void 0;
  return {
    pretty: values["pretty"] === true,
    dryRun: values["dry-run"] === true,
    fresh: values["fresh"] === true,
    verbose: values["verbose"] === true,
    dataDir: str("data-dir"),
    pack: str("pack"),
    failOn: (str("fail-on") ?? "").split(",").map((v) => v.trim()).filter(Boolean)
  };
}
async function run(argv, io, commands2, hooks = {}) {
  const [name, ...rest] = argv;
  if (name === void 0 || name === "help" || name === "--help" || name === "-h") {
    io.write(usage(commands2) + "\n");
    return 0;
  }
  if (name === "--version" || name === "-v") {
    io.write(`${VERSION}
`);
    return 0;
  }
  let pretty = rest.includes("--pretty");
  try {
    const command = commands2.find((c) => c.name === name);
    if (!command) {
      throw new RefereeError("bad_input", `Unknown command: ${name}`, { next_step: `Run ${KIT} --help for the list.` });
    }
    let parsed;
    try {
      parsed = parseArgs({ args: [...rest], options: { ...GLOBAL_OPTIONS, ...command.options }, allowPositionals: true, strict: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RefereeError("bad_input", message.slice(0, 300), { next_step: `Run ${KIT} ${name} --describe for the inputs.` });
    }
    const values = parsed.values;
    const flags = flagsFrom(values);
    pretty = flags.pretty;
    if (values["describe"] === true) {
      io.write(JSON.stringify({ command: command.name, ...command.describe }, null, pretty ? 2 : 0) + "\n");
      return 0;
    }
    const result = await command.run({ io, flags, values: parsed.values, positionals: parsed.positionals });
    const receipt = typeof result["receipt"] === "string" ? result["receipt"] : null;
    const detailsDir = flags.dryRun ? null : hooks.detailsDir?.(io, flags) ?? null;
    io.write(render(result, { pretty, detailsDir, receipt }) + "\n");
    const verdict = result["verdict"];
    return typeof verdict === "string" && flags.failOn.includes(verdict) ? 3 : 0;
  } catch (error) {
    const known = isRefereeError(error) ? error : new RefereeError("internal", error instanceof Error ? error.message : String(error));
    io.write(renderError(known, pretty) + "\n");
    return 1;
  }
}

// src/cli/main.ts
process.exitCode = await run(process.argv.slice(2), processIo(), commands);
