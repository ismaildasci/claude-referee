// Real-log study helpers: transport stripping, step segments, classifier, evidence text, exact intervals. No network.

import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEvidence, classify, clopperPearson, kappa, negativeKind, refineTool, silentOutput, splitSegments, stripTransport, upperOneSided } from "../scripts/real-ci/lib.mjs";

const LOG = [
  "2026-09-14T01:24:01.2027120Z Current runner version: '2.337.0'",
  "2026-09-14T01:24:02.1029919Z ##[group]Run actions/checkout@v4",
  "2026-09-14T01:24:02.1030669Z with:",
  "2026-09-14T01:24:02.1031099Z ##[endgroup]",
  "2026-09-14T01:24:03.0000000Z ##[group]Run npm test",
  "2026-09-14T01:24:03.0000001Z shell: /usr/bin/bash -e {0}",
  "2026-09-14T01:24:03.0000002Z ##[endgroup]",
  "2026-09-14T01:24:04.0000000Z > pkg@1.0.0 test",
  "2026-09-14T01:24:04.0000001Z > vitest run",
  "2026-09-14T01:24:05.0000000Z  Tests  4 failed | 9 passed",
  "2026-09-14T01:24:05.0000001Z ##[error]Process completed with exit code 1.",
  "2026-09-14T01:24:06.0000000Z Post job cleanup.",
  "2026-09-14T01:24:06.0000001Z [command]/usr/bin/git version",
].join("\n");

test("transport prefix and BOM are removed, group markers split steps", () => {
  const lines = stripTransport(`﻿${LOG}`);
  assert.equal(lines[0], "Current runner version: '2.337.0'");
  const segments = splitSegments(lines);
  assert.equal(segments.length, 2);
  assert.equal(segments[0]?.uses, true);
  assert.equal(segments[1]?.uses, false);
  assert.equal(segments[1]?.script, "npm test");
  assert.deepEqual(segments[1]?.exits, [1]);
  assert.ok(!segments[1]?.lines.some((l) => l.includes("Post job cleanup")));
});

test("evidence text turns the run header into a command line and appends the exit line", () => {
  const segment = splitSegments(stripTransport(LOG))[1];
  assert.ok(segment);
  const { text, exit } = buildEvidence(segment);
  assert.equal(exit, 1);
  assert.match(text, /^\$ npm test\n/);
  assert.match(text, /Process completed with exit code 1\.\nexit code: 1$/);
  assert.ok(!text.includes("##["));
});

test("a succeeded step gets exit code 0", () => {
  const log = "2026-09-14T01:24:03Z ##[group]Run cargo test\n2026-09-14T01:24:03Z ##[endgroup]\n2026-09-14T01:24:04Z test result: ok. 3 passed; 0 failed";
  const segment = splitSegments(stripTransport(log))[0];
  assert.ok(segment);
  assert.equal(buildEvidence(segment).text.split("\n").at(-1), "exit code: 0");
});

test("classifier picks one purpose, excludes multi-purpose and unrelated steps", () => {
  assert.deepEqual(classify("Run tests", "cargo nextest run"), { purpose: "test", tool: "cargo test" });
  assert.deepEqual(classify("Lint", "npx eslint ."), { purpose: "lint", tool: "eslint" });
  assert.deepEqual(classify("Build", "cargo build --release"), { purpose: "build", tool: "cargo build" });
  assert.deepEqual(classify("x", "npm run lint && npm test"), { excluded: "multi-purpose" });
  assert.deepEqual(classify("Deploy", "./deploy.sh"), { excluded: "none" });
});

test("exact intervals", () => {
  const upper = upperOneSided(0, 60);
  assert.ok(upper !== null && Math.abs(upper - (1 - 0.05 ** (1 / 60))) < 1e-6);
  const ci = clopperPearson(10, 20);
  assert.ok(ci.lo !== null && ci.hi !== null && Math.abs(ci.lo - 0.2719) < 1e-3 && Math.abs(ci.hi - 0.7281) < 1e-3);
  assert.deepEqual(clopperPearson(0, 0), { lo: null, hi: null });
  assert.equal(clopperPearson(0, 5).lo, 0);
  const large = clopperPearson(767, 1043);
  assert.ok(large.lo !== null && large.hi !== null && Math.abs(large.lo - 0.7075) < 1e-3 && Math.abs(large.hi - 0.7619) < 1e-3);
  const nearAll = clopperPearson(103, 104);
  assert.ok(nearAll.hi !== null && Math.abs(nearAll.hi - 0.99976) < 1e-5);
});

test("kappa of perfect and chance agreement", () => {
  assert.equal(kappa([["met", "met"], ["missing", "missing"]]), 1);
  assert.equal(kappa([["met", "missing"], ["missing", "met"]]), -1);
});

const HEAD = "$ poetry run isort --check .\n\u001b[36;1mpoetry run isort --check .\u001b[0m\nshell: /usr/bin/bash -e {0}\nenv:\n  PYTHONUNBUFFERED: 1\n";

