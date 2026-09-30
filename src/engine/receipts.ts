// Local receipts: one JSON line per command run in receipts/<project>/<yyyy-mm>.jsonl.
// A receipt holds counts, tokens, cost and time; never request text, file paths or user names.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Receipt {
  readonly id: string;
  readonly ts: string;
  readonly command: string;
  readonly project: string;
  readonly pack?: string;
  readonly model?: string;
  readonly verdict?: string;
  readonly error?: string;
  readonly requests: number;
  readonly cached: number;
  readonly input_tokens: number;
  readonly cost_usd: number;
  readonly request_ids?: readonly string[];
  readonly qhash?: string;
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

export function appendReceipt(dataDir: string, receipt: Receipt): void {
  const dir = join(receiptsDir(dataDir), receipt.project);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${receipt.ts.slice(0, 7)}.jsonl`), JSON.stringify(receipt) + "\n");
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
          out.push(JSON.parse(line) as Receipt);
        } catch {
          continue;
        }
      }
    }
  }
  return out;
}
