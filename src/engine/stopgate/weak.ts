// Weak label hint for a stop from the user's NEXT prompt in the session transcript: a fixed enum reason only, never the message text.
// It can only suggest "right" (the block would have been correct), is computed on read, stored nowhere and never replaces a human label.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { userPrompts } from "./transcript.ts";

export type WeakReason = "reported_broken" | "repeated_request";

export interface WeakSuggestion {
  readonly label: "right";
  readonly reason: WeakReason;
  readonly source: "next_message";
}

const W = String.raw`(?<![\p{L}\p{N}])`;
const E = String.raw`(?![\p{L}\p{N}])`;
const compile = (patterns: readonly string[]) => patterns.map((p) => new RegExp(`${W}${p}${E}`, "iu"));
const SUBJECT = String.raw`(?:it|this|that|they|tests?|build|page|app|ci|everything|again|still|keeps?|just|now|is|are|was|were|got|goes)`;

// Report phrasing that carries its own negation; only hypothetical or instruction clauses are dropped.
const SELF_NEGATED = compile([
  String.raw`(?:doesn'?t|does not|didn'?t|did not|isn'?t|is not|aren'?t|are not|wasn'?t|was not|won'?t|will not|still not|it'?s not)\s+(?:work|working|worked|fixed|pass|passing|passed|compile|compiling)`,
  String.raw`(?:doesn'?t|does not|didn'?t|did not|isn'?t|is not|won'?t)\s+(?:build|building|run|running)`,
  String.raw`(?:çalışmıyor|çalışmadı|olmadı|olmuyor|geçmiyor|aynı\s+hata|hata\s+(?:veriyor|alıyorum|çıkıyor)|(?:hâlâ|hala|yine)\s+(?:hata|aynı|olmuyor|olmadı|çalışmıyor))`,
]);

// Bare outcome words need a subject and no negation, resolution or time-shift cue in the clause.
const OUTCOME = compile([
  String.raw`${SUBJECT}\s+(?:broken|broke|crash(?:es|ed|ing)?|failing|fails|failed|regressed)`,
  String.raw`(?:i\s+)?(?:got|get|getting|see|seeing|there'?s)\s+(?:an?\s+)?(?:error|exception|bug)`,
  String.raw`(?:it|this)\s+(?:throws|threw)\s+(?:an?\s+)?(?:error|exception)`,
  String.raw`same\s+(?:error|issue|problem|bug)`,
  String.raw`(?:bozuk|bozuldu|patlıyor|başarısız|hata\s+var)`,
]);

const NEGATION = new RegExp(
  `${W}(?:no|not|nothing|never|without|none|neither|nor|anymore|longer|now|fixed|resolved|previously|earlier|before|yok|değil|değildi|artık|düzeldi|çözüldü|hatasız)${E}|n't`,
  "iu",
);
const HYPOTHETICAL = new RegExp(
  `${W}(?:if|whether|unless|when|should|would|could|might|ensure|until|eğer|ise|olursa|olsa)${E}|make sure|in case|^\\s*(?:please\\s+)?(?:fix|add|write|create|make|handle|implement|update|remove)${E}|\\bm[ıiuü]${E}`,
  "iu",
);

function reportsBreakage(text: string): boolean {
  for (const sentence of text.match(/[^.!?;\n]+[.!?;\n]*/g) ?? []) {
    if (sentence.includes("?")) continue;
    for (const clause of sentence.split(/,|\s+(?:but|and|so|then)\s+/i)) {
      if (HYPOTHETICAL.test(clause)) continue;
      if (SELF_NEGATED.some((re) => re.test(clause))) return true;
      if (!NEGATION.test(clause) && OUTCOME.some((re) => re.test(clause))) return true;
    }
  }
  return false;
}

const SCAN_CHARS = 1000;
const MIN_TOKENS = 3;
const REASK_JACCARD = 0.6;

function tokens(text: string): Set<string> {
  return new Set((text.slice(0, SCAN_CHARS).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length >= 3));
}

export function classifyNext(next: string, previous: string): WeakReason | null {
  const head = next.slice(0, SCAN_CHARS);
  if (reportsBreakage(head)) return "reported_broken";
  const a = tokens(next);
  const b = tokens(previous);
  if (a.size < MIN_TOKENS || b.size < MIN_TOKENS) return null;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared) >= REASK_JACCARD ? "repeated_request" : null;
}

// The prompt of the turn that stopped at stopTs and the first real prompt after it.
export function suggestFromTranscript(transcript: string, stopTs: string): WeakSuggestion | null {
  try {
    const prompts = userPrompts(transcript);
    const next = prompts.find((p) => p.ts > stopTs);
    if (!next) return null;
    const before = prompts.filter((p) => p.ts <= stopTs);
    const previous = before[before.length - 1]?.text ?? "";
    const reason = classifyNext(next.text, previous);
    return reason ? { label: "right", reason, source: "next_message" } : null;
  } catch {
    return null;
  }
}

export function suggestForStops(dirs: readonly string[], stops: readonly { readonly id: string; readonly session_id: string; readonly ts: string }[]): Map<string, WeakSuggestion> {
  const out = new Map<string, WeakSuggestion>();
  const cache = new Map<string, string | null>();
  const load = (session: string): string | null => {
    if (!/^[A-Za-z0-9._-]+$/.test(session)) return null;
    if (cache.has(session)) return cache.get(session) ?? null;
    let text: string | null = null;
    for (const dir of dirs) {
      try {
        text = readFileSync(join(dir, `${session}.jsonl`), "utf8");
        break;
      } catch {
        continue;
      }
    }
    cache.set(session, text);
    return text;
  };
  for (const stop of stops) {
    const text = load(stop.session_id);
    const found = text ? suggestFromTranscript(text, stop.ts) : null;
    if (found) out.set(stop.id, found);
  }
  return out;
}
