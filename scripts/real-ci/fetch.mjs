// Fetches real GitHub Actions step logs for the real-log study (docs/decisions/done-v2-real-logs.md) with the gh CLI.
// Resumable: every repo, job log and result is cached under --out; rate-limit aware. Usage: node fetch.mjs --out DIR [--per-lang 8] [--topup]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEvidence, classify, criterionOf, refineTool, sha256, splitSegments, stripTransport, wrapperTool } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const OUT = flag("out");
const PER_LANG = Number(flag("per-lang", "8"));
const TOPUP = args.includes("--topup");
if (!OUT) throw new Error("--out DIR is required");
const LANGS = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "Ruby", "PHP", "C#", "C++", "C", "Swift", "Kotlin"];
const EXCLUDED = new Set(["BurntSushi/ripgrep"]);
const WINDOW_DAYS = 80;
const MAX_RUNS = 8;
const MAX_JOBS = 8;
const CAP = { total: 5, failed: 2 };
for (const dir of ["repos", "logs", "lists"]) mkdirSync(join(OUT, dir), { recursive: true });

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
const bump = (name, n = 1) => (stats[name] = (stats[name] ?? 0) + n);

function candidates(lang) {
  const file = join(OUT, "lists", `${lang.replace(/\W/g, "_")}.json`);
  if (existsSync(file)) return readJson(file);
  const out = gh(["search", "repos", "--language", lang, "--sort", "stars", "--archived=false", "--limit", "40", "--json", "fullName,license,stargazersCount,language"]);
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
  const record = existsSync(file) ? readJson(file) : { repo: meta.fullName, bucket, license: meta.license?.key ?? null, stars: meta.stargazersCount, cases: [], inspectedRuns: [], dropped: {}, topup: false };
  if (existsSync(file) && !(TOPUP && !record.topup)) return record;
  const since = Date.now() - WINDOW_DAYS * 86_400_000;
  const listed = gh(["run", "list", "-R", meta.fullName, "--status", "completed", "--limit", "100", "--json", "databaseId,conclusion,createdAt,workflowName"], { allowFail: true });
  const runs = (listed ? JSON.parse(listed) : []).filter((r) => new Date(r.createdAt).getTime() >= since && !record.inspectedRuns.includes(r.databaseId));
  const failed = runs.filter((r) => r.conclusion === "failure").sort(byHash((r) => String(r.databaseId)));
  const passed = runs.filter((r) => r.conclusion === "success").sort(byHash((r) => String(r.databaseId)));
  const order = TOPUP ? failed : interleave(failed, passed);
  const seen = new Set(record.cases.map((c) => `${c.workflow}|${c.step_name}`));
  let inspected = 0;
  const drop = (reason) => (record.dropped[reason] = (record.dropped[reason] ?? 0) + 1);
  for (const run of order) {
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
  record.topup = record.topup || TOPUP;
  writeFileSync(file, JSON.stringify(record));
  return record;
}

const accepted = {};
const picked = new Set();
for (const lang of LANGS) {
  accepted[lang] = 0;
  for (const meta of candidates(lang)) {
    if (accepted[lang] >= PER_LANG) break;
    if (EXCLUDED.has(meta.fullName) || picked.has(meta.fullName)) continue;
    const record = processRepo(meta, lang);
    console.error(`${lang} ${meta.fullName}: ${record.cases.length} cases (${calls} calls)`);
    if (record.cases.length > 0) {
      accepted[lang] += 1;
      picked.add(meta.fullName);
    } else bump("repos_without_cases");
  }
}

const pickedFiles = readdirSync(join(OUT, "repos")).filter((f) => picked.has(readJson(join(OUT, "repos", f)).repo));
const all = pickedFiles.flatMap((f) => readJson(join(OUT, "repos", f)).cases);
const dropped = {};
for (const f of pickedFiles) for (const [k, v] of Object.entries(readJson(join(OUT, "repos", f)).dropped)) dropped[k] = (dropped[k] ?? 0) + v;
writeFileSync(join(OUT, "cases-raw.jsonl"), `${all.map((c) => JSON.stringify(c)).join("\n")}\n`);
writeFileSync(join(OUT, "stats.json"), JSON.stringify({ ...stats, accepted, dropped, repos: new Set(all.map((c) => c.repo)).size, cases: all.length, failed_cases: all.filter((c) => c.failed).length, calls }, null, 1));
console.error(JSON.stringify({ accepted, repos: new Set(all.map((c) => c.repo)).size, cases: all.length, failed: all.filter((c) => c.failed).length, dropped }));
