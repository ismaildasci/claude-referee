// eval: "record" asks Jev once per case of a suite and appends hashed answers; "score" re-scores them offline.
// Suites live in jev-evals/<suite>/ as suite.json, cases.jsonl and recorded.jsonl; a changed question text makes scoring fail.
// decide suites record both option orders per case and score leader agreement; --ablation context|reversed removes the context text or the reversed order.

import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { costUsd, estimateTokens, resolveModel } from "../../engine/config.ts";
import { decideStop, stopQuestions, stopSkipReason, stopState } from "../../engine/stopgate/decide.ts";
import { analyzeTranscript } from "../../engine/stopgate/transcript.ts";
import { RefereeError } from "../../engine/errors.ts";
import { decideMetrics, decideShift, findRecording, metrics, parseCases, parseRecordings, parseSweep, sweep, type DecideScored, type EvalCase, type Recording } from "../../engine/evals.ts";
import type { Result } from "../../engine/output.ts";
import type { Pack } from "../../engine/pack.ts";
import { Session, questionHash, redactRequest, stateHash, type Outcome, type Planned } from "../../engine/session.ts";
import type { Command, Context } from "../types.ts";
import { JEV_ERRORS, fitLine, openPack, reorder, str } from "../shared.ts";
import { doneEvidence, doneRequest } from "./done.ts";
import { parseInput as parseDecision, planDecide } from "./decide.ts";
import { judgeRequest } from "./judge.ts";
import { verifyRequest } from "./verify.ts";

interface SuiteConfig {
  readonly command: string;
  readonly criteria?: string | readonly string[];
  readonly question?: string;
  readonly positive: string;
  readonly max_wrong_positive: number;
  readonly max_wrong_negative?: number;
}

interface Suite {
  readonly name: string;
  readonly dir: string;
  readonly config: SuiteConfig;
  readonly cases: EvalCase[];
  readonly recordings: Recording[];
}

interface CaseRequest {
  readonly suite: Suite;
  readonly item: EvalCase;
  readonly planned: Planned[];
  readonly finish: (outcomes: Outcome[]) => Result;
  readonly qhash: string;
  readonly shash: string;
}

const LIST_LIMIT = 20;
const ABLATIONS = ["context", "reversed"] as const;
type Ablation = (typeof ABLATIONS)[number];

function readSuite(root: string, name: string): Suite {
  const dir = join(root, name);
  if (!existsSync(join(dir, "suite.json")) || !existsSync(join(dir, "cases.jsonl"))) {
    throw new RefereeError("bad_input", `No eval suite ${name}: it needs suite.json and cases.jsonl.`, { next_step: `Look in ${root}.` });
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(join(dir, "suite.json"), "utf8")) as Record<string, unknown>;
  } catch {
    throw new RefereeError("bad_input", `Suite ${name}: suite.json is not valid JSON.`);
  }
  if (typeof raw["command"] !== "string") throw new RefereeError("bad_input", `Suite ${name}: suite.json needs a command.`);
  const config: SuiteConfig = {
    command: raw["command"],
    ...(typeof raw["criteria"] === "string" || Array.isArray(raw["criteria"]) ? { criteria: raw["criteria"] as string | string[] } : {}),
    ...(typeof raw["question"] === "string" ? { question: raw["question"] } : {}),
    positive: typeof raw["positive"] === "string" ? raw["positive"] : "met",
    max_wrong_positive: typeof raw["max_wrong_positive"] === "number" ? raw["max_wrong_positive"] : 0,
    ...(typeof raw["max_wrong_negative"] === "number" ? { max_wrong_negative: raw["max_wrong_negative"] } : {}),
  };
  const recorded = join(dir, "recorded.jsonl");
  return {
    name,
    dir,
    config,
    cases: parseCases(readFileSync(join(dir, "cases.jsonl"), "utf8")),
    recordings: existsSync(recorded) ? parseRecordings(readFileSync(recorded, "utf8")) : [],
  };
}

