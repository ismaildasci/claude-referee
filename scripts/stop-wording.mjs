// Measures the Stop done-gate's would_block on labelled final messages for one wording of stop.claims_done (docs/decisions/stop-negation.md).
// Usage: node scripts/stop-wording.mjs run --variant A|B|C --split dev|holdout [--out file] | score --base file --variant file [--split dev|holdout]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const PACK = "plugins/claude-referee/packs/generic";
const SUITE = "jev-evals/stop-negation";
const [mode, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : fallback);
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const lines = (path) => readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

function apiKey() {
  if (!/^https:\/\/api\.typesafe\.ai(\/|$)/.test(BASE)) throw new Error("TYPESAFE_BASE_URL points away from api.typesafe.ai: the key is never sent there.");
  const own = process.env.TYPESAFE_API_KEY?.trim();
  return own || execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

async function ask(key, state, questions) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/v1/systemone`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: MODEL, state, questions }), signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    if (res.status === 429 && attempt < 6) {
      await sleep(Math.min(500 * 2 ** attempt, 8000));
      continue;
    }
    if (res.status !== 200) throw new Error(`status ${res.status}: ${text.slice(0, 200)}`);
    const body = JSON.parse(text);
    return { answers: body.answers, tokens: body.usage?.input_tokens ?? 0 };
  }
}

function questionsFor(variant) {
  const stop = json(`${PACK}/questions/stop.json`);
  const claimsDone = variant === "A" ? stop["stop.claims_done"] : json(`${SUITE}/variants.json`)[variant];
  if (!claimsDone) throw new Error(`unknown variant ${variant}`);
  return { claims_done: claimsDone, claims_verified: stop["stop.claims_verified"], verification_applies: stop["stop.verification_applies"], outcome: stop["stop.outcome"] };
}

// Same rule as decideStop in src/hooks/stop.ts with the pack's stop.gate thresholds.
function wouldBlock(a, gate) {
  const noul = (id) => a?.[id]?.noul;
  const blocked = a?.outcome?.probabilities?.blocked ?? 0;
  return noul("claims_done") >= gate.claims_done && noul("claims_verified") < gate.claims_verified && noul("verification_applies") >= gate.verification_applies && blocked < gate.blocked;
}

async function run() {
  const variant = flag("--variant", "A");
  const split = flag("--split", "dev");
  const out = flag("--out", `${SUITE}/results-${variant}-${split}.json`);
  const gate = json(`${PACK}/thresholds.json`)["stop.gate"];
  const excluded = new Set(json(`${SUITE}/labels.json`).excluded);
  const cases = lines(`${SUITE}/cases.jsonl`).filter((c) => c.split === split && !excluded.has(c.id));
  const questions = questionsFor(variant);
  const key = apiKey();
  const results = [];
  let tokens = 0;
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < cases.length) {
      const c = cases[next++];
      const state = { task: c.task, final_message: c.final_message, checks: c.checks, edits: c.edits };
      const { answers, tokens: t } = await ask(key, state, questions);
      tokens += t;
      results.push({ id: c.id, expected: c.expected, claims_done: answers.claims_done?.noul, claims_verified: answers.claims_verified?.noul, verification_applies: answers.verification_applies?.noul, blocked: answers.outcome?.probabilities?.blocked ?? 0, would_block: wouldBlock(answers, gate) });
    }
  }));
  results.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(out, JSON.stringify({ variant, split, model: MODEL, gate, input_tokens: tokens, ran_at: new Date().toISOString(), results }, null, 1) + "\n");
  console.log(`${variant}/${split}: ${results.length} cases, ${tokens} input tokens -> ${out}`);
}

const tally = (rs) => ({
  negated_blocked: rs.filter((r) => r.expected === "no_claim" && r.would_block).length,
  negated: rs.filter((r) => r.expected === "no_claim").length,
  claims_blocked: rs.filter((r) => r.expected === "claim" && r.would_block).length,
  claims: rs.filter((r) => r.expected === "claim").length,
});

function score() {
  const base = json(flag("--base"));
  const variant = json(flag("--variant"));
  const byId = new Map(base.results.map((r) => [r.id, r]));
  const b = tally(base.results);
  const v = tally(variant.results);
  const lostClaims = variant.results.filter((r) => r.expected === "claim" && byId.get(r.id)?.would_block && !r.would_block).map((r) => r.id);
  const fixedNegated = variant.results.filter((r) => r.expected === "no_claim" && byId.get(r.id)?.would_block && !r.would_block).map((r) => r.id);
  const newFalseBlocks = variant.results.filter((r) => r.expected === "no_claim" && !byId.get(r.id)?.would_block && r.would_block).map((r) => r.id);
  const bar = { fewer_false_blocks_by_2: v.negated_blocked <= b.negated_blocked - 2, no_true_done_claim_lost: lostClaims.length === 0 };
  console.log(JSON.stringify({ split: variant.split, base: { variant: base.variant, ...b }, variant: { variant: variant.variant, ...v }, fixed_negated: fixedNegated, new_false_blocks: newFalseBlocks, lost_claims: lostClaims, bar, adopt: bar.fewer_false_blocks_by_2 && bar.no_true_done_claim_lost }, null, 1));
}

if (mode === "run") await run();
else if (mode === "score") score();
else {
  console.error("usage: stop-wording.mjs run --variant A|B|C --split dev|holdout [--out file] | score --base file --variant file");
  process.exit(2);
}
