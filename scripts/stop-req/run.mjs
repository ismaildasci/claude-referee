// Harness of the stop-requirements study (docs/decisions/stop-requirements-question.md): prepare | run (dev) | select | fresh | holdout | report. Answers go to jev-evals/stop-req/recorded.jsonl (hashes and answers, never state text).
// Usage: node scripts/stop-req/run.mjs <cmd> --study base=<dir> --study hard=<dir> [--study fresh=<dir>] [--split dev|holdout|fresh] [--configs id,id] [--limit n] [--write]

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { questionHash, redactRequest, stateHash } from "../../src/engine/session.ts";
import { EXCLUDED, classifyClaim } from "../stop-state/features.mjs";
import { allConfigs, BASELINE, buildState, configs, meanScore, readGrounds, REPS, reqFeatures, scoreOf, ANSWER_KEY, WORDINGS } from "./states.mjs";
import { adoption, devThreshold, pairedDiff, summarize, tally, withinTaskAuc } from "./stats.mjs";

const DIR = "jev-evals/stop-req";
const OLD = "jev-evals/stop-state";
const RECORDED = `${DIR}/recorded.jsonl`;
const OLD_RECORDED = `${OLD}/recorded.jsonl`;
const SESSIONS = `${DIR}/sessions.json`;
const FROZEN = `${DIR}/frozen.json`;
const GENERIC = "plugins/claude-referee/packs/generic";
const PACK = `${DIR}/packs/stop-req`;
const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const HOME = process.env.HOME ?? "";

const [cmd, ...rest] = process.argv.slice(2);
const flags = (name) => rest.flatMap((a, i) => (a === name ? [rest[i + 1]] : []));
const flag = (name, fallback) => flags(name)[0] ?? fallback;
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const lines = (path) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
const studies = flags("--study").map((s) => {
  const i = s.indexOf("=");
  return { label: s.slice(0, i), dir: s.slice(i + 1) };
});

