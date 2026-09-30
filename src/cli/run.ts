// CLI runner: parses flags, prints one JSON line, maps verdicts and errors to exit codes.
// Exit codes: 0 for any verdict, 1 for real errors, 3 when --fail-on matches the verdict.

import { join } from "node:path";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { KIT, VERSION } from "../engine/config.ts";
import { resolveDataDir } from "../engine/datadir.ts";
import { RefereeError, isRefereeError } from "../engine/errors.ts";
import { render, renderError, type Result } from "../engine/output.ts";
import { newReceiptId } from "../engine/receipts.ts";
import type { Command, GlobalFlags, Io } from "./types.ts";

const GLOBAL_OPTIONS: ParseArgsOptionsConfig = {
  describe: { type: "boolean" },
  pretty: { type: "boolean" },
  "dry-run": { type: "boolean" },
  fresh: { type: "boolean" },
  verbose: { type: "boolean" },
  "data-dir": { type: "string" },
  pack: { type: "string" },
  "fail-on": { type: "string" },
};

const SHARED_CONTRACT = {
  flags: {
    "--pretty": "Indented JSON for people.",
    "--data-dir <dir>": "Use another data directory for receipts, cache and results.",
    "--pack <name>": "Use this pack instead of the project's.",
    "--dry-run": "Commands that ask Jev: print the redacted request and a token estimate; send, cache and log nothing. A request too long for one line goes to a details file instead.",
    "--fresh": "Commands that ask Jev: skip the answer cache.",
    "--fail-on <verdict,...>": "Exit with code 3 when the verdict is one of these, e.g. --fail-on missing,unsure.",
  },
  exit_codes: {
    "0": "A verdict, including a negative one such as missing.",
    "1": "An error; the JSON line holds error, message and next_step.",
    "3": "The verdict is listed in --fail-on.",
  },
};

function usage(commands: readonly Command[]): string {
  const width = Math.max(...commands.map((c) => c.name.length), 4);
  const lines = commands.map((c) => `  ${c.name.padEnd(width)}  ${c.describe.summary}`);
  return [
    `${KIT} ${VERSION}`,
    "",
    `Usage: ${KIT} <command> [options]`,
    "",
    "Commands:",
    ...lines,
    "",
    "Every command accepts --describe (JSON contract), --pretty and --data-dir.",
    "Commands that ask Jev also accept --dry-run, --fresh and --fail-on <verdict,...>.",
  ].join("\n");
}

function flagsFrom(values: Record<string, unknown>): GlobalFlags {
  const str = (key: string): string | undefined => (typeof values[key] === "string" ? (values[key] as string) : undefined);
  return {
    pretty: values["pretty"] === true,
    dryRun: values["dry-run"] === true,
    fresh: values["fresh"] === true,
    verbose: values["verbose"] === true,
    dataDir: str("data-dir"),
    pack: str("pack"),
    failOn: (str("fail-on") ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  };
}

export async function run(argv: readonly string[], io: Io, commands: readonly Command[]): Promise<number> {
  const [name, ...rest] = argv;
  if (name === undefined || name === "help" || name === "--help" || name === "-h") {
    io.write(usage(commands) + "\n");
    return 0;
  }
  if (name === "--version" || name === "-v") {
    io.write(`${VERSION}\n`);
    return 0;
  }
  let pretty = rest.includes("--pretty");
  try {
    const command = commands.find((c) => c.name === name);
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
    const values = parsed.values as Record<string, unknown>;
    const flags = flagsFrom(values);
    pretty = flags.pretty;
    if (values["describe"] === true) {
      io.write(JSON.stringify({ command: command.name, ...command.describe, ...SHARED_CONTRACT }, null, pretty ? 2 : 0) + "\n");
      return 0;
    }
    const result: Result = await command.run({ io, flags, values: parsed.values, positionals: parsed.positionals });
    const receipt = typeof result["receipt"] === "string" ? result["receipt"] : flags.dryRun ? `dry-run-${newReceiptId(io.now())}` : null;
    const detailsDir = join(resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), "results");
    io.write(render(result, { pretty, detailsDir, receipt }) + "\n");
    const verdict = result["verdict"];
    return typeof verdict === "string" && flags.failOn.includes(verdict) ? 3 : 0;
  } catch (error) {
    const known = isRefereeError(error) ? error : new RefereeError("internal", error instanceof Error ? error.message : String(error));
    io.write(renderError(known, pretty) + "\n");
    return 1;
  }
}