function suites(root: string, name: string): Suite[] {
  if (name !== "all") return [readSuite(root, name)];
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "suite.json")))
    .map((d) => readSuite(root, d.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function criteriaFor(suite: Suite, item: EvalCase): string[] {
  const own = item["criteria"] ?? item["criterion"] ?? suite.config.criteria;
  const list = (Array.isArray(own) ? own : [own]).filter((c): c is string => typeof c === "string" && c.trim() !== "");
  if (list.length === 0) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: no criterion.`);
  return list;
}

// A stop case replays a redacted transcript through the same analysis, skip rule, request and decision the Stop hook uses.
function stopRequest(pack: Pack, suite: Suite, item: EvalCase): { planned: Planned[]; finish: (outcomes: Outcome[]) => Result } {
  const name = typeof item["transcript"] === "string" ? item["transcript"] : "";
  const file = resolve(suite.dir, name);
  if (!name || !file.startsWith(resolve(suite.dir) + sep) || !existsSync(file)) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the transcript file is missing or outside the suite.`);
  const facts = analyzeTranscript(readFileSync(file, "utf8"));
  const skip = stopSkipReason(facts);
  if (skip) return { planned: [], finish: () => ({ verdict: "skipped", reason: skip }) };
  const planned: Planned[] = [{ id: "stop", state: stopState(facts, facts.finalMessage), questions: stopQuestions(pack) }];
  return {
    planned,
    finish: (outcomes) => {
      const decision = decideStop(outcomes[0]?.answers ?? null, pack, undefined);
      return decision ? { verdict: decision.would_block ? "block" : "allow", p: decision.claims_done } : { verdict: "unsure", p: Number.NaN };
    },
  };
}

function decideCaseRequest(pack: Pack, suite: Suite, item: EvalCase, ablation: Ablation | undefined): { planned: Planned[]; finish: (outcomes: Outcome[]) => Result } {
  const input = parseDecision(JSON.stringify({ decision: item["decision"], context: item["context"], options: item["options"] }));
  const plan = planDecide(pack, undefined, { decision: input.decision, ...(input.context && ablation !== "context" ? { context: input.context } : {}) }, input.options, ablation === "reversed" ? "reversed" : undefined);
  if (plan.perOption) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the options do not fit one request.`);
  if (!input.options.some((o) => o.name === item.expected)) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: expected must name one of the options.`);
  return {
    planned: plan.planned,
    finish: (outcomes) => {
      const out = plan.summarize(new Map(outcomes.map((o, i) => [plan.planned[i]?.id ?? o.id, o.answers])));
      return { verdict: out.verdict, lean: out.lean, p: out.mean[out.lean] ?? 0, order_disagrees: out.disagree };
    },
  };
}

