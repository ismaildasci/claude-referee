// Fetches the second real-log sample (docs/decisions/done-v2-real-logs-2.md): other repositories, runs from 2026-10-04, cap 3 cases per repo.
// Resumable like fetch.mjs. Usage: node fetch2.mjs --out DIR --exclude SPLIT.json [--per-lang 8] [--extra-per-lang 6] [--langs A,B] [--aggregate] [--topup]
// Each pass that may call gh writes its own record under DIR/passes; the aggregate step sums them into stats.json (passTotals in lib.mjs).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEvidence, classify, criterionOf, passTotals, refineTool, sha256, splitSegments, stripTransport, wrapperTool } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const OUT = flag("out");
const EXCLUDE = flag("exclude");
const PER_LANG = Number(flag("per-lang", "8"));
const EXTRA = Number(flag("extra-per-lang", "6"));
const ONLY = flag("langs") ? flag("langs").split(",") : null;
const AGGREGATE = args.includes("--aggregate");
const TOPUP = args.includes("--topup");
if (!OUT || !EXCLUDE) throw new Error("--out DIR and --exclude SPLIT.json are required");
const LANGS = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "Ruby", "PHP", "C#", "C++", "C", "Swift", "Kotlin"];
const EXTRA_LANGS = ["Dart", "Elixir", "Scala", "Shell"];
const EXCLUDED = new Set([...Object.keys(JSON.parse(readFileSync(EXCLUDE, "utf8")).repos), "BurntSushi/ripgrep"]);
const PUSHED = "pushed:>2026-10-03";
const CREATED = ">=2026-10-04";
const SINCE = Date.parse("2026-10-04T00:00:00Z");
const MAX_RUNS = 6;
const MAX_JOBS = 6;
const CAP = { total: 3, failed: 2 };
for (const dir of ["repos", "logs", "lists", "picks", "passes"]) mkdirSync(join(OUT, dir), { recursive: true });

