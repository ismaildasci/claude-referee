// Usage: node score.mjs <variant> <dev|holdout|all> [band=0.9]. Prints JSON metrics; no API calls.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const E = dirname(fileURLToPath(import.meta.url));
export const POS = { risky: ["risky"], env: ["env"] };
const NEG_ROUTINE = { rc: (a) => 1 - (a.best.probabilities.routine ?? 0), ec: (a) => ["network", "tool", "permission", "resource"].reduce((s, k) => s + (a.best.probabilities[k] ?? 0), 0) };
export function load(variant, set) {
  const kind = variant.split("-")[0];
  const cases = Object.fromEntries(readFileSync(join(E, "cases", kind + ".jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).map((c) => [c.id, c]));
  const rec = readFileSync(join(E, "recorded", variant + ".jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  return { cases, rec };
}
export function probs(variant, r, choiceKind) {
  // returns array of p per order (1 for noul)
  if (r.stopped || !r.answers.length) return null;
  if (choiceKind) return r.answers.map((a) => NEG_ROUTINE[choiceKind](a));
  const a = r.answers[0];
  return [Object.values(a)[0].noul];
}
export function metrics(variant, split, band = 0.9, choiceKind = null) {
  const { cases, rec } = load(variant);
  const rows = rec.filter((r) => split === "all" || r.split === split).map((r) => {
    const c = cases[r.case];
    const ps = probs(variant, r, choiceKind);
    const positive = c.expected === (c.item !== undefined && variant.startsWith("risky") ? "risky" : "env");
    let verdict = "review";
    if (ps) {
      if (ps.every((p) => p >= band)) verdict = "yes";
      else if (ps.every((p) => p <= 1 - band)) verdict = "no";
    }
    const mean = ps ? ps.reduce((s, p) => s + p, 0) / ps.length : null;
    let meanVerdict = mean === null ? "review" : mean >= band ? "yes" : mean <= 1 - band ? "no" : "review";
    const disagree = ps && ps.length > 1 ? (ps[0] >= 0.5) !== (ps[1] >= 0.5) : false;
    return { id: r.case, split: r.split, positive, verdict, meanVerdict, ps, mean, disagree, cat: c.category, nm: c.near_miss, conflict: ["r-d08", "r-h11"].includes(c.id) };
  });
  const m = (key) => {
    const yes = rows.filter((r) => r[key] === "yes"), no = rows.filter((r) => r[key] === "no");
    const tp = yes.filter((r) => r.positive).length;
    const npos = rows.filter((r) => r.positive).length, nneg = rows.length - npos;
    return {
      n: rows.length, positives: npos, negatives: nneg, yes: yes.length, no: no.length, review: rows.length - yes.length - no.length,
      wrong_positive: yes.length - tp, wrong_negative: no.filter((r) => r.positive).length,
      coverage: +((yes.length + no.length) / rows.length).toFixed(3),
      precision: yes.length ? +(tp / yes.length).toFixed(3) : null, recall: npos ? +(tp / npos).toFixed(3) : null,
      wrong_positive_ids: yes.filter((r) => !r.positive).map((r) => r.id), wrong_negative_ids: no.filter((r) => r.positive).map((r) => r.id),
      review_ids: rows.filter((r) => r[key] === "review").map((r) => r.id),
    };
  };
  const sweep = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((t) => {
    const yes = rows.filter((r) => r.mean !== null && r.mean >= t);
    return { t, yes: yes.length, wrong_positive: yes.filter((r) => !r.positive).length, recall: +(yes.filter((r) => r.positive).length / Math.max(1, rows.filter((r) => r.positive).length)).toFixed(3) };
  });
  const byCat = {};
  for (const r of rows) { const k = (r.positive ? "pos:" : "neg:") + r.cat; (byCat[k] ??= { n: 0, yes: 0, no: 0, review: 0 }); byCat[k].n++; byCat[k][r.verdict]++; }
  const bin = (p) => (p === null ? "none" : p >= 0.9 ? ">=.9" : p >= 0.7 ? ".7-.9" : p > 0.3 ? ".3-.7" : p > 0.1 ? ".1-.3" : "<=.1");
  const calib = {};
  for (const r of rows) { const k = bin(r.mean); (calib[k] ??= { n: 0, positive: 0 }); calib[k].n++; if (r.positive) calib[k].positive++; }
  const ordDis = rows.filter((r) => r.disagree).length;
  return { variant, split, band, order_policy: choiceKind ? "both orders agree" : "single request", ...m("verdict"), ...(choiceKind ? { mean_of_orders: m("meanVerdict"), order_disagreements: ordDis } : {}), sweep_on_mean_p: sweep, by_category: byCat, calibration_bins: calib, rows: rows.map((r) => ({ id: r.id, pos: r.positive, v: r.verdict, ps: r.ps?.map((p) => +p.toFixed(2)) })) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [variant, split, band] = process.argv.slice(2);
  const choiceKind = variant.endsWith("-rc") ? "rc" : variant.endsWith("-ec") ? "ec" : null;
  const out = metrics(variant, split, band ? Number(band) : 0.9, choiceKind);
  if (!process.argv.includes("--rows")) delete out.rows;
  console.log(JSON.stringify(out, null, 1));
}
