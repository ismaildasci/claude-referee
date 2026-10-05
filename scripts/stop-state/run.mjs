// Harness of the stop-state study (docs/decisions/stop-state-design.md): prepare | run | select | report | holdout. Every Jev answer goes to jev-evals/stop-state/recorded.jsonl (answers and hashes, never state text).
// Usage: node scripts/stop-state/run.mjs <cmd> --study <dir> [--study <dir>] [--split dev|holdout] [--configs id,id|all] [--rep n] [--limit n] [--probe]

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { questionHash, redactRequest, stateHash } from "../../src/engine/session.ts";
import { buildState, classifyClaim, configs, EXCLUDED, kind, readGrounds, scoreOf, sessionFeatures, splitTasks } from "./features.mjs";
import { devThreshold, rowsAuc, summarizeRows, tally } from "./stats.mjs";

const DIR = "jev-evals/stop-state";
const RECORDED = `${DIR}/recorded.jsonl`;
const SESSIONS = `${DIR}/sessions.json`;
const FROZEN = `${DIR}/frozen.json`;
const GENERIC = "plugins/claude-referee/packs/generic";
const EXP = `${DIR}/packs/stop-exp`;
const BASE = (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(/\/+$/, "");
const MODEL = "jev-1.13.0";
const HOME = process.env.HOME ?? "";

const [cmd, ...rest] = process.argv.slice(2);
const flags = (name) => rest.flatMap((a, i) => (a === name ? [rest[i + 1]] : []));
const flag = (name, fallback) => flags(name)[0] ?? fallback;
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const lines = (path) => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);

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
  const k = kind(cfg.cand);
  if (k.gate) {
    const stop = json(`${GENERIC}/questions/stop.json`);
    return { claims_done: stop["stop.claims_done"], claims_verified: stop["stop.claims_verified"], verification_applies: stop["stop.verification_applies"], outcome: stop["stop.outcome"] };
  }
  const exp = json(`${EXP}/questions/exp.json`);
  return k.wording === 1 ? { meets_requirements: exp["exp.meets_requirements_1"] } : { requirement_gap: exp["exp.requirement_gap_2"] };
}

function loadFeatures(studies) {
  const grounds = studies.flatMap((dir) => readGrounds(dir, dir.endsWith("hard") ? "hard" : "base"));
  return grounds.filter((g) => !EXCLUDED.includes(g.class)).map(sessionFeatures);
}

function prepare(studies) {
  const all = studies.flatMap((dir) => readGrounds(dir, dir.endsWith("hard") ? "hard" : "base"));
  const usable = all.filter((g) => !EXCLUDED.includes(g.class));
  const split = splitTasks(usable.filter((g) => g.class === "true_done" || g.class === "wrong_done"));
  const features = usable.map(sessionFeatures);
  const groundById = new Map(usable.map((g) => [g.id, g]));
  const sessions = features.map((f) => {
    const g = groundById.get(f.id);
    const kw = classifyClaim(g.final_message);
    const claim = f.cls === "true_done" || f.cls === "wrong_done";
    return {
      id: f.id,
      task: f.task,
      study: f.study,
      cls: f.cls,
      split: split[f.task] ?? null,
      in_population: claim && f.facts.edits.length >= 1,
      n_edits: f.facts.edits.length,
      asked: f.asked,
      kw,
      fire_a: f.asked && kw === "claim",
      fire_b: f.asked && (kw === "claim" || kw === "ambiguous"),
      gate_recorded: g.stop && !g.stop.skipped && g.stop.would_block !== undefined ? g.stop.would_block : null,
      files: f.files.length,
      change_chars: f.files.reduce((n, x) => n + (x.content?.length ?? 0) + x.hunks.reduce((m, h) => m + h.length, 0), 0),
      requirements_chars: f.requirements.length,
      check_results: f.checkResults.length,
      checks: f.facts.checks.length,
      consistency: { edits_match: f.editsMatch, checks_matched: f.checkResultsMatched },
    };
  });
  writeFileSync(SESSIONS, JSON.stringify({ seed: 20261005, generated_by: "scripts/stop-state/run.mjs prepare", sessions }, null, 1) + "\n");
  const pop = sessions.filter((s) => s.in_population);
  const half = (name) => pop.filter((s) => s.split === name);
  const count = (list, cls) => list.filter((s) => s.cls === cls).length;
  console.log(JSON.stringify({ usable: sessions.length, population: pop.length, claim_without_edit: sessions.filter((s) => (s.cls === "true_done" || s.cls === "wrong_done") && !s.in_population).length, dev: { n: half("dev").length, wrong: count(half("dev"), "wrong_done"), tasks: new Set(half("dev").map((s) => s.task)).size }, holdout: { n: half("holdout").length, wrong: count(half("holdout"), "wrong_done"), tasks: new Set(half("holdout").map((s) => s.task)).size }, edits_mismatch: sessions.filter((s) => !s.consistency.edits_match).map((s) => s.id), checks_unmatched: sessions.filter((s) => !s.consistency.checks_matched).map((s) => s.id), requirements_empty: pop.filter((s) => !s.requirements_chars).length }, null, 1));
}

