// Helpers shared by the commands: input reading, pack selection and the Jev command lifecycle.
// A Jev command plans its requests first, so --dry-run can show them without touching the network or disk.

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { RefereeError, isRefereeError } from "../engine/errors.ts";
import type { Result } from "../engine/output.ts";
import { loadPack, packDirs, type Pack } from "../engine/pack.ts";
import { loadProject, type ProjectConfig } from "../engine/project.ts";
import { Session, type Outcome, type Planned } from "../engine/session.ts";
import type { Context } from "./types.ts";

export const JEV_COST = "One Jev request per input at $0.042 per million input tokens; output tokens are free. Repeats come from the local cache.";

export const JEV_ERRORS = [
  "bad_input",
  "no_api_key",
  "invalid_api_key",
  "auth_failed",
  "rate_limited",
  "timeout",
  "service_unavailable",
  "bad_request",
  "credential_in_state",
  "pack_not_found",
  "bad_pack",
  "bad_project",
  "too_large",
] as const;

export const JEV_EFFECTS =
  "Sends the redacted input to the TypeSafe API unless --dry-run; writes a receipt and cache entries to the data directory.";

export function str(context: Context, key: string): string | undefined {
  const value = context.values[key];
  return typeof value === "string" ? value : undefined;
}

export function list(context: Context, key: string): string[] {
  const value = context.values[key];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" ? [value] : [];
}

export async function readSource(context: Context, source: string | undefined, what: string): Promise<string> {
  if (source === undefined || source === "-") {
    const text = await context.io.readStdin();
    if (!text.trim()) throw new RefereeError("bad_input", `No ${what} on stdin.`, { next_step: `Pipe the ${what} in, or pass a file path.` });
    return text;
  }
  const path = resolve(context.io.cwd, source);
  try {
    if (statSync(path).size > 5_000_000) throw new RefereeError("too_large", `The ${what} file is larger than 5 MB.`);
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isRefereeError(error)) throw error;
    throw new RefereeError("bad_input", `Cannot read the ${what} file: ${source}`);
  }
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export function clip(text: string, head: number, tail: number): string {
  if (text.length <= head + tail) return text;
  return `${text.slice(0, head)}\n[… ${text.length - head - tail} characters omitted …]\n${text.slice(-tail)}`;
}

export function openPack(context: Context): { pack: Pack; project: ProjectConfig | null } {
  const project = loadProject(context.io.cwd);
  const name = context.flags.pack ?? context.io.env["REFEREE_PACK"]?.trim() ?? project?.pack ?? "generic";
  return { pack: loadPack(name || "generic", packDirs(context.io.env)), project };
}

export function question(pack: Pack, id: string): Pack["questions"][string] {
  const q = pack.questions[id];
  if (!q) throw new RefereeError("bad_pack", `Pack ${pack.name} has no question ${id}.`);
  return q;
}

export function withData<T extends object>(instructions: unknown, data: Record<string, unknown>): T {
  const base = typeof instructions === "object" && instructions !== null && !Array.isArray(instructions) ? instructions : { question: instructions };
  return { ...base, ...data } as T;
}

export async function jevCommand(
  context: Context,
  command: string,
  pack: Pack,
  planned: readonly Planned[],
  finish: (outcomes: Outcome[], session: Session) => Result,
  options: { batch?: boolean } = {},
): Promise<Result> {
  const { io, flags } = context;
  const session = new Session({
    command,
    env: io.env,
    cwd: io.cwd,
    home: io.home,
    platform: io.platform,
    now: io.now,
    pack: { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact },
    dataDir: flags.dataDir,
    fresh: flags.fresh,
  });
  if (flags.dryRun) return session.dryRun(planned);
  try {
    const outcomes = await session.run(planned, options);
    const result = finish(outcomes, session);
    const receipt = session.record(typeof result["verdict"] === "string" ? { verdict: result["verdict"] } : {});
    if (!session.saved()) io.warn("[claude-referee] Could not write to the data directory; this run was not cached or logged.\n");
    if (flags.verbose) io.warn(JSON.stringify({ requests: receipt.requests, cached: receipt.cached, input_tokens: receipt.input_tokens, cost_usd: receipt.cost_usd, model: receipt.model, ms: receipt.ms }) + "\n");
    return reorder({ ...result, ...session.stats(), receipt: receipt.id });
  } catch (error) {
    if (isRefereeError(error)) session.record({ error });
    throw error;
  }
}

export function reorder(result: Result): Result {
  const { ok, verdict, next_step, receipt, ...rest } = result;
  return { ok, verdict, ...rest, next_step, receipt };
}