let calls = 0;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function gh(ghArgs, { allowFail = false } = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    calls += 1;
    if (calls % 40 === 0) throttle();
    try {
      return execFileSync("gh", ghArgs, { encoding: "utf8", maxBuffer: 400 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      const msg = String(error.stderr ?? error.message);
      if (/rate limit|abuse|secondary/i.test(msg)) {
        sleep(60_000 * (attempt + 1));
        continue;
      }
      if (allowFail) return null;
      if (attempt === 3) throw error;
      sleep(2_000);
    }
  }
  return null;
}

function throttle() {
  const core = JSON.parse(gh(["api", "rate_limit"])).resources.core;
  if (core.remaining < 250) {
    const wait = Math.max(1, core.reset - Math.floor(Date.now() / 1000)) + 5;
    console.error(`rate limit low (${core.remaining}); sleeping ${wait}s`);
    sleep(wait * 1000);
  }
}

const slug = (repo) => repo.replace("/", "__");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const byHash = (key) => (a, b) => (sha256(key(a)) < sha256(key(b)) ? -1 : 1);
const stats = existsSync(join(OUT, "stats.json")) ? readJson(join(OUT, "stats.json")) : {};
const counts = {};
const bump = (lang, name) => {
  const c = (counts[lang] ??= { excluded_candidates: 0, repos_without_cases: 0 });
  c[name] += 1;
};
let saved = AGGREGATE;
const savePass = () => {
  if (saved) return;
  saved = true;
  const mode = TOPUP ? "topup" : ONLY ? `langs:${ONLY.join(",")}` : "all";
  writeFileSync(join(OUT, "passes", `${Date.now()}-${process.pid}.json`), JSON.stringify({ at: new Date().toISOString(), mode, calls, langs: counts }));
};
process.on("exit", savePass);

function candidates(lang) {
  const file = join(OUT, "lists", `${lang.replace(/\W/g, "_")}.json`);
  if (existsSync(file)) return readJson(file);
  const out = gh(["search", "repos", "--language", lang, PUSHED, "--sort", "stars", "--archived=false", "--limit", "100", "--json", "fullName,license,stargazersCount,language"]);
  writeFileSync(file, out);
  return JSON.parse(out);
}

function jobLog(repo, jobId) {
  const file = join(OUT, "logs", `${jobId}.log`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  if (existsSync(`${file}.gone`)) return null;
  const text = gh(["api", `repos/${repo}/actions/jobs/${jobId}/logs`], { allowFail: true });
  if (text === null || text === "") {
    writeFileSync(`${file}.gone`, "");
    return null;
  }
  writeFileSync(file, text);
  return text;
}

function runList(repo, status) {
  const out = gh(["run", "list", "-R", repo, "--status", status, "--created", CREATED, "--limit", "30", "--json", "databaseId,conclusion,createdAt,workflowName"], { allowFail: true });
  return (out ? JSON.parse(out) : []).filter((r) => new Date(r.createdAt).getTime() >= SINCE);
}

function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

function processRepo(meta, bucket) {
  const file = join(OUT, "repos", `${slug(meta.fullName)}.json`);
  if (existsSync(file)) return readJson(file);
  const record = { repo: meta.fullName, bucket, license: meta.license?.key ?? null, stars: meta.stargazersCount, cases: [], inspectedRuns: [], runs: { failure: 0, success: 0 }, dropped: {} };
  const failed = runList(meta.fullName, "failure").sort(byHash((r) => String(r.databaseId)));
  const passed = runList(meta.fullName, "success").sort(byHash((r) => String(r.databaseId)));
  record.runs = { failure: failed.length, success: passed.length };
  const seen = new Set();
  let inspected = 0;
  const drop = (reason) => (record.dropped[reason] = (record.dropped[reason] ?? 0) + 1);
  for (const run of interleave(failed, passed)) {
    if (inspected >= MAX_RUNS || record.cases.length >= CAP.total) break;
    inspected += 1;
    record.inspectedRuns.push(run.databaseId);
    const jobsJson = gh(["api", `repos/${meta.fullName}/actions/runs/${run.databaseId}/jobs?per_page=100`], { allowFail: true });
    if (!jobsJson) continue;
    const jobs = JSON.parse(jobsJson).jobs.filter((j) => j.conclusion === "success" || j.conclusion === "failure").sort(byHash((j) => String(j.id))).slice(0, MAX_JOBS);
    for (const job of jobs) {
      if (record.cases.length >= CAP.total) break;
      const raw = jobLog(meta.fullName, job.id);
      if (raw === null) {
        drop("log_expired");
        continue;
      }
      const segments = splitSegments(stripTransport(raw));
      const steps = job.steps.filter((s) => s.conclusion !== "skipped" && s.name !== "Set up job" && s.name !== "Complete job" && !s.name.startsWith("Post "));
      if (segments.length !== steps.length) {
        drop("segment_mismatch");
        continue;
      }
      for (const [i, step] of steps.entries()) {
        const segment = segments[i];
        if (segment.uses || (step.conclusion !== "success" && step.conclusion !== "failure")) continue;
        const kind = classify(step.name, segment.script);
        if (kind.excluded) {
          if (kind.excluded === "multi-purpose") drop("multi_purpose");
          continue;
        }
        const key = `${run.workflowName}|${step.name}`;
        if (seen.has(key)) continue;
        const stepFailed = step.conclusion === "failure" || segment.exits.some((c) => c !== 0);
        const evidence = buildEvidence(segment);
        if (stepFailed && evidence.exit === 0) {
          drop("failed_no_exit_marker");
          continue;
        }
        if (stepFailed && record.cases.filter((c) => c.failed).length >= CAP.failed) continue;
        if (record.cases.length >= CAP.total) break;
        seen.add(key);
        record.cases.push({
          id: `rl-${sha256(`${meta.fullName}/${job.id}/${step.number}`).slice(0, 8)}`,
          repo: meta.fullName,
          language: bucket,
          license: record.license,
          stars: meta.stargazersCount,
          workflow: run.workflowName,
          run_id: run.databaseId,
          job_id: job.id,
          step_number: step.number,
          step_name: step.name,
          purpose: kind.purpose,
          criterion: criterionOf(kind.purpose),
          tool: wrapperTool(evidence.text, refineTool(kind.tool, evidence.text)),
          conclusion: step.conclusion,
          failed: stepFailed,
          exit_code: evidence.exit,
          evidence: evidence.text,
          evidence_sha256: sha256(evidence.text),
          chars: evidence.text.length,
        });
      }
    }
  }
  writeFileSync(file, JSON.stringify(record));
  return record;
}

// Amendment 1 of the registration: failed-only top-up on accepted repositories; adds failed steps only, up to 2 failed and 5 cases per repository.
function topupRepo(record) {
  if (record.topup || record.cases.filter((c) => c.failed).length >= 2) return record;
  const file = join(OUT, "repos", `${slug(record.repo)}.json`);
  const failed = runList(record.repo, "failure").sort(byHash((r) => String(r.databaseId))).filter((r) => !record.inspectedRuns.includes(r.databaseId));
  const seen = new Set(record.cases.map((c) => `${c.workflow}|${c.step_name}`));
  const drop = (reason) => (record.dropped[reason] = (record.dropped[reason] ?? 0) + 1);
  record.topup = true;
  record.topup_added = 0;
  let inspected = 0;
  for (const run of failed) {
    if (inspected >= MAX_RUNS || record.cases.filter((c) => c.failed).length >= CAP.failed || record.cases.length >= 5) break;
    inspected += 1;
    record.inspectedRuns.push(run.databaseId);
    const jobsJson = gh(["api", `repos/${record.repo}/actions/runs/${run.databaseId}/jobs?per_page=100`], { allowFail: true });
    if (!jobsJson) continue;
    const jobs = JSON.parse(jobsJson).jobs.filter((j) => j.conclusion === "failure").sort(byHash((j) => String(j.id))).slice(0, MAX_JOBS);
    for (const job of jobs) {
      const raw = jobLog(record.repo, job.id);
      if (raw === null) {
        drop("log_expired");
        continue;
      }
      const segments = splitSegments(stripTransport(raw));
      const steps = job.steps.filter((s) => s.conclusion !== "skipped" && s.name !== "Set up job" && s.name !== "Complete job" && !s.name.startsWith("Post "));
      if (segments.length !== steps.length) {
        drop("segment_mismatch");
        continue;
      }
      for (const [i, step] of steps.entries()) {
        const segment = segments[i];
        if (segment.uses || step.conclusion !== "failure" && !(step.conclusion === "success" && segment.exits.some((c) => c !== 0))) continue;
        const kind = classify(step.name, segment.script);
        if (kind.excluded) {
          if (kind.excluded === "multi-purpose") drop("multi_purpose");
          continue;
        }
        const key = `${run.workflowName}|${step.name}`;
        if (seen.has(key)) continue;
        const evidence = buildEvidence(segment);
        if (evidence.exit === 0) {
          drop("failed_no_exit_marker");
          continue;
        }
        if (record.cases.filter((c) => c.failed).length >= CAP.failed || record.cases.length >= 5) break;
        seen.add(key);
        record.topup_added += 1;
        record.cases.push({
          id: `rl-${sha256(`${record.repo}/${job.id}/${step.number}`).slice(0, 8)}`,
          repo: record.repo,
          language: record.bucket,
          license: record.license,
          stars: record.stars,
          workflow: run.workflowName,
          run_id: run.databaseId,
          job_id: job.id,
          step_number: step.number,
          step_name: step.name,
          purpose: kind.purpose,
          criterion: criterionOf(kind.purpose),
          tool: wrapperTool(evidence.text, refineTool(kind.tool, evidence.text)),
          conclusion: step.conclusion,
          failed: true,
          exit_code: evidence.exit,
          evidence: evidence.text,
          evidence_sha256: sha256(evidence.text),
          chars: evidence.text.length,
        });
      }
    }
  }
  writeFileSync(file, JSON.stringify(record));
  return record;
}

const accepted = {};
const picked = new Set();
const buckets = [...LANGS.map((l) => [l, PER_LANG]), ...EXTRA_LANGS.map((l) => [l, EXTRA])];
if (TOPUP) {
  for (const [lang] of buckets.filter(([l]) => !ONLY || ONLY.includes(l))) {
    const f = join(OUT, "picks", `${lang.replace(/\W/g, "_")}.json`);
    for (const repo of existsSync(f) ? readJson(f) : []) {
      const rec = topupRepo(readJson(join(OUT, "repos", `${slug(repo)}.json`)));
      console.error(`topup ${lang} ${repo}: +${rec.topup_added ?? 0}`);
    }
  }
  process.exit(0);
}
if (!AGGREGATE) {
  for (const [lang, quota] of buckets.filter(([l]) => !ONLY || ONLY.includes(l))) {
    accepted[lang] = 0;
    counts[lang] ??= { excluded_candidates: 0, repos_without_cases: 0 };
    const mine = [];
    for (const meta of candidates(lang)) {
      if (accepted[lang] >= quota) break;
      if (EXCLUDED.has(meta.fullName)) {
        bump(lang, "excluded_candidates");
        continue;
      }
      const record = processRepo(meta, lang);
      console.error(`${lang} ${meta.fullName}: ${record.cases.length} cases (${calls} calls)`);
      if (record.cases.length > 0) {
        accepted[lang] += 1;
        mine.push(meta.fullName);
      } else bump(lang, "repos_without_cases");
    }
    writeFileSync(join(OUT, "picks", `${lang.replace(/\W/g, "_")}.json`), JSON.stringify(mine));
  }
  if (ONLY) process.exit(0);
  savePass();
}
for (const [lang] of buckets) {
  const f = join(OUT, "picks", `${lang.replace(/\W/g, "_")}.json`);
  accepted[lang] = existsSync(f) ? readJson(f).length : 0;
  if (existsSync(f)) for (const r of readJson(f)) picked.add(r);
}

const pickedFiles = readdirSync(join(OUT, "repos")).filter((f) => picked.has(readJson(join(OUT, "repos", f)).repo));
const all = pickedFiles.flatMap((f) => readJson(join(OUT, "repos", f)).cases);
const dropped = {};
for (const f of pickedFiles) for (const [k, v] of Object.entries(readJson(join(OUT, "repos", f)).dropped)) dropped[k] = (dropped[k] ?? 0) + v;
writeFileSync(join(OUT, "cases-raw.jsonl"), `${all.map((c) => JSON.stringify(c)).join("\n")}\n`);
const passes = readdirSync(join(OUT, "passes")).filter((f) => f.endsWith(".json")).map((f) => readJson(join(OUT, "passes", f)));
writeFileSync(join(OUT, "stats.json"), JSON.stringify({ ...stats, accepted, dropped, repos: new Set(all.map((c) => c.repo)).size, cases: all.length, failed_cases: all.filter((c) => c.failed).length, ...passTotals(passes) }, null, 1));
console.error(JSON.stringify({ accepted, repos: new Set(all.map((c) => c.repo)).size, cases: all.length, failed: all.filter((c) => c.failed).length, dropped }));