function apiKey() {
  if (!/^https:\/\/api\.typesafe\.ai(\/|$)/.test(BASE)) throw new Error("TYPESAFE_BASE_URL points away from api.typesafe.ai: the key is never sent there.");
  const own = process.env.TYPESAFE_API_KEY?.trim();
  return own || execFileSync("security", ["find-generic-password", "-s", "TYPESAFE_API_KEY", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

async function ask(key, body) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE}/v1/systemone`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: MODEL, ...body }), signal: AbortSignal.timeout(60_000) });
    } catch (error) {
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      return { error: `fetch: ${String(error?.message ?? error).slice(0, 120)}` };
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await sleep(Math.min(500 * 2 ** attempt, 8000));
      continue;
    }
    if (res.status !== 200) return { error: `status ${res.status}: ${text.slice(0, 160)}` };
    const parsed = JSON.parse(text);
    return { answers: parsed.answers, input_tokens: parsed.usage?.input_tokens ?? 0, request_id: res.headers.get("x-request-id") ?? parsed.id ?? null, model: parsed.model ?? MODEL };
  }
}

function questionsFor(cfg) {
  if (cfg.wording === 0) {
    const stop = json(`${GENERIC}/questions/stop.json`);
    return { claims_done: stop["stop.claims_done"], claims_verified: stop["stop.claims_verified"], verification_applies: stop["stop.verification_applies"], outcome: stop["stop.outcome"] };
  }
  const req = json(`${PACK}/questions/req.json`);
  return { [ANSWER_KEY[cfg.wording]]: req[WORDINGS[cfg.wording]] };
}

function groundsOf() {
  return studies.flatMap(({ label, dir }) => readGrounds(dir, label === "fresh" ? "hard" : label).map((g) => ({ ...g, set: label === "fresh" ? "fresh" : "old" })));
}

function prepare() {
  const old = new Map(json(`${OLD}/sessions.json`).sessions.map((s) => [s.id, s]));
  const usable = groundsOf().filter((g) => !EXCLUDED.includes(g.class));
  const rows = usable.map((g) => {
    const f = reqFeatures(g);
    const kw = classifyClaim(g.final_message);
    const claim = f.cls === "true_done" || f.cls === "wrong_done";
    const split = g.set === "fresh" ? "fresh" : (old.get(f.id)?.split ?? null);
    return { id: f.id, task: f.task, study: f.study, set: g.set, model: g.model ?? null, cls: f.cls, split, in_population: claim && f.facts.edits.length >= 1, n_edits: f.facts.edits.length, asked: f.asked, kw, fire_a: f.asked && kw === "claim", fire_b: f.asked && (kw === "claim" || kw === "ambiguous"), gate_recorded: g.stop && !g.stop.skipped && g.stop.would_block !== undefined ? g.stop.would_block : null, check_results: f.checkResults.length, edit_stat_files: f.editStats.length, consistency: { edits_match: f.editsMatch, checks_matched: f.checkResultsMatched } };
  });
  const missingSplit = rows.filter((r) => r.set === "old" && r.split === null && r.in_population).map((r) => r.id);
  writeFileSync(SESSIONS, JSON.stringify({ generated_by: "scripts/stop-req/run.mjs prepare", sessions: rows }, null, 1) + "\n");
  const pop = rows.filter((r) => r.in_population);
  const part = (name) => pop.filter((r) => r.split === name);
  const count = (list, cls) => list.filter((r) => r.cls === cls).length;
  const view = (list) => ({ n: list.length, wrong: count(list, "wrong_done"), true: count(list, "true_done"), tasks: new Set(list.map((r) => r.task)).size });
  console.log(JSON.stringify({ usable: rows.length, population: pop.length, claim_without_edit: rows.filter((r) => (r.cls === "true_done" || r.cls === "wrong_done") && !r.in_population).length, dev: view(part("dev")), dev_hard: view(part("dev").filter((r) => r.study === "hard")), holdout: view(part("holdout")), holdout_hard: view(part("holdout").filter((r) => r.study === "hard")), fresh: view(part("fresh")), fresh_by_model: Object.fromEntries(["sonnet", "haiku"].map((m) => [m, view(part("fresh").filter((r) => r.model === m))])), missing_split: missingSplit, edits_mismatch: rows.filter((r) => !r.consistency.edits_match).map((r) => r.id), checks_unmatched: rows.filter((r) => !r.consistency.checks_matched).map((r) => r.id) }, null, 1));
}

const recKey = (r) => `${r.config}|${r.session}|${r.rep ?? 1}`;
const recordedMap = (path) => new Map(lines(path).map((r) => [recKey(r), r]));

async function runRequests(splitName, cfgList, reps, { limit, probe } = {}) {
  const sessions = json(SESSIONS).sessions.filter((s) => s.in_population && s.split === splitName);
  const features = new Map(groundsOf().filter((g) => sessions.some((s) => s.id === g.id)).map((g) => [g.id, reqFeatures(g)]));
  const have = recordedMap(RECORDED);
  const redactExtra = json(`${GENERIC}/redact.json`);
  const jobs = [];
  for (const cfg of cfgList) {
    const questions = questionsFor(cfg);
    for (const rep of cfg.id === "A" ? [1] : reps) {
      for (const s of sessions) {
        const prior = have.get(recKey({ config: cfg.id, session: s.id, rep }));
        if (prior && !prior.error) continue;
        const f = features.get(s.id);
        if (!f) throw new Error(`no features for ${s.id}`);
        const prepared = redactRequest({ id: s.id, state: buildState(cfg, f), questions }, HOME, redactExtra);
        jobs.push({ cfg, s, rep, prepared, state_chars: JSON.stringify(prepared.body.state).length });
      }
    }
  }
  const todo = probe ? [jobs.reduce((a, b) => (b.state_chars > a.state_chars ? b : a))] : limit ? jobs.slice(0, Number(limit)) : jobs;
  console.error(`${todo.length} requests (${jobs.length} missing) on ${splitName}`);
  const key = todo.some((j) => !j.prepared.stops.length) ? apiKey() : "";
  let next = 0;
  let done = 0;
  let errors = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < todo.length) {
        const j = todo[next++];
        const base = { suite: "stop-req", case: `${j.cfg.id}:${j.s.id}`, config: j.cfg.id, session: j.s.id, split: splitName, rep: j.rep, model: MODEL, pack: j.cfg.wording === 0 ? "generic@0.1.0" : "stop-req@0.1.0", qhash: questionHash(j.prepared.body.questions), shash: stateHash(j.prepared.body.state), state_chars: j.state_chars, replaced: j.prepared.replaced };
        let line;
        if (j.prepared.stops.length) line = { ...base, error: `redaction_stop: ${j.prepared.stops.map((x) => x.kind).join(",")}` };
        else {
          const r = await ask(key, j.prepared.body);
          line = r.error ? { ...base, error: r.error } : { ...base, answers: r.answers, input_tokens: r.input_tokens, request_id: r.request_id, response_model: r.model };
        }
        if (line.error) errors++;
        appendFileSync(RECORDED, JSON.stringify({ ...line, recorded_at: new Date().toISOString() }) + "\n");
        if (++done % 100 === 0) console.error(`${done}/${todo.length}, ${errors} errors`);
      }
    }),
  );
  console.error(`done: ${done} requests, ${errors} errors`);
}

// Rows of one configuration on one split: the mean score over its repetitions (A: repetition 1, from the stop-state records on dev and hold-out).
function rowsFor(cfg, splitName, filter = () => true, repList = null) {
  const sessions = json(SESSIONS).sessions.filter((s) => s.in_population && s.split === splitName && filter(s));
  const own = recordedMap(RECORDED);
  const old = cfg.id === "A" && splitName !== "fresh" ? recordedMap(OLD_RECORDED) : null;
  const reps = cfg.id === "A" ? [1] : (repList ?? REPS);
  const rows = [];
  let missing = 0;
  let chars = 0;
  for (const s of sessions) {
    const recs = reps.map((rep) => (old ? old.get(recKey({ config: "A", session: s.id, rep })) : own.get(recKey({ config: cfg.id, session: s.id, rep }))));
    const score = meanScore(recs.map((r) => (r && !r.error ? scoreOf(cfg, r.answers) : null)));
    if (score === null) {
      missing++;
      continue;
    }
    chars += recs[0].state_chars;
    rows.push({ id: s.id, task: s.task, cls: s.cls, study: s.study, model: s.model, asked: s.asked, score, answers: recs[0].answers });
  }
  return { rows, missing, total: sessions.length, mean_chars: rows.length ? Math.round(chars / rows.length) : 0 };
}

const hardOnly = (s) => s.study === "hard";

function devTable() {
  return configs().map((cfg) => {
    const hard = rowsFor(cfg, "dev", hardOnly);
    const all = rowsFor(cfg, "dev");
    const h = summarize(hard.rows, { withBootstrap: false });
    const r1 = summarize(rowsFor(cfg, "dev", hardOnly, [1]).rows, { withBootstrap: false });
    const r2 = summarize(rowsFor(cfg, "dev", hardOnly, [2]).rows, { withBootstrap: false });
    return { config: cfg.id, family: cfg.family, auc_hard: h.auc, perm_p_hard: h.perm_p, auc_hard_rep1: r1.auc, auc_hard_rep2: r2.auc, auc_all: summarize(all.rows, { withBootstrap: false }).auc, wrong: h.wrong, true: h.true, missing: all.missing, total: all.total, error_rate: all.total ? Math.round((all.missing / all.total) * 1000) / 1000 : null, mean_chars: hard.mean_chars };
  });
}

function pick(table, family) {
  const usable = table.filter((t) => t.family === family && t.auc_hard !== null && t.error_rate <= 0.02);
  const best = Math.max(...usable.map((t) => t.auc_hard));
  const near = usable.filter((t) => t.auc_hard >= best - 0.01 - 1e-9);
  const order = configs().map((c) => c.id);
  near.sort((a, b) => a.mean_chars - b.mean_chars || order.indexOf(a.config) - order.indexOf(b.config));
  const chosen = near[0];
  const cfg = configs().find((c) => c.id === chosen.config);
  return { config: chosen.config, threshold: devThreshold(rowsFor(cfg, "dev", hardOnly).rows, 0.7), dev_hard_auc: chosen.auc_hard, dev_hard_best_auc: best, near_best: near.map((x) => x.config) };
}

function select() {
  const table = devTable();
  const primary = pick(table, "primary");
  const secondary = pick(table, "secondary");
  const frozen = { primary, secondary, dev_failure: primary.dev_hard_best_auc < 0.6, frozen_at: new Date().toISOString() };
  console.log(JSON.stringify({ table, frozen }, null, 1));
  return frozen;
}

function wouldBlock(a) {
  const g = json(`${GENERIC}/thresholds.json`)["stop.gate"];
  const noul = (id) => a?.[id]?.noul;
  return noul("claims_done") >= g.claims_done && noul("claims_verified") < g.claims_verified && noul("verification_applies") >= g.verification_applies && (a?.outcome?.probabilities?.blocked ?? 0) < g.blocked;
}

function keywordNote(splitName, filter = () => true) {
  const sessions = json(SESSIONS).sessions.filter((s) => s.in_population && s.split === splitName && filter(s));
  const rows = (fire) => sessions.map((s) => ({ ...s, score: fire(s) ? 1 : 0 }));
  return { reading_A: tally(rows((s) => s.fire_a), 1), reading_B: tally(rows((s) => s.fire_b), 1) };
}

function viewReport(cfg, splitName, threshold, filter) {
  const { rows, missing } = rowsFor(cfg, splitName, filter);
  const base = rowsFor(BASELINE, splitName, filter).rows;
  const out = { missing, summary: summarize(rows), within_task: withinTaskAuc(rows), at_threshold: threshold === null || threshold === undefined ? null : tally(rows, threshold), vs_A: pairedDiff(rows, base) };
  out.by_model = Object.fromEntries(["sonnet", "haiku"].map((m) => [m, summarize(rows.filter((r) => r.model === m), { withBootstrap: false })]));
  return { out, rows };
}

function candidateReport(cfgId, threshold, splitName, sig) {
  const cfg = configs().find((c) => c.id === cfgId);
  const all = viewReport(cfg, splitName, threshold, () => true);
  const hard = viewReport(cfg, splitName, threshold, hardOnly);
  const asked = rowsFor(cfg, splitName, (s) => s.asked).rows;
  const report = { config: cfgId, threshold, all: all.out, hard_only: hard.out, asked_only: { ...summarize(asked, { withBootstrap: false }), at_threshold: tally(asked, threshold) } };
  if (splitName === "fresh") {
    const note = keywordNote("fresh");
    const a = viewReport(BASELINE, "fresh", threshold, () => true).out.summary;
    report.keyword_note = note;
    report.adoption = adoption({ summary: all.out.summary, tally: all.out.at_threshold, baselineAuc: a.auc, keywordB: note.reading_B, sig });
  }
  return report;
}

function baselineReport(splitName, threshold) {
  const rows = rowsFor(BASELINE, splitName).rows;
  const hard = rowsFor(BASELINE, splitName, hardOnly).rows;
  const shipped = (list) => tally(list.map((r) => ({ ...r, score: wouldBlock(r.answers) ? 1 : 0 })), 1);
  return { all: { summary: summarize(rows), at_threshold: tally(rows, threshold), shipped_would_block: shipped(rows) }, hard_only: { summary: summarize(hard), at_threshold: tally(hard, threshold), shipped_would_block: shipped(hard) } };
}

function fullReport(splitName) {
  const frozen = json(FROZEN);
  return { split: splitName, frozen, primary: candidateReport(frozen.primary.config, frozen.primary.threshold, splitName, 0.05), secondary: candidateReport(frozen.secondary.config, frozen.secondary.threshold, splitName, 0.025), baseline_A: baselineReport(splitName, frozen.primary.threshold), keyword_note: keywordNote(splitName, hardOnly), requests: lines(RECORDED).filter((r) => r.split === splitName).length };
}

async function runOnce(splitName) {
  if (!existsSync(FROZEN)) throw new Error("frozen.json is missing: select on dev first");
  if (lines(RECORDED).some((r) => r.split === splitName)) throw new Error(`${splitName} answers already recorded: it runs exactly once`);
  if (splitName === "holdout" && !lines(RECORDED).some((r) => r.split === "fresh")) throw new Error("the hold-out runs after the fresh set");
  const frozen = json(FROZEN);
  const pick = (id) => configs().find((c) => c.id === id);
  await runRequests(splitName, [pick(frozen.primary.config), pick(frozen.secondary.config), ...(splitName === "fresh" ? [BASELINE] : [])], REPS);
  console.log(JSON.stringify(fullReport(splitName), null, 1));
}

if (cmd === "prepare") prepare();
else if (cmd === "run") {
  const split = flag("--split", "dev");
  if (split !== "dev") throw new Error("only dev is run freely; use fresh or holdout");
  const ids = flag("--configs") ? flag("--configs").split(",") : configs().map((c) => c.id);
  const list = allConfigs().filter((c) => ids.includes(c.id));
  if (list.length !== ids.length) throw new Error("unknown configuration");
  await runRequests("dev", list, REPS, { limit: flag("--limit"), probe: rest.includes("--probe") });
} else if (cmd === "select") {
  const frozen = select();
  if (rest.includes("--write")) writeFileSync(FROZEN, JSON.stringify(frozen, null, 1) + "\n");
} else if (cmd === "table") console.log(JSON.stringify(devTable(), null, 1));
else if (cmd === "fresh" || cmd === "holdout") await runOnce(cmd);
else if (cmd === "report") {
  const split = flag("--split", "fresh");
  const out = JSON.stringify(fullReport(split), null, 1);
  if (rest.includes("--write")) writeFileSync(`${DIR}/results-${split}.json`, out + "\n");
  console.log(out);
} else {
  console.error("usage: run.mjs prepare|run|select|table|fresh|holdout|report");
  process.exit(2);
}
