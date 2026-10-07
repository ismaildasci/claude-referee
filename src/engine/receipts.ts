// Local receipts: one JSON line per command run in receipts/<project>/<yyyy-mm>.jsonl.
// A receipt holds counts, tokens, cost and time; never request text, file paths or user names.
// Each receipt carries `prev`, the sha256 of the previous line of its project's chain; verifyChain checks it.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./cache.ts";

export interface Receipt {
  readonly id: string;
  readonly ts: string;
  readonly command: string;
  readonly project: string;
  readonly pack?: string;
  readonly model?: string;
  readonly verdict?: string;
  readonly reason?: string;
  readonly error?: string;
  readonly requests: number;
  readonly cached: number;
  readonly input_tokens: number;
  readonly cost_usd: number | null;
  readonly request_ids?: readonly string[];
  readonly qhash?: string;
  readonly cache_keys?: readonly string[];
  readonly prev?: string;
  readonly fresh?: boolean;
  readonly stopped?: number;
  readonly replaced?: number;
  readonly chars?: number;
  readonly ms: number;
  readonly run_id?: string;
  readonly session_id?: string;
}

export function newReceiptId(now: number, random: () => number = Math.random): string {
  const tail = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `r${now.toString(36)}${tail}`;
}

export function receiptsDir(dataDir: string): string {
  return join(dataDir, "receipts");
}

function chainLines(dataDir: string, project: string): string[] {
  const dir = join(receiptsDir(dataDir), project);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .flatMap((f) => readFileSync(join(dir, f), "utf8").split("\n"))
    .filter((l) => l.trim());
}

export function appendReceipt(dataDir: string, receipt: Receipt): boolean {
  try {
    const dir = join(receiptsDir(dataDir), receipt.project);
    mkdirSync(dir, { recursive: true });
    const last = chainLines(dataDir, receipt.project).at(-1);
    const chained: Receipt = last === undefined ? receipt : { ...receipt, prev: sha256(last) };
    appendFileSync(join(dir, `${receipt.ts.slice(0, 7)}.jsonl`), JSON.stringify(chained) + "\n");
    return true;
  } catch {
    return false;
  }
}

export function readReceipts(dataDir: string, project?: string): Receipt[] {
  const root = receiptsDir(dataDir);
  if (!existsSync(root)) return [];
  const projects = project ? [project] : readdirSync(root);
  const out: Receipt[] = [];
  for (const p of projects.sort()) {
    const dir = join(root, p);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
      for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const value = JSON.parse(line) as Partial<Record<keyof Receipt, unknown>> | null;
          if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.id === "string" && typeof value.ts === "string") out.push(value as Receipt);
        } catch {
          continue;
        }
      }
    }
  }
  return out;
}

export interface ChainBreak {
  readonly project: string;
  readonly id: string;
  readonly kind: "mismatch" | "fork" | "unreadable";
}

export interface ChainReport {
  readonly receipts: number;
  readonly chained: number;
  readonly unchained: number;
  readonly breaks: readonly ChainBreak[];
}

// A `fork` is a prev that matches an earlier line, which two runs appending at once produce; a `mismatch` matches nothing.
export function verifyChain(dataDir: string, project?: string): ChainReport {
  const root = receiptsDir(dataDir);
  const projects = project ? [project] : existsSync(root) ? readdirSync(root).sort() : [];
  let receipts = 0;
  let chained = 0;
  const breaks: ChainBreak[] = [];
  for (const p of projects) {
    const seen: string[] = [];
    for (const line of chainLines(dataDir, p)) {
      receipts += 1;
      let r: Receipt | null = null;
      try {
        r = JSON.parse(line) as Receipt;
      } catch {
        breaks.push({ project: p, id: "?", kind: "unreadable" });
      }
      if (r?.prev !== undefined) {
        chained += 1;
        if (r.prev !== seen.at(-1)) breaks.push({ project: p, id: r.id, kind: seen.includes(r.prev) ? "fork" : "mismatch" });
      }
      seen.push(sha256(line));
    }
  }
  return { receipts, chained, unchained: receipts - chained, breaks };
}

function overrulePath(dataDir: string): string {
  return join(dataDir, "overruled.jsonl");
}

export function readOverruled(dataDir: string): Set<string> {
  const out = new Set<string>();
  let text: string;
  try {
    text = readFileSync(overrulePath(dataDir), "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    try {
      const id = (JSON.parse(line) as { id?: unknown } | null)?.id;
      if (typeof id === "string") out.add(id);
    } catch {
      continue;
    }
  }
  return out;
}

// Voids a decision: records it outside the chain (receipts are never rewritten) and drops the cache entries it used.
export function overruleReceipt(dataDir: string, id: string, ts: string): { dropped: number } | null {
  const receipt = readReceipts(dataDir).find((r) => r.id === id);
  if (!receipt) return null;
  mkdirSync(dataDir, { recursive: true });
  if (!readOverruled(dataDir).has(id)) appendFileSync(overrulePath(dataDir), JSON.stringify({ id, ts }) + "\n");
  let dropped = 0;
  for (const key of receipt.cache_keys ?? []) {
    const file = join(dataDir, "cache", `${key}.json`);
    if (existsSync(file)) {
      rmSync(file, { force: true });
      dropped += 1;
    }
  }
  return { dropped };
}
