// Offline replay of the code-only Stop note (docs/decisions/stop-code-note.md) over recorded study sessions; no Jev or Claude call.
// Usage: node scripts/session-study/replay-note.mjs <study-dir> [<study-dir> ...]  (each has sessions/<id>/{ground.json,transcript.jsonl} and manual.json)

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { clopperPearson } from "../../src/engine/stopgate/interval.ts";
import { stopSkipReason } from "../../src/engine/stopgate/decide.ts";
import { analyzeTranscript } from "../../src/engine/stopgate/transcript.ts";
import { readGrounds } from "./runner.mjs";
import { classifyClaim } from "./lib.mjs";

const EXCLUDED = ["leaked", "run_failed", "error", "unresolved"];
const r3 = (v) => (v === null ? null : Math.round(v * 1000) / 1000);
const frac = (k, n) => ({ k, n, value: n ? r3(k / n) : null, ci95: n ? [r3(clopperPearson(k, n).lower), r3(clopperPearson(k, n).upper)] : null });

export function replayStudy(dir) {
  const rows = [];
  for (const g of readGrounds(dir)) {
    const file = join(dir, "sessions", g.id, "transcript.jsonl");
    const facts = existsSync(file) ? analyzeTranscript(readFileSync(file, "utf8")) : null;
    const codeSide = facts ? stopSkipReason(facts) === null : false;
    const kw = classifyClaim(g.final_message);
    rows.push({
      id: g.id,
      class: g.class,
      usable: !EXCLUDED.includes(g.class),
      has_transcript: Boolean(facts),
      kw,
      codeSide,
      fireA: codeSide && kw === "claim",
      fireB: codeSide && (kw === "claim" || kw === "ambiguous"),
      jev: g.stop && !g.stop.skipped && g.stop.would_block !== undefined ? g.stop.would_block : null,
      replayEdits: facts?.edits.length ?? null,
      replayChecks: facts?.checks.length ?? null,
      recEdits: g.stop?.edits ?? null,
      recChecks: g.stop?.checks ?? null,
      recSkipped: g.stop?.skipped ?? null,
    });
  }
  return rows;
}

function metrics(rows, fires) {
  const u = rows.filter((r) => r.usable);
  const wrong = u.filter((r) => r.class === "wrong_done");
  const right = u.filter((r) => r.class === "true_done");
  const fired = u.filter(fires);
  const tp = fired.filter((r) => r.class === "wrong_done").length;
  const askedRight = right.filter((r) => r.jev !== null);
  return {
    fires: fired.length,
    precision_wrong_done: frac(tp, fired.length),
    recall_all_wrong: frac(tp, wrong.length),
    false_block_all_true_done: frac(right.filter(fires).length, right.length),
    false_block_asked_true_done: frac(askedRight.filter(fires).length, askedRight.length),
  };
}

export function summarize(rows) {
  const u = rows.filter((r) => r.usable);
  const jev = (r) => r.jev === true;
  const out = {
    usable: u.length,
    classes: Object.fromEntries(Object.entries(Object.groupBy(u, (r) => r.class)).map(([k, v]) => [k, v.length])),
    jev: metrics(rows, jev),
    code_A: metrics(rows, (r) => r.fireA),
    code_B: metrics(rows, (r) => r.fireB),
    code_A_and_jev: metrics(rows, (r) => r.fireA && jev(r)),
    jev_without_code_A: u.filter((r) => jev(r) && !r.fireA).map((r) => ({ id: r.id, class: r.class, kw: r.kw, codeSide: r.codeSide })),
    code_A_without_jev: u.filter((r) => r.fireA && !jev(r)).map((r) => ({ id: r.id, class: r.class, jev: r.jev })),
    wrong_done_caught_by_B_not_A: u.filter((r) => r.class === "wrong_done" && r.fireB && !r.fireA).map((r) => r.id),
    consistency: {
      no_transcript: rows.filter((r) => !r.has_transcript).length,
      recorded_stops: u.filter((r) => r.recEdits !== null).length,
      edits_mismatch: u.filter((r) => r.recEdits !== null && r.replayEdits !== null && r.recEdits !== r.replayEdits).map((r) => r.id),
      checks_mismatch: u.filter((r) => r.recChecks !== null && r.replayChecks !== null && r.recChecks !== r.replayChecks).map((r) => r.id),
      asked_vs_codeside_mismatch: u.filter((r) => r.recEdits !== null && (r.recSkipped === null) !== r.codeSide).map((r) => ({ id: r.id, skipped: r.recSkipped, codeSide: r.codeSide })),
    },
  };
  return out;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const dirs = process.argv.slice(2);
  const all = [];
  const report = {};
  for (const d of dirs) {
    const rows = replayStudy(d);
    all.push(...rows);
    report[d] = summarize(rows);
  }
  report.pooled = summarize(all);
  console.log(JSON.stringify(report, null, 1));
}
