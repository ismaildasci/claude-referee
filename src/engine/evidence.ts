// Opt-in local store of done evidence, redacted like the Jev request, kept 14 days, plus the owner's right/wrong labels (docs/decisions/local-evidence-labels.md).
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { redact, type RedactOptions } from "./redact.ts";

export const KEEP_ENV = "REFEREE_KEEP_EVIDENCE";
export const EVIDENCE_DAYS = 14;
const DAY_MS = 86_400_000;
const ID = /^[a-z0-9]{1,40}$/;

export interface StoredEvidence {
  readonly id: string;
  readonly ts: string;
  readonly criteria: readonly string[];
  readonly evidence: string;
}

export interface EvidenceLabel {
  readonly id: string;
  readonly label: "right" | "wrong";
  readonly labelled_at: string;
}

export function keepsEvidence(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[KEEP_ENV] === "1";
}

const evidenceDir = (dataDir: string): string => join(dataDir, "evidence");
const labelsFile = (dataDir: string): string => join(dataDir, "receipt-labels.jsonl");

function prune(dir: string, now: number): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    try {
      if (now - statSync(path).mtimeMs > EVIDENCE_DAYS * DAY_MS) rmSync(path);
    } catch {
      continue;
    }
  }
}

export function storeEvidence(dataDir: string, receiptId: string, input: { criteria: readonly string[]; evidence: string; home: string; extra?: RedactOptions["extra"]; now: number }): boolean {
  if (!ID.test(receiptId)) return false;
  try {
    const dir = evidenceDir(dataDir);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const redacted = redact({ criteria: [...input.criteria], evidence: input.evidence }, { home: input.home, extra: input.extra }).value;
    const record: StoredEvidence = { id: receiptId, ts: new Date(input.now).toISOString(), criteria: redacted.criteria, evidence: redacted.evidence };
    writeFileSync(join(dir, `${receiptId}.json`), JSON.stringify(record), { mode: 0o600 });
    prune(dir, input.now);
    return true;
  } catch {
    return false;
  }
}

export function readEvidence(dataDir: string, receiptId: string): StoredEvidence | null {
  if (!ID.test(receiptId)) return null;
  try {
    return JSON.parse(readFileSync(join(evidenceDir(dataDir), `${receiptId}.json`), "utf8")) as StoredEvidence;
  } catch {
    return null;
  }
}

export function labelReceipt(dataDir: string, receiptId: string, label: "right" | "wrong", nowIso: string): boolean {
  if (!ID.test(receiptId)) return false;
  try {
    mkdirSync(dataDir, { recursive: true });
    appendFileSync(labelsFile(dataDir), JSON.stringify({ id: receiptId, label, labelled_at: nowIso }) + "\n", { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export function readReceiptLabels(dataDir: string): EvidenceLabel[] {
  try {
    return readFileSync(labelsFile(dataDir), "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const row = JSON.parse(line) as EvidenceLabel;
          return row.label === "right" || row.label === "wrong" ? [row] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}
