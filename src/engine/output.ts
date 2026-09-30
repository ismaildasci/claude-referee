// One-line JSON for Claude: decision first, floats rounded, nothing echoed back.
// Results longer than DETAIL_LIMIT keep their scalar fields; the full result goes to a file.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DETAIL_LIMIT, ERROR_LIMIT } from "./config.ts";
import type { RefereeError } from "./errors.ts";

export type Result = Record<string, unknown>;

export interface RenderOptions {
  readonly pretty?: boolean;
  readonly detailsDir?: string | null;
  readonly receipt?: string | null;
}

function roundNumber(key: string, value: number): number {
  if (Number.isInteger(value)) return value;
  const digits = key.endsWith("_usd") ? 6 : 2;
  return Number(value.toFixed(digits));
}

export function roundDeep(value: unknown, key = ""): unknown {
  if (typeof value === "number") return roundNumber(key, value);
  if (Array.isArray(value)) return value.map((item) => roundDeep(item, key));
  if (value !== null && typeof value === "object") {
    const out: Result = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = roundDeep(v, k);
    }
    return out;
  }
  return value;
}

function isScalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function summarize(result: Result, path: string): Result {
  const out: Result = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === "receipt") continue;
    if (isScalar(v) && JSON.stringify(v).length <= 300) out[k] = v;
  }
  out["details"] = path;
  if (result["receipt"] !== undefined) out["receipt"] = result["receipt"];
  return out;
}

export function render(result: Result, options: RenderOptions = {}): string {
  const rounded = roundDeep(result) as Result;
  if (options.pretty) return JSON.stringify(rounded, null, 2);
  const line = JSON.stringify(rounded);
  if (line.length <= DETAIL_LIMIT || !options.detailsDir || !options.receipt) return line;
  const path = join(options.detailsDir, `${options.receipt}.json`);
  try {
    mkdirSync(options.detailsDir, { recursive: true });
    writeFileSync(path, JSON.stringify(rounded, null, 2) + "\n");
  } catch {
    return line;
  }
  return JSON.stringify(summarize(rounded, path));
}

export function renderError(error: RefereeError, pretty = false): string {
  const body: Result = { ok: false, error: error.code, message: error.message.slice(0, 500) };
  if (error.details.status !== undefined) body["status"] = error.details.status;
  if (error.details.retry_after_ms !== undefined) body["retry_after_ms"] = error.details.retry_after_ms;
  if (error.details.next_step !== undefined) body["next_step"] = error.details.next_step.slice(0, 600);
  const text = pretty ? JSON.stringify(body, null, 2) : JSON.stringify(body);
  return text.length <= ERROR_LIMIT ? text : JSON.stringify({ ok: false, error: error.code });
}