test("silent output: only echo, env block, npm and yarn echo lines, notices and the exit line", () => {
  assert.equal(silentOutput(`${HEAD}exit code: 0`), true);
  assert.equal(silentOutput("$ npm run lint\nshell: bash\n\n> pkg@1.0.0 lint\n> eslint ./src/**\nexit code: 0"), true);
  assert.equal(silentOutput("$ pnpm lint\nshell: bash\nenv:\n  HUSKY: 0\n$ eslint src\nexit code: 0"), true);
  assert.equal(silentOutput("$ eslint .\nshell: bash\nNode 20 is being deprecated. This workflow is running with Node 24.\nexit code: 0"), true);
  assert.equal(silentOutput("$ vendor/bin/phpstan\nshell: bash\nNote: Using configuration file /x/phpstan.neon.\nexit code: 0"), true);
});

test("silent output: real output or no shell header is not silent", () => {
  assert.equal(silentOutput(`${HEAD}Skipped 1 files\nexit code: 0`), false);
  assert.equal(silentOutput("$ ruff check\nshell: bash\nAll checks passed!\nexit code: 0"), false);
  assert.equal(silentOutput("$ make\nexit code: 0"), false);
});

test("tool field names phpstan and php-cs-fixer instead of phpcs; other tools are unchanged", () => {
  assert.equal(refineTool("phpcs", "$ vendor/bin/phpstan analyze\nshell: bash"), "phpstan");
  assert.equal(refineTool("phpcs", "$ vendor/bin/php-cs-fixer fix --dry-run"), "php-cs-fixer");
  assert.equal(refineTool("phpcs", "$ vendor/bin/phpcs src"), "phpcs");
  assert.equal(refineTool("eslint", "$ vendor/bin/phpstan"), "eslint");
});

test("negative kind separates checks that ran from steps that only mention the tool", () => {
  assert.equal(negativeKind("6 tests skipped out of 412"), "ran_not_clean");
  assert.equal(negativeKind("ESLint reported 459 warnings"), "ran_not_clean");
  assert.equal(negativeKind("Only package has no test files; zero tests ran"), "ran_not_clean");
  assert.equal(negativeKind("Only installs ruff; the linter never ran"), "not_run");
  assert.equal(negativeKind("Build only; checkstyle and spotless explicitly skipped, no lint ran"), "not_run");
  assert.equal(negativeKind("Only echoes a problem matcher; no tests executed"), "not_run");
});

const jsonl = (rows: object[]) => `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
const run = (script: string, ...args: string[]) => execFileSync(process.execPath, [join(import.meta.dirname, "..", "scripts", "real-ci", script), ...args], { encoding: "utf8", env: { ...process.env, PATH: "/nonexistent" } });

test("fetch aggregation keeps only repositories the registered selection accepts (8 per bucket, star order)", () => {
  const out = mkdtempSync(join(tmpdir(), "real-ci-fetch-"));
  for (const dir of ["lists", "repos"]) mkdirSync(join(out, dir));
  const langs = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "Ruby", "PHP", "C#", "C++", "C", "Swift", "Kotlin"];
  for (const lang of langs) writeFileSync(join(out, "lists", `${lang.replace(/\W/g, "_")}.json`), "[]");
  const names = Array.from({ length: 9 }, (_, i) => `o/js${i}`);
  writeFileSync(join(out, "lists", "JavaScript.json"), JSON.stringify(names.map((fullName) => ({ fullName, stargazersCount: 1 }))));
  const record = (repo: string) => ({ repo, bucket: "JavaScript", license: null, stars: 1, cases: [{ id: `rl-${repo}`, repo, failed: false }], inspectedRuns: [], dropped: {}, topup: true });
  for (const repo of [...names, "o/cached-but-not-listed"]) writeFileSync(join(out, "repos", `${repo.replace("/", "__")}.json`), JSON.stringify(record(repo)));
  run("fetch.mjs", "--out", out, "--topup");
  const ids = readFileSync(join(out, "cases-raw.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { repo: string }).repo);
  assert.equal(ids.length, 8);
  assert.ok(!ids.includes("o/js8") && !ids.includes("o/cached-but-not-listed"));
});

test("assemble drops a met label on silent output as ambiguous and keeps a silent missing label", () => {
  const dir = mkdtempSync(join(tmpdir(), "real-ci-asm-"));
  const base = { repo: "o/r", purpose: "lint", criterion: "lint is clean", tool: "isort", failed: false };
  writeFileSync(join(dir, "cases-screened.jsonl"), jsonl([
    { ...base, id: "rl-silentmet", evidence: `${HEAD}exit code: 0` },
    { ...base, id: "rl-silentmissing", evidence: `${HEAD}exit code: 0` },
    { ...base, id: "rl-printed", evidence: "$ ruff\nshell: bash\nAll checks passed!\nexit code: 0" },
  ]));
  writeFileSync(join(dir, "labels1.jsonl"), jsonl([{ id: "rl-silentmet", label: "met" }, { id: "rl-silentmissing", label: "missing" }, { id: "rl-printed", label: "met" }]));
  run("assemble.mjs", dir, join(dir, "suite"));
  const report = JSON.parse(readFileSync(join(dir, "assemble.json"), "utf8")) as { silent_met: { id: string }[]; kept: number };
  assert.deepEqual(report.silent_met.map((r) => r.id), ["rl-silentmet"]);
  const kept = readFileSync(join(dir, "kept.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { id: string }).id);
  assert.deepEqual(kept, ["rl-silentmissing", "rl-printed"]);
});
