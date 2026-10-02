// API key lookup: plugin setting, TYPESAFE_API_KEY, EVAL_TYPESAFE_API_KEY, TYPESAFE_API_KEY_CMD, macOS Keychain.
// The TypeSafe key goes only to https://api.typesafe.ai; another TYPESAFE_BASE_URL needs its own REFEREE_BASE_URL_KEY.
// The key command is read only from the process environment and runs once, without a shell, within 5 s.

import { execFile } from "node:child_process";
import type { Env } from "./config.ts";
import { RefereeError } from "./errors.ts";

export type KeySource = "REFEREE_BASE_URL_KEY" | "plugin_setting" | "TYPESAFE_API_KEY" | "EVAL_TYPESAFE_API_KEY" | "TYPESAFE_API_KEY_CMD" | "keychain";

export interface ResolvedKey {
  readonly key: string;
  readonly source: KeySource;
}

export type Runner = (file: string, args: readonly string[], timeoutMs: number) => Promise<string | null>;

export const runCommand: Runner = (file, args, timeoutMs) =>
  new Promise((resolve) => {
    execFile(file, [...args], { timeout: timeoutMs, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 }, (error, stdout) =>
      resolve(error ? null : stdout),
    );
  });

const processMemo = new Map<string, Promise<string | null>>();

export function splitCommand(command: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: string | null = null;
  let started = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) out.push(current);
      current = "";
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (quote) throw new RefereeError("invalid_api_key", "TYPESAFE_API_KEY_CMD has an unclosed quote.");
  if (started) out.push(current);
  return out;
}

export function validateKey(raw: string, source: KeySource): string {
  const key = raw.trim();
  if (/[^\x21-\x7e]/.test(key)) {
    throw new RefereeError("invalid_api_key", `The key from ${source} contains spaces, control characters or non-ASCII characters.`, {
      next_step: "Store the key again, without extra characters.",
    });
  }
  return key;
}

export function noKeyNextStep(platform: NodeJS.Platform): string {
  const hooks = "Hooks can also use /plugin configure claude-referee or claude plugin configure claude-referee --values-stdin (Claude Code 2.1.285+).";
  if (platform === "darwin") {
    return `Store the key in the Keychain: security add-generic-password -a "$USER" -s TYPESAFE_API_KEY -w (it prompts for the key). ${hooks}`;
  }
  if (platform === "linux") {
    return `Set TYPESAFE_API_KEY, or TYPESAFE_API_KEY_CMD="secret-tool lookup service typesafe" (not yet tested). ${hooks}`;
  }
  return `Set TYPESAFE_API_KEY (Windows is not yet tested). ${hooks}`;
}

export async function resolveKey(env: Env, platform: NodeJS.Platform, runner: Runner = runCommand, memo = processMemo): Promise<ResolvedKey> {
  const direct: ReadonlyArray<readonly [KeySource, string | undefined]> = [
    ["plugin_setting", env["CLAUDE_PLUGIN_OPTION_API_KEY"]],
    ["TYPESAFE_API_KEY", env["TYPESAFE_API_KEY"]],
    ["EVAL_TYPESAFE_API_KEY", env["EVAL_TYPESAFE_API_KEY"]],
  ];
  for (const [source, value] of direct) {
    if (value?.trim()) return { key: validateKey(value, source), source };
  }
  const command = env["TYPESAFE_API_KEY_CMD"]?.trim();
  if (command) {
    const [file, ...args] = splitCommand(command);
    if (file) {
      if (!memo.has(command)) memo.set(command, runner(file, args, 5000));
      const out = await memo.get(command);
      if (out?.trim()) return { key: validateKey(out, "TYPESAFE_API_KEY_CMD"), source: "TYPESAFE_API_KEY_CMD" };
    }
  }
  if (platform === "darwin") {
    const out = await runner("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], 5000);
    if (out?.trim()) return { key: validateKey(out, "keychain"), source: "keychain" };
  }
  throw new RefereeError("no_api_key", "No TypeSafe API key found.", { next_step: noKeyNextStep(platform) });
}

export function isTypeSafeHost(baseUrl: string | undefined): boolean {
  const raw = baseUrl?.trim();
  if (!raw) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "api.typesafe.ai" && url.port === "";
  } catch {
    return false;
  }
}

export async function resolveEndpointKey(env: Env, platform: NodeJS.Platform, runner: Runner = runCommand, memo = processMemo): Promise<ResolvedKey> {
  if (isTypeSafeHost(env["TYPESAFE_BASE_URL"])) return resolveKey(env, platform, runner, memo);
  const own = env["REFEREE_BASE_URL_KEY"];
  if (own?.trim()) return { key: validateKey(own, "REFEREE_BASE_URL_KEY"), source: "REFEREE_BASE_URL_KEY" };
  throw new RefereeError("no_api_key", "TYPESAFE_BASE_URL points away from api.typesafe.ai, and the TypeSafe key is never sent to another host.", {
    next_step: "Set REFEREE_BASE_URL_KEY to the key for that host, or unset TYPESAFE_BASE_URL.",
  });
}
