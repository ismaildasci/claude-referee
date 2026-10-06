// Dev step of the second sample (docs/decisions/i18n-real-2.md): scratch eval suites per wording, then the registered choice.
// Usage: node wordings.mjs prepare --dev SUITE_DIR --evals DIR --packs a,b,...; record each with eval record (REFEREE_PACKS_DIR set); node wordings.mjs score --evals DIR --packs a,b,...

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const EVALS = flag("evals");
const PACKS = (flag("packs") ?? "").split(",").filter(Boolean);
if (!EVALS || PACKS.length === 0) throw new Error("--evals and --packs are required");
const jsonl = (file) => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const verdict = (p) => (p >= 0.9 ? "yes" : p <= 0.1 ? "no" : "review");
const sets = { newdev: () => jsonl(join(flag("dev"), "cases.jsonl")), syndev: () => jsonl("jev-evals/judge-i18n/cases.jsonl").filter((c) => c.split === "dev") };

if (args[0] === "prepare") {
  for (const pack of PACKS) {
    for (const [set, load] of Object.entries(sets)) {
      const dir = join(EVALS, `${pack}-${set}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "suite.json"), `${JSON.stringify({ command: "judge", question: "string.translatable", pack, positive: "yes", note: `dev scoring of ${pack} on ${set}` })}\n`);
      writeFileSync(join(dir, "cases.jsonl"), load().map((c) => JSON.stringify({ id: c.id, split: "dev", expected: c.expected, text: c.text, context: c.context })).join("\n") + "\n");
    }
  }
  console.log(`prepared ${PACKS.length * 2} suites in ${EVALS}`);
} else if (args[0] === "score") {
  const out = {};
  for (const pack of PACKS) {
    const row = {};
    for (const set of Object.keys(sets)) {
      const dir = join(EVALS, `${pack}-${set}`);
      const cases = jsonl(join(dir, "cases.jsonl"));
      const rec = existsSync(join(dir, "recorded.jsonl")) ? new Map(jsonl(join(dir, "recorded.jsonl")).map((r) => [r.case, r.answers["string.translatable"].noul])) : new Map();
      const rows = cases.map((c) => ({ ...c, p: rec.get(c.id), v: rec.has(c.id) ? verdict(rec.get(c.id)) : "missing" }));
      row[set] = {
        n: rows.length,
        missing: rows.filter((r) => r.v === "missing").length,
        wrong_yes: rows.filter((r) => r.expected === "no" && r.v === "yes").length,
        wrong_no: rows.filter((r) => r.expected === "yes" && r.v === "no").length,
        correct_no: rows.filter((r) => r.expected === "no" && r.v === "no").length,
        correct_yes: rows.filter((r) => r.expected === "yes" && r.v === "yes").length,
        definite: rows.filter((r) => r.v === "yes" || r.v === "no").length,
        median_p_no: median(rows.filter((r) => r.expected === "no").map((r) => r.p)),
        median_p_yes: median(rows.filter((r) => r.expected === "yes").map((r) => r.p)),
      };
    }
    const chars = existsSync(join("docs/data/i18n-real-2/wordings", pack, "questions/judge.json")) ? JSON.stringify(JSON.parse(readFileSync(join("docs/data/i18n-real-2/wordings", pack, "questions/judge.json"), "utf8"))["string.translatable"]).length : null;
    out[pack] = { ...row, chars, qualifies: row.newdev.wrong_yes === 0 && row.newdev.wrong_no === 0 && row.syndev.wrong_yes === 0 && row.syndev.wrong_no === 0 && row.newdev.missing === 0 && row.syndev.missing === 0 };
  }
  const candidates = Object.entries(out).filter(([p, r]) => p !== "i18n" && r.qualifies);
  candidates.sort(([, a], [, b]) => b.newdev.correct_no - a.newdev.correct_no || b.newdev.definite - a.newdev.definite || a.chars - b.chars);
  const result = { packs: out, chosen: candidates[0]?.[0] ?? null, rule: "no wrong yes or no on both dev sets; then most correct no on new dev, most definite, shorter text" };
  console.log(JSON.stringify(result, null, 1));
}

function median(xs) {
  const v = xs.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length / 2;
  return v.length % 2 ? v[Math.floor(m)] : (v[m - 1] + v[m]) / 2;
}
