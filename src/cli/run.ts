// CLI runner: parses flags, prints one JSON line, maps verdicts and errors to exit codes.
// Exit codes: 0 for any verdict, 1 for real errors, 3 when --fail-on matches the verdict.
// A Jev command given input (its own option or stdin it read; positionals never count) that fails unreceipted gets a zero-request receipt, never with --dry-run.

import { join } from "node:path";
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { KIT, VERSION } from "../engine/config.ts";
import { projectId, resolveDataDir } from "../engine/datadir.ts";
import { RefereeError, isRefereeError } from "../engine/errors.ts";
import { render, renderError, type Result } from "../engine/output.ts";
import { appendReceipt, errorReceipt } from "../engine/receipts.ts";
import { isReceipted } from "../engine/session.ts";
import type { Command, Context, GlobalFlags, Io } from "./types.ts";

export const GLOBAL_OPTIONS: ParseArgsOptionsConfig = {
  describe: { type: "boolean" },
  pretty: { type: "boolean" },
  "dry-run": { type: "boolean" },
  fresh: { type: "boolean" },
  verbose: { type: "boolean" },
  "data-dir": { type: "string" },
  pack: { type: "string" },
  "fail-on": { type: "string" },
};

export const SHARED_CONTRACT = {
  flags: {
    "--pretty": "Indented JSON for people.",
    "--data-dir <dir>": "Use another data directory for receipts, cache and results.",
    "--pack <name>": "Use this pack instead of the project's.",
    "--dry-run": "Commands that ask Jev: print the redacted request and a token estimate; send, cache and log nothing. Long requests are shortened; --pretty shows them in full. A verdict decided in code (done on a non-zero exit code) is printed as is, with dry_run.",
    "--fresh": "Commands that ask Jev: skip the answer cache.",
    "--verbose": "Commands that ask Jev: also print requests, cached, input_tokens, cost_usd, model and ms as one JSON line on stderr; nothing with --dry-run.",
    "--fail-on <verdict,...>": "Exit with code 3 when the verdict is one of these, e.g. --fail-on missing,unsure.",
  },
  outputs_common: {
    ok: "true with a verdict; false on an error line",
    verdict: "The command's verdict; see outputs",
    next_step: "What to do next, when there is something to do",
    receipt: "Id of the receipt this run wrote",
    requests: "Requests sent to Jev (with --dry-run: planned)",
    cached: "Answers from the cache or merged with an identical request",
    details: "Only when the line would pass 1,500 characters: the file with the full result; the line keeps short scalar fields",
    dry_run: "--dry-run: true; nothing was sent, cached or logged",
    est_tokens: "--dry-run: estimated input tokens",
    replaced: "--dry-run: values redaction replaced",
    sent: "--dry-run: the redacted requests",
    sent_shown: "--dry-run: how many requests fit on the line",
    error: "Error line: the error code",
    message: "Error line: what went wrong",
    status: "Error line: the API's HTTP status, when there was one",
    retry_after_ms: "Error line: when to retry, if the API said",
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
    "Every command accepts --describe (JSON contract), --pretty, --data-dir, --pack and --fail-on <verdict,...>.",
    "Commands that ask Jev also accept --dry-run, --fresh and --verbose.",
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

function asksJev(command: Command, context: Context): boolean {
  return command.asksJev ? command.asksJev(context) : command.describe.errors.includes("no_api_key");
}

function receiptError(io: Io, flags: GlobalFlags, command: string, error: unknown, started: number): void {
  try {
    const code = isRefereeError(error) ? error.code : "internal";
    const receipt = errorReceipt({ command, project: projectId(io.cwd), error: code, started, now: io.now(), fresh: flags.fresh, runId: io.env["EVAL_RUN_ID"] });
    appendReceipt(resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), receipt);
  } catch {
    void 0;
  }
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
    let payload = Object.keys(values).some((key) => Object.hasOwn(command.options, key));
    const tracked: Io = {
      ...io,
      readStdin: async () => {
        const text = await io.readStdin();
        if (text.trim()) payload = true;
        return text;
      },
    };
    const context: Context = { io: tracked, flags, values: parsed.values, positionals: parsed.positionals };
    const started = io.now();
    let result: Result;
    try {
      result = await command.run(context);
    } catch (error) {
      if (!flags.dryRun && payload && asksJev(command, context) && !isReceipted(error)) receiptError(io, flags, command.name, error, started);
      throw error;
    }
    const receipt = typeof result["receipt"] === "string" ? result["receipt"] : null;
    const detailsDir = flags.dryRun ? null : join(resolveDataDir(io.env, io.home, io.cwd, flags.dataDir), "results");
    io.write(render(result, { pretty, detailsDir, receipt }) + "\n");
    const verdict = result["verdict"];
    return typeof verdict === "string" && flags.failOn.includes(verdict) ? 3 : 0;
  } catch (error) {
    const known = isRefereeError(error) ? error : new RefereeError("internal", error instanceof Error ? error.message : String(error));
    io.write(renderError(known, pretty) + "\n");
    return 1;
  }
}