function request(context: Context, pack: Pack, suite: Suite, item: EvalCase, ablation?: Ablation): CaseRequest {
  const command = suite.config.command;
  if (command !== "done" && command !== "verify" && command !== "judge" && command !== "stop" && command !== "decide") throw new RefereeError("bad_input", `Suite ${suite.name} uses ${command}; eval handles done, verify, judge, stop and decide suites for now.`);
  if (ablation && command !== "decide") throw new RefereeError("bad_input", `--ablation applies to decide suites; suite ${suite.name} uses ${command}.`);
  let planned: Planned[];
  let finish: (outcomes: Outcome[]) => Result;
  if (command === "decide") {
    ({ planned, finish } = decideCaseRequest(pack, suite, item, ablation));
  } else if (command === "stop") {
    ({ planned, finish } = stopRequest(pack, suite, item));
  } else if (command === "done") {
    const evidence = doneEvidence(typeof item["evidence"] === "string" ? item["evidence"] : "");
    if (!evidence.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the evidence is empty.`);
    ({ planned, finish } = doneRequest(pack, undefined, criteriaFor(suite, item), evidence));
  } else if (command === "judge") {
    const text = typeof item["text"] === "string" ? item["text"] : "";
    if (!suite.config.question) throw new RefereeError("bad_input", `Suite ${suite.name}: a judge suite needs "question" in suite.json.`);
    if (!text.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: a judge case needs text.`);
    ({ planned, finish } = judgeRequest(pack, undefined, suite.config.question, text, typeof item["context"] === "string" ? item["context"] : undefined));
  } else {
    const claim = typeof item["claim"] === "string" ? item["claim"] : "";
    const source = typeof item["source"] === "string" ? item["source"] : "";
    if (!claim.trim() || !source.trim()) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: a verify case needs a claim and a source.`);
    ({ planned, finish } = verifyRequest(pack, undefined, [{ id: "1", text: claim }], source));
  }
  const first = planned[0];
  if (!first) return { suite, item, planned: [], finish, qhash: "code", shash: "code" };
  const redacted = redactRequest(first, context.io.home, pack.redact);
  const ids = planned.map((p) => `${suite.name}/${item.id}` + (planned.length > 1 ? `:${p.id}` : ""));
  return { suite, item, planned: planned.map((p, i) => ({ ...p, id: ids[i] as string })), finish, qhash: questionHash(first.questions), shash: stateHash(redacted.body.state) };
}

function cap(context: Context, flag: string): number | undefined {
  const raw = str(context, flag);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || raw.trim() === "") throw new RefereeError("bad_input", `--${flag} takes a number of 0 or more.`);
  return value;
}

// A reversed run reuses the full recording; a context run has its own lines, and a case without context text shares the full line (same hashes).
function lookup(suite: Suite, item: EvalCase, req: CaseRequest, model: string, ablation: Ablation | undefined): ReturnType<typeof findRecording> {
  const key = { case: item.id, qhash: req.qhash, shash: req.shash, model };
  const own = ablation === "context" ? findRecording(suite.recordings, { ...key, ablation }) : undefined;
  return own?.status === "ok" ? own : findRecording(suite.recordings, key);
}

function ablationFlag(context: Context): Ablation | undefined {
  const raw = str(context, "ablation");
  if (raw === undefined) return undefined;
  if (!(ABLATIONS as readonly string[]).includes(raw)) throw new RefereeError("bad_input", `--ablation takes ${ABLATIONS.join(" or ")}.`);
  return raw as Ablation;
}

async function record(context: Context, pack: Pack, list: readonly Suite[]): Promise<Result> {
  const ablation = ablationFlag(context);
  const maxRequests = cap(context, "max-requests");
  const maxUsd = cap(context, "max-usd");
  const split = splitFlag(context);
  const { io, flags } = context;
  const session = new Session({
    command: "eval",
    env: io.env,
    cwd: io.cwd,
    home: io.home,
    platform: io.platform,
    now: io.now,
    pack: { name: pack.name, version: `${pack.version}+${pack.hash}`, redact: pack.redact },
    dataDir: flags.dataDir,
    fresh: true,
  });
  const todo: CaseRequest[] = [];
  let skipped = 0;
  for (const suite of list) {
    for (const item of suite.cases.filter((c) => !split || c.split === split)) {
      const req = request(context, pack, suite, item, ablation);
      const found = lookup(suite, item, req, session.model, ablation).status === "ok";
      if (ablation === "reversed" && req.planned.length > 0 && !found) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: --ablation reversed is rescored from the full recording and records nothing.`, { next_step: `Run eval record --suite ${suite.name} without --ablation first.` });
      if (req.planned.length === 0) skipped += 1;
      else if ((!flags.fresh || ablation === "reversed") && found) skipped += 1;
      else todo.push(req);
    }
  }
  const plans = todo.flatMap((t) => t.planned);
  const tokens = plans.reduce((sum, p) => sum + estimateTokens(JSON.stringify([p.state, p.questions])), 0);
  const usd = costUsd(session.model, tokens);
  if (!flags.dryRun && maxRequests !== undefined && plans.length > maxRequests) {
    throw new RefereeError("bad_input", `Recording would send ${plans.length} requests; --max-requests is ${maxRequests}. Nothing was sent.`, { next_step: "Record fewer cases (a smaller suite or --split) or raise the cap." });
  }
  if (!flags.dryRun && maxUsd !== undefined && usd !== null && usd > maxUsd) {
    throw new RefereeError("bad_input", `Recording would cost about ${usd.toFixed(6)} USD (an estimate from about ${tokens} input tokens); --max-usd is ${maxUsd}. Nothing was sent.`, { next_step: "Record fewer cases or raise the cap." });
  }
  if (flags.dryRun) return fitLine({ ...session.dryRun(plans), skipped });
  const outcomes = todo.length ? await session.run(plans, { partial: true }) : [];
  const failed: string[] = [];
  let recorded = 0;
  let at = 0;
  todo.forEach((req) => {
    const rest = outcomes.slice(at, at + req.planned.length);
    at += req.planned.length;
    const outcome = rest[0];
    if (!outcome?.answers || rest.some((o) => !o.answers)) {
      failed.push(`${req.suite.name}/${req.item.id}`);
      return;
    }
    const line = {
      suite: req.suite.name,
      case: req.item.id,
      split: req.item.split,
      model: session.model,
      pack: `${pack.name}@${pack.version}`,
      qhash: req.qhash,
      shash: req.shash,
      ...(ablation ? { ablation } : {}),
      answers: outcome.answers,
      ...(rest.length > 1 ? { also: rest.slice(1).map((o) => o.answers) } : {}),
      recorded_at: new Date(io.now()).toISOString(),
    };
    appendFileSync(join(req.suite.dir, "recorded.jsonl"), JSON.stringify(line) + "\n");
    recorded += 1;
  });
  const receipt = session.record({ verdict: failed.length ? "partial" : "recorded" });
  return reorder({
    ok: true,
    verdict: failed.length ? "partial" : "recorded",
    suites: list.map((s) => s.name),
    recorded,
    skipped,
    ...(failed.length ? { failed: failed.slice(0, LIST_LIMIT) } : {}),
    ...session.stats(),
    next_step: failed.length ? "Run the same command again; recorded cases are skipped." : undefined,
    receipt: receipt.id,
  });
}