const recKey = (r) => `${r.config}|${r.session}|${r.rep ?? 1}`;
function recordedAnswers() {
  const map = new Map();
  for (const r of lines(RECORDED)) map.set(recKey(r), r);
  return map;
}

async function runRequests(studies, splitName, cfgIds, rep, limit, probe) {
  const sessions = json(SESSIONS).sessions.filter((s) => s.in_population && s.split === splitName);
  const features = new Map(loadFeatures(studies).map((f) => [f.id, f]));
  const wanted = new Set(cfgIds);
  const all = configs().filter((c) => wanted.has(c.id));
  if (all.length !== wanted.size) throw new Error(`unknown configuration in ${[...wanted].join(",")}`);
  const have = recordedAnswers();
  const redactExtra = json(`${GENERIC}/redact.json`);
  const jobs = [];
  for (const cfg of all) {
    const questions = questionsFor(cfg);
    for (const s of sessions) {
      if (have.has(recKey({ config: cfg.id, session: s.id, rep })) && !have.get(recKey({ config: cfg.id, session: s.id, rep })).error) continue;
      const f = features.get(s.id);
      if (!f) throw new Error(`no features for ${s.id}`);
      const prepared = redactRequest({ id: s.id, state: buildState(cfg, f), questions }, HOME, redactExtra);
      jobs.push({ cfg, s, prepared, state_chars: JSON.stringify(prepared.body.state).length });
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
        const base = { suite: "stop-state", case: `${j.cfg.id}:${j.s.id}`, config: j.cfg.id, session: j.s.id, split: splitName, rep, model: MODEL, pack: `${kind(j.cfg.cand).gate ? "generic@0.1.0" : "stop-exp@0.1.0"}`, qhash: questionHash(j.prepared.body.questions), shash: stateHash(j.prepared.body.state), state_chars: j.state_chars, replaced: j.prepared.replaced };
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

function rowsFor(cfg, splitName, rep = 1, filter = () => true) {
  const sessions = json(SESSIONS).sessions.filter((s) => s.in_population && s.split === splitName && filter(s));
  const have = recordedAnswers();
  const rows = [];
  let missing = 0;
  let chars = 0;
  for (const s of sessions) {
    const r = have.get(recKey({ config: cfg.id, session: s.id, rep }));
    const score = r && !r.error ? scoreOf(cfg, r.answers) : null;
    if (score === null) {
      missing++;
      continue;
    }
    chars += r.state_chars;
    rows.push({ id: s.id, task: s.task, cls: s.cls, study: s.study, asked: s.asked, score, answers: r.answers });
  }
  return { rows, missing, total: sessions.length, mean_chars: rows.length ? Math.round(chars / rows.length) : 0 };
}

function devTable(cfgList) {
  return cfgList.map((cfg) => {
    const { rows, missing, total, mean_chars } = rowsFor(cfg, "dev");
    const s = summarizeRows(rows, { withBootstrap: false });
    return { config: cfg.id, auc: s.auc, perm_p: s.perm_p, wrong: s.wrong, true: s.true, missing, total, error_rate: total ? Math.round((missing / total) * 1000) / 1000 : null, mean_chars };
  });
}

function select() {
  const table = devTable(configs().filter((c) => rowsFor(c, "dev").total > 0));
  const usable = table.filter((t) => t.auc !== null && t.error_rate <= 0.02);
  const best = Math.max(...usable.map((t) => t.auc));
  const near = usable.filter((t) => t.auc >= best - 0.01 - 1e-9);
  const order = configs().map((c) => c.id);
  near.sort((a, b) => a.mean_chars - b.mean_chars || order.indexOf(a.config) - order.indexOf(b.config));
  const chosen = near[0];
  const cfg = configs().find((c) => c.id === chosen.config);
  const t = devThreshold(rowsFor(cfg, "dev").rows);
  const frozen = { config: chosen.config, threshold: t, dev_auc: chosen.auc, dev_best_auc: best, near_best: near.map((x) => x.config), dev_failure: best < 0.6, frozen_at: new Date().toISOString() };
  console.log(JSON.stringify({ table, frozen }, null, 1));
  return frozen;
}

function wouldBlock(a) {
  const g = json(`${GENERIC}/thresholds.json`)["stop.gate"];
  const noul = (id) => a?.[id]?.noul;
  return noul("claims_done") >= g.claims_done && noul("claims_verified") < g.claims_verified && noul("verification_applies") >= g.verification_applies && (a?.outcome?.probabilities?.blocked ?? 0) < g.blocked;
}

function report(cfg, splitName, t) {
  const all = rowsFor(cfg, splitName);
  const out = { config: cfg.id, split: splitName, missing: all.missing, overall: summarizeRows(all.rows) };
  if (t !== undefined && t !== null) {
    out.at_threshold = tally(all.rows, t);
    const asked = rowsFor(cfg, splitName, 1, (s) => s.asked).rows;
    const hard = rowsFor(cfg, splitName, 1, (s) => s.study === "hard").rows;
    out.asked_only = { ...summarizeRows(asked, { withBootstrap: false }), at_threshold: tally(asked, t) };
    out.hard_only = { ...summarizeRows(hard, { withBootstrap: false }), at_threshold: tally(hard, t) };
  }
  if (kind(cfg.cand).gate) {
    const blocks = all.rows.map((r) => ({ ...r, score: wouldBlock(r.answers) ? 1 : 0 }));
    out.shipped_would_block = tally(blocks, 1);
  }
  return out;
}

function keywordNote(splitName) {
  const sessions = json(SESSIONS).sessions.filter((s) => s.in_population && s.split === splitName);
  const rows = (fire) => sessions.map((s) => ({ ...s, score: fire(s) ? 1 : 0 }));
  return { reading_A: tally(rows((s) => s.fire_a), 1), reading_B: tally(rows((s) => s.fire_b), 1), gate_recorded_where_asked: tally(sessions.filter((s) => s.gate_recorded !== null).map((s) => ({ ...s, score: s.gate_recorded ? 1 : 0 })), 1) };
}

function verdict(rep, note) {
  const o = rep.overall;
  const r1 = o.boot_task_ci95 !== null && o.boot_task_ci95[0] > 0.5;
  const r2 = o.perm_p !== null && o.perm_p <= 0.05;
  const r3 = rep.at_threshold.recall.value >= 0.8 && rep.at_threshold.false_block.value <= 0.5;
  const r4 = rep.at_threshold.false_block.value < note.reading_B.false_block.value;
  const r5 = rep.asked_only.auc > 0.5 && rep.hard_only.auc > 0.5;
  const rules = { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5 };
  const text = r1 && r2 ? (r3 && r4 && r5 ? "supported on this synthetic data: opt-in may be built with a privacy note" : "separates, but not usefully") : "Jev cannot separate with these inputs";
  return { rules, verdict: text };
}

async function holdout(studies) {
  if (!existsSync(FROZEN)) throw new Error("frozen.json is missing: select on dev first");
  if (lines(RECORDED).some((r) => r.split === "holdout")) throw new Error("hold-out answers already recorded: the hold-out runs exactly once");
  const frozen = json(FROZEN);
  await runRequests(studies, "holdout", [frozen.config, "A"], 1, null, false);
  const cfg = configs().find((c) => c.id === frozen.config);
  const chosen = report(cfg, "holdout", frozen.threshold);
  const baseline = report(configs()[0], "holdout", frozen.threshold);
  const note = keywordNote("holdout");
  console.log(JSON.stringify({ frozen, chosen, baseline, keyword_note: note, adoption: verdict(chosen, note) }, null, 1));
}

const studies = flags("--study");
if (cmd === "prepare") prepare(studies);
else if (cmd === "run") {
  const split = flag("--split", "dev");
  if (split === "holdout") throw new Error("use the holdout command");
  const ids = flag("--configs", "all") === "all" ? configs().map((c) => c.id) : flag("--configs").split(",");
  await runRequests(studies, split, ids, Number(flag("--rep", "1")), flag("--limit"), rest.includes("--probe"));
} else if (cmd === "select") {
  const frozen = select();
  if (rest.includes("--write")) writeFileSync(FROZEN, JSON.stringify(frozen, null, 1) + "\n");
} else if (cmd === "report") {
  const split = flag("--split", "dev");
  const ids = flag("--configs", "all") === "all" ? configs().map((c) => c.id) : flag("--configs").split(",");
  if (split === "dev" && flag("--configs", "all") === "all") console.log(JSON.stringify(devTable(configs()), null, 1));
  else for (const id of ids) console.log(JSON.stringify(report(configs().find((c) => c.id === id), split, flag("--threshold") === undefined ? undefined : Number(flag("--threshold"))), null, 1));
} else if (cmd === "holdout") await holdout(studies);
else {
  console.error("usage: run.mjs prepare|run|select|report|holdout");
  process.exit(2);
}
