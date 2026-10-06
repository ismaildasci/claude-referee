// Hold-out step of the second sample (docs/decisions/i18n-real-2.md): the registered adoption rule from three recorded suites.
// Usage: node compare.mjs OLD_SUITE_DIR NEW_SUITE_DIR SYNTHETIC_NEW_SUITE_DIR. Bands as the pack: yes at 0.90 or more, no at 0.10 or less.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clopperPearson, upperOneSided } from "../real-ci/lib.mjs";

const [oldDir, newDir, synDir] = process.argv.slice(2);
if (!synDir) throw new Error("usage: node compare.mjs OLD_SUITE NEW_SUITE SYNTHETIC_NEW_SUITE");
const jsonl = (file) => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const verdict = (p) => (p >= 0.9 ? "yes" : p <= 0.1 ? "no" : "review");

function tally(dir) {
  const rec = new Map(jsonl(join(dir, "recorded.jsonl")).map((r) => [r.case, r.answers["string.translatable"].noul]));
  const rows = jsonl(join(dir, "cases.jsonl")).map((c) => {
    if (!rec.has(c.id)) throw new Error(`${dir}: no answer for ${c.id}`);
    return { ...c, p: rec.get(c.id), v: verdict(rec.get(c.id)) };
  });
  const yes = rows.filter((r) => r.expected === "yes");
  const no = rows.filter((r) => r.expected === "no");
  const definite = rows.filter((r) => r.v !== "review").length;
  const by = (key) => Object.fromEntries([...new Set(rows.map((r) => r[key]))].sort().map((k) => {
    const sub = rows.filter((r) => r[key] === k);
    return [k, { n: sub.length, wrong_yes: sub.filter((r) => r.expected === "no" && r.v === "yes").length, wrong_no: sub.filter((r) => r.expected === "yes" && r.v === "no").length, correct_no: sub.filter((r) => r.expected === "no" && r.v === "no").length, definite: sub.filter((r) => r.v !== "review").length }];
  }));
  const wrongYes = no.filter((r) => r.v === "yes");
  const wrongNo = yes.filter((r) => r.v === "no");
  return {
    n: rows.length,
    expected_yes: yes.length,
    expected_no: no.length,
    verdicts: { yes: rows.filter((r) => r.v === "yes").length, review: rows.filter((r) => r.v === "review").length, no: rows.filter((r) => r.v === "no").length },
    wrong_yes: wrongYes.length,
    wrong_yes_upper95: upperOneSided(wrongYes.length, no.length),
    wrong_no: wrongNo.length,
    wrong_no_upper95: upperOneSided(wrongNo.length, yes.length),
    correct_no: no.filter((r) => r.v === "no").length,
    correct_yes: yes.filter((r) => r.v === "yes").length,
    coverage: Number((definite / rows.length).toFixed(3)),
    coverage_ci95: clopperPearson(definite, rows.length),
    median_p_no: median(no.map((r) => r.p)),
    median_p_yes: median(yes.map((r) => r.p)),
    wrong_ids: [...wrongYes, ...wrongNo].map((r) => `${r.id} (${r.expected}, p ${r.p})`),
    by_framework: rows[0]?.framework === undefined ? undefined : by("framework"),
    by_origin: rows[0]?.origin === undefined ? undefined : by("origin"),
  };
}

function median(xs) {
  const v = [...xs].sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length / 2;
  return v.length % 2 ? v[Math.floor(m)] : (v[m - 1] + v[m]) / 2;
}

const oldT = tally(oldDir);
const newT = tally(newDir);
const synT = tally(synDir);
const checks = {
  new_no_wrong_no: newT.wrong_no === 0,
  new_wrong_yes_not_higher: newT.wrong_yes <= oldT.wrong_yes,
  new_more_correct_no: newT.correct_no > oldT.correct_no,
  synthetic_bar_kept: synT.wrong_yes === 0 && synT.wrong_no === 0,
};
console.log(JSON.stringify({ old: oldT, new: newT, synthetic_new: synT, checks, adopted: Object.values(checks).every(Boolean) }, null, 1));