function replay(context: Context, pack: Pack, suite: Suite, item: EvalCase, model: string, ablation?: Ablation): Result {
  const req = request(context, pack, suite, item, ablation);
  if (req.planned.length === 0) return req.finish([]);
  const found = lookup(suite, item, req, model, ablation);
  if (found.status !== "ok") {
    const why = found.status === "missing" ? `no recording for ${model}` : "the question text or input changed since it was recorded";
    const flag = ablation ? ` --ablation ${ablation}` : "";
    throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: ${why}${ablation ? ` with the ${ablation} ablation` : ""}.`, { next_step: `Run eval record --suite ${suite.name}${flag} with a key.` });
  }
  const answers = [found.line.answers, ...(Array.isArray(found.line["also"]) ? found.line["also"] : [])] as Outcome["answers"][];
  const missing = req.planned.findIndex((_, i) => !answers[i]);
  if (missing >= 0) throw new RefereeError("bad_input", `Suite ${suite.name}, case ${item.id}: the recording has ${answers.filter(Boolean).length} of ${req.planned.length} answers.`, { next_step: `Run eval record --suite ${suite.name} --fresh with a key.` });
  return req.finish(req.planned.map((p, i) => ({ id: p.id, answers: answers[i] ?? null, stopped: [], cached: true })));
}

function scoreDecide(context: Context, pack: Pack, suite: Suite, model: string, split: string | undefined): { scored: DecideScored[]; of: (ablation: Ablation) => DecideScored[] } {
  const cases = suite.cases.filter((c) => !split || c.split === split);
  const items = (ablation?: Ablation): DecideScored[] =>
    cases.map((item) => {
      const r = replay(context, pack, suite, item, model, ablation);
      return { id: item.id, split: item.split, expected: item.expected, lean: String(r["lean"]), verdict: String(r["verdict"]), order_disagrees: r["order_disagrees"] === true };
    });
  return { scored: items(), of: items };
}

function scoreSuite(context: Context, pack: Pack, suite: Suite, model: string, split: string | undefined, sweepSpec: string | undefined): Result {
  const ablation = ablationFlag(context);
  if (suite.config.command === "decide") {
    if (sweepSpec) throw new RefereeError("bad_input", "--sweep does not apply to decide suites: decide has no positive label.");
    const { scored, of } = scoreDecide(context, pack, suite, model, split);
    if (!ablation) return { suite: suite.name, verdict: "scored", ...decideMetrics(scored) };
    const ablated = of(ablation);
    return { suite: suite.name, verdict: "scored", ablation, ...decideMetrics(ablated), baseline: decideMetrics(scored), ...decideShift(scored, ablated) };
  }
  if (ablation) throw new RefereeError("bad_input", `--ablation applies to decide suites; suite ${suite.name} uses ${suite.config.command}.`);
  const items = suite.cases
    .filter((c) => !split || c.split === split)
    .map((item) => {
      const result = replay(context, pack, suite, item, model);
      return { id: item.id, split: item.split, expected: item.expected, verdict: String(result["verdict"]), p: Number(result["p"]) };
    });
  const m = metrics(items, suite.config.positive);
  const swept = sweepSpec ? sweep(items, suite.config.positive, parseSweep(sweepSpec)) : null;
  return {
    suite: suite.name,
    verdict: m.wrong_positive > suite.config.max_wrong_positive || (suite.config.max_wrong_negative !== undefined && m.wrong_negative > suite.config.max_wrong_negative) ? "violated" : "pass",
    ...m,
    max_wrong_positive: suite.config.max_wrong_positive,
    ...(suite.config.max_wrong_negative !== undefined ? { max_wrong_negative: suite.config.max_wrong_negative } : {}),
    ...(swept ? { sweep: swept.rows.map((r) => [r.t, r.precision, r.recall, r.wrong_positive]), suggested: swept.suggested, ...(swept.reason ? { sweep_note: swept.reason } : {}) } : {}),
  };
}

function splitFlag(context: Context): string | undefined {
  const split = str(context, "split");
  if (split !== undefined && split !== "dev" && split !== "holdout") throw new RefereeError("bad_input", '--split takes "dev" or "holdout".');
  return split;
}

function score(context: Context, pack: Pack, list: readonly Suite[], all: boolean): Result {
  const model = resolveModel(context.io.env);
  const split = splitFlag(context);
  const scored = (all ? list.filter((s) => s.recordings.length > 0) : list).map((s) => scoreSuite(context, pack, s, model, split, str(context, "sweep")));
  const verdict = scored.some((s) => s["verdict"] === "violated") ? "violated" : "pass";
  if (!all && scored[0]) {
    const { suite, verdict: v, ...rest } = scored[0];
    return { ok: true, verdict: v, suite, model, ...(split ? { split } : {}), ...rest };
  }
  return {
    ok: true,
    verdict,
    model,
    suites: scored.map((s) => (s["agreement"] !== undefined ? { suite: s["suite"], verdict: s["verdict"], cases: s["cases"], agreement: s["agreement"] } : { suite: s["suite"], verdict: s["verdict"], cases: s["cases"], wrong_positive: s["wrong_positive"], max_wrong_positive: s["max_wrong_positive"] })),
  };
}

export const evalCommand: Command = {
  name: "eval",
  describe: {
    summary: "Record Jev's answers for an eval suite once, then score them offline.",
    inputs: {
      "record | score": "Positional action.",
      "--suite <name|all>": "A directory under the evals dir with suite.json, cases.jsonl and, once recorded, recorded.jsonl. 'all' takes every suite; score then skips suites without recordings.",
      "--evals-dir <dir>": "Where the suites live; default jev-evals in the current directory. A suite.json names its command: done, verify, judge, stop or decide (a decide case has decision, context, options and an expected option name; a judge suite also names its question, and its cases have text and an expected yes, no or review).",
      "--split <dev|holdout>": "record and score: only cases from this split, so dev can be recorded before the hold-out.",
      "--sweep <from:to:step>": "score: precision, recall and wrong positives per threshold; suggests one only with at least 10 cases per class.",
      "--ablation <context|reversed>": "decide suites only. record: record answers with the context text left out of the request (reversed needs no new recording). score: rescore with that element removed and report the change against the full run; context needs those answers recorded first.",
      "--fresh": "record: record every case again, even ones already recorded for this question text, input and model.",
      "--max-requests <n>": "record: stop before the first request when more than n cases are still to record.",
      "--max-usd <x>": "record: stop before the first request when the estimated input cost, from a token estimate, is above x USD.",
    },
    outputs: {
      verdict: "record: recorded or partial; score: pass, or violated when wrong positives exceed the suite's max_wrong_positive or, when the suite sets max_wrong_negative, wrong negatives exceed that",
      recorded: "record: cases recorded now",
      skipped: "record: cases already recorded",
      verdicts: "score: count per verdict",
      precision: "score: share of positive verdicts that were right",
      recall: "score: share of expected positives found",
      automation: "score: share of cases with a definite verdict",
      wrong_positive: "score: positive verdicts that should not be; the kill criterion",
      agreement: "score, decide suites: share of cases whose lean equals the labelled best option; no precision or recall and no pass or fail threshold",
      by_verdict: "score, decide suites: cases and agreeing cases per verdict (clear, weak, tie), raw counts",
      order_disagrees: "score, decide suites: cases where the written and reversed orders picked different leaders",
      leader_changed: "score with --ablation: cases whose lean differs from the full run; agree_delta is the change in agreeing cases and verdict_changed the cases with another verdict",
      wrong_negative: "score: expected positives that got a definite non-positive verdict (for a stop suite also a skip); enforced only when suite.json sets max_wrong_negative",
    },
    errors: [...JEV_ERRORS],
    effects: "record sends each unrecorded case to the TypeSafe API and appends to recorded.jsonl; score reads files only.",
    cost: "record: one Jev request per case not yet recorded. score: free and offline.",
  },
  options: { suite: { type: "string" }, split: { type: "string" }, sweep: { type: "string" }, "evals-dir": { type: "string" }, "max-requests": { type: "string" }, "max-usd": { type: "string" }, ablation: { type: "string" } },
  async run(context) {
    const action = context.positionals[0];
    if (action !== "record" && action !== "score") throw new RefereeError("bad_input", "eval needs an action: record or score.", { next_step: "Example: eval score --suite injection" });
    const name = str(context, "suite");
    if (!name) throw new RefereeError("bad_input", "Give --suite <name|all>.");
    const root = resolve(context.io.cwd, str(context, "evals-dir") ?? "jev-evals");
    const list = suites(root, name);
    const { pack } = openPack(context);
    return action === "record" ? record(context, pack, list) : score(context, pack, list, name === "all");
  },
};
