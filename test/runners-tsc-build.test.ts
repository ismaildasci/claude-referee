// tsc -b status lines behind a "t - " clock (TypeScript 7, and 5/6 when not on a TTY) or "[t]": clean, up to date, errors, dry runs, watch, logs cut by tail, head,
// a watch kill or the done clip (incomplete), and timestamped logs that are not tsc.
// Every line is invented to mirror the shape of real tsc 6.0 and 7.0 output; real log text is never committed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { doneEvidence, doneRequest } from "../src/cli/commands/done.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { parseEvidence } from "../src/engine/runners/index.ts";
import { parsers } from "../src/engine/runners/js.ts";

const tsc = parsers.find((p) => p.name === "tsc");
const pack = loadPack("generic", packDirs(process.env));
const verdictOf = (evidence: string, criterion = "the typecheck passes", p = 0.98) => {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul", noul: p } }, stopped: [], cached: true }]);
  return { verdict: result.verdict, reason: result["reason"] };
};
const facts = (text: string) => {
  const f = tsc?.parse(text) ?? null;
  return f === null ? null : { passed: f.passed, errors: f.errors, incomplete: f.incomplete ?? false, failing: f.failing, summary: f.summary_line };
};

const TS7_CLEAN = [
  "09:14:02 AM - Projects in this build: \r",
  "    * libs/shared/tsconfig.json\r",
  "    * apps/site/tsconfig.json\r",
  "    * tsconfig.json",
  "",
  "09:14:02 AM - Project 'libs/shared/tsconfig.json' is being forcibly rebuilt",
  "",
  "09:14:02 AM - Building project 'libs/shared/tsconfig.json'...",
  "",
  "09:14:03 AM - Project 'apps/site/tsconfig.json' is out of date because output file 'apps/site/tsconfig.tsbuildinfo' does not exist",
  "",
  "09:14:03 AM - Building project 'apps/site/tsconfig.json'...",
  "",
].join("\n");
const TS6_CLEAN = "9:14:02 AM - Projects in this build: \r\n    * pkg/tsconfig.json\n\n9:14:02 AM - Project 'pkg/tsconfig.json' is out of date because output 'pkg/out/index.js' is older than input 'pkg/src/index.ts'\n\n9:14:02 AM - Building project '/srv/work/demo/pkg/tsconfig.json'...\n\n";
const TS7_UP_TO_DATE = "11:30:45 PM - Projects in this build: \r\n    * libs/shared/tsconfig.json\r\n    * tsconfig.json\n\n11:30:45 PM - Project 'libs/shared/tsconfig.json' is up to date because newest input 'libs/shared/src/index.ts' is older than output 'libs/shared/tsconfig.tsbuildinfo'\n\n";
const TS7_ERRORS = `${TS7_CLEAN}libs/shared/src/math.ts(4,7): error TS2322: Type 'string' is not assignable to type 'number'.\nlibs/shared/src/math.ts(9,12): error TS2304: Cannot find name 'round'.\n`;
const TS7_UPSTREAM = "09:14:02 AM - Projects in this build: \r\n    * core/tsconfig.json\r\n    * web/tsconfig.json\n\n09:14:02 AM - Building project 'core/tsconfig.json'...\n\ncore/src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n09:14:02 AM - Project 'web/tsconfig.json' is up to date with .d.ts files from its dependencies\n\n09:14:02 AM - Updating output timestamps of project 'web/tsconfig.json'...\n\n";
const TS7_DRY = "09:14:02 AM - Projects in this build: \r\n    * core/tsconfig.json\n\n09:14:02 AM - Project 'core/tsconfig.json' is out of date because buildinfo file 'core/tsconfig.tsbuildinfo' indicates that program needs to report errors.\n\n09:14:02 AM - A non-dry build would build project '/srv/work/demo/core/tsconfig.json'\n\n";

test("tsc -b with a 't - ' clock: a clean TS7 or TS6 build is tsc with 0 errors, no pass count and no summary", () => {
  for (const log of [TS7_CLEAN, TS6_CLEAN]) {
    assert.deepEqual(facts(log), { passed: 0, errors: 0, incomplete: false, failing: [], summary: null });
    assert.deepEqual(parseEvidence(`${log}exit code: 0\n`).runners.map((r) => r.runner), ["tsc"]);
  }
});

test("tsc -b clocks in other locales and the pretty '[t]' lead read the same", () => {
  for (const lead of ["16:05:12 - ", "16.05.12 - ", "오후 4:05:12 - ", "4:05:12 PM - ", "[4:05:12 PM] ", "[04:05:12 PM] "]) {
    assert.deepEqual(facts(`${lead}Projects in this build: \n    * tsconfig.json\n\n${lead}Building project 'tsconfig.json'...\n`)?.errors, 0, lead);
  }
});

test("tsc -b where every project is up to date is tsc with 0 errors", () => {
  assert.deepEqual(facts(TS7_UP_TO_DATE), { passed: 0, errors: 0, incomplete: false, failing: [], summary: null });
  assert.equal(facts("11:30:45 PM - Project 'tsconfig.json' is up to date because newest input 'src/a.ts' is older than output 'tsconfig.tsbuildinfo'\n")?.errors, 0);
});

test("tsc -b errors are counted as before; the status lines never hide them", () => {
  assert.deepEqual(facts(TS7_ERRORS), { passed: 0, errors: 2, incomplete: false, failing: ["libs/shared/src/math.ts:4:7 TS2322", "libs/shared/src/math.ts:9:12 TS2304"], summary: null });
  assert.equal(facts(TS7_UPSTREAM)?.errors, 1);
  assert.equal(facts(`${TS7_ERRORS}09:14:04 AM - Found 0 errors. Watching for file changes.\n`)?.errors, 2);
});

test("tsc -b dry runs and skipped projects compiled nothing, so the run is cut off", () => {
  assert.deepEqual(facts(TS7_DRY), { passed: 0, errors: 0, incomplete: true, failing: [], summary: null });
  assert.equal(facts("9:14:02 AM - A non-dry build would update timestamps for output of project '/srv/work/demo/web/tsconfig.json'\n")?.incomplete, true);
  assert.equal(facts("[9:14:02 AM] A non-dry build would delete the following files: \n * /srv/work/demo/out/a.js\n")?.incomplete, true);
  assert.equal(facts("9:14:02 AM - Skipping build of project '/srv/work/demo/web/tsconfig.json' because its dependency '/srv/work/demo/core' has errors\n")?.incomplete, true);
  assert.equal(facts("9:14:02 AM - Project 'web/tsconfig.json' can't be built because its dependency 'core' was not built\n")?.incomplete, true);
});

test("tsc watch summary behind a 't - ' clock is read like the '[t]' one", () => {
  assert.deepEqual(facts("\u001b[2J\u001b[3J\u001b[H3:01:44 PM - Starting compilation in watch mode...\n\n\n3:01:45 PM - Found 0 errors. Watching for file changes.\n"), { passed: 1, errors: 0, incomplete: false, failing: [], summary: "3:01:45 PM - Found 0 errors. Watching for file changes." });
  assert.equal(facts("src/a.ts(1,1): error TS2322: bad\n\n15:01:45 - Found 3 errors. Watching for file changes.\n")?.errors, 3);
  assert.equal(facts("03:01:44 PM - Starting compilation in watch mode...\n\nerror starting FSEvents stream\n"), null);
});

test("timestamped logs that are not tsc status lines are not claimed", () => {
  const logs = [
    "04:23:07 PM - Deploying to staging...\n04:23:09 PM - Done in 2.1s\n",
    "[10:42:07] Deploying...\n[10:42:08] Starting 'build'...\n",
    "16:05:12 - Building the bundle...\n16:05:14 - Found 0 errors in config\n",
    "2026-10-07 16:05:12 - Building project 'api'...\n",
    "04:23:07 PM - Project 'web' deployed to production\n",
    "4:23:54 PM [vite] page reload src/a.ts\n",
    "12:00:01 - Found 0 errors.\n",
  ];
  for (const log of logs) {
    assert.equal(tsc?.parse(log), null, log);
    assert.deepEqual(parseEvidence(`${log}exit code: 0\n`).runners, [], log);
  }
});

test("done: a clean TS7 tsc -b log reaches Jev as tsc facts; a dry run is never met; errors are missing without a request", () => {
  for (const log of [TS7_CLEAN, TS6_CLEAN, TS7_UP_TO_DATE]) {
    const ev = parseEvidence(`$ npx tsc -b --verbose\n${log}exit code: 0\n`);
    assert.deepEqual({ trust: ev.trust, runners: ev.runners.map((r) => [r.runner, r.errors]) }, { trust: "parsed", runners: [["tsc", 0]] });
    assert.deepEqual(verdictOf(`$ npx tsc -b --verbose\n${log}exit code: 0\n`), { verdict: "met", reason: undefined });
    assert.deepEqual(verdictOf(`$ npx tsc -b --verbose\n${log}exit code: 0\n`, "the typecheck passes", 0.2), { verdict: "missing", reason: undefined });
  }
  assert.deepEqual(verdictOf(`${TS7_DRY}exit code: 0\n`), { verdict: "unsure", reason: "incomplete_run" });
  assert.deepEqual(verdictOf(`${TS7_DRY}exit code: 0\n`, "the typecheck passes", 0.2), { verdict: "missing", reason: undefined });
  assert.deepEqual(verdictOf(`${TS7_ERRORS}exit code: 2\n`), { verdict: "missing", reason: "exit_code_nonzero" });
  assert.deepEqual(verdictOf(`${TS7_UPSTREAM}exit code: 2\n`, "tsc -b builds every project"), { verdict: "missing", reason: "exit_code_nonzero" });
});

const MIXED = [
  "04:43:21 PM - Projects in this build: \r",
  "    * pkgs/a/tsconfig.json\r",
  "    * pkgs/b/tsconfig.json\r",
  "    * pkgs/c/tsconfig.json\r",
  "    * tsconfig.json",
  "",
  "04:43:21 PM - Project 'pkgs/a/tsconfig.json' is out of date because output file 'pkgs/a/tsconfig.tsbuildinfo' does not exist",
  "",
  "04:43:21 PM - Building project 'pkgs/a/tsconfig.json'...",
  "",
  "pkgs/a/src/index.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.",
  "04:43:21 PM - Project 'pkgs/b/tsconfig.json' is out of date because output file 'pkgs/b/tsconfig.tsbuildinfo' does not exist",
  "",
  "04:43:21 PM - Building project 'pkgs/b/tsconfig.json'...",
  "",
  "04:43:22 PM - Project 'pkgs/c/tsconfig.json' is out of date because output file 'pkgs/c/tsconfig.tsbuildinfo' does not exist",
  "",
  "04:43:22 PM - Building project 'pkgs/c/tsconfig.json'...",
  "",
];
const cut = (l: readonly string[]) => `${l.join("\n")}\n`;

test("tsc -b: a whole solution log needs no status line for its root (listed last); TS6's absolute build paths count", () => {
  assert.deepEqual(facts(cut(MIXED)), { passed: 0, errors: 1, incomplete: false, failing: ["pkgs/a/src/index.ts:1:14 TS2322"], summary: null });
  const ts6 = cut(MIXED.map((l) => l.replace(/^04:(\d\d:\d\d) PM - Building project '/, "4:$1 PM - Building project '/srv/work/demo/")));
  assert.equal(facts(ts6)?.incomplete, false);
  const tty = "\u001b[90m[4:23:37 PM]\u001b[0m Projects in this build: \r\r\n    * multi/core/tsconfig.json\r\r\n    * multi/app/tsconfig.json\r\r\n    * multi/tsconfig.json\r\n\r\n[4:23:37 PM] Project 'multi/core/tsconfig.json' is being forcibly rebuilt\r\n\r\n[4:23:37 PM] Building project 'multi/core/tsconfig.json'...\r\n\r\n[4:23:37 PM] Project 'multi/app/tsconfig.json' is being forcibly rebuilt\r\n\r\n[4:23:37 PM] Building project 'multi/app/tsconfig.json'...\r\n\r\n";
  assert.deepEqual(facts(tty), { passed: 0, errors: 0, incomplete: false, failing: [], summary: null });
});

test("tsc -b with no Found line: a tail cut has no header, so the run is cut off even with tail's exit code 0", () => {
  for (const n of [4, 8]) {
    const tail = cut(MIXED.slice(-n));
    assert.deepEqual(facts(tail), { passed: 0, errors: 0, incomplete: true, failing: [], summary: null }, `tail ${n}`);
    for (const ev of [tail, `${tail}exit code: 0\n`]) {
      assert.deepEqual(verdictOf(ev), { verdict: "unsure", reason: "incomplete_run" }, `tail ${n}`);
      assert.deepEqual(verdictOf(ev, "the typecheck passes", 0.2), { verdict: "missing", reason: undefined }, `tail ${n}`);
    }
  }
  assert.equal(facts("4:43:22 PM - Project 'pkgs/c/tsconfig.json' is up to date because newest input 'pkgs/c/src/index.ts' is older than output 'pkgs/c/tsconfig.tsbuildinfo'\n")?.incomplete, true);
});

test("tsc -b with no Found line: a head cut misses a listed project's status, or ends before a pending build", () => {
  for (const n of [1, 2, 5, 10, 16, 17]) {
    assert.equal(facts(cut(MIXED.slice(0, n)))?.incomplete, true, `head ${n}`);
  }
  assert.deepEqual(verdictOf(`${cut(MIXED.slice(0, 10))}exit code: 0\n`), { verdict: "unsure", reason: "incomplete_run" });
  assert.deepEqual(verdictOf(`${cut(MIXED.slice(0, 10))}exit code: 0\n`, "the typecheck passes", 0.2), { verdict: "missing", reason: undefined });
  assert.equal(facts(`Found 0 errors.\n${cut(MIXED.slice(0, 10))}`)?.incomplete, true);
  assert.equal(facts("09:14:02 AM - Projects in this build: \r\n    * tsconfig.json\n\n")?.incomplete, true);
  assert.equal(facts("09:14:02 AM - Projects in this build: \r\n    * tsconfig.json\n\n09:14:02 AM - Project 'tsconfig.json' is being forcibly rebuilt\n\n")?.incomplete, true);
  assert.equal(facts(TS7_UPSTREAM.replace(/09:14:02 AM - Updating output timestamps.*\n\n$/, ""))?.incomplete, true);
});

test("tsc -b with no Found line: a clipped 80-project log whose error fell in the omitted middle is cut off", () => {
  const names = Array.from({ length: 80 }, (_, i) => `libs/m${100 + i}/tsconfig.json`);
  const project = (p: string, i: number) => [
    `04:47:12 PM - Project '${p}' is out of date because output file '${p.replace("tsconfig.json", "tsconfig.tsbuildinfo")}' does not exist`,
    "",
    `04:47:12 PM - Building project '${p}'...`,
    "",
    ...(i === 5 ? [`libs/m${100 + i}/src/index.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.`] : []),
  ];
  const log = cut(["04:47:12 PM - Projects in this build: \r", ...names.map((p) => `    * ${p}\r`), "    * tsconfig.json", "", ...names.flatMap(project)]);
  assert.deepEqual({ errors: facts(log)?.errors, incomplete: facts(log)?.incomplete }, { errors: 1, incomplete: false });
  const clipped = doneEvidence(log);
  assert.ok(clipped.includes("characters omitted") && !clipped.includes("error TS2322"));
  assert.deepEqual(facts(clipped), { passed: 0, errors: 0, incomplete: true, failing: [], summary: null });
  assert.deepEqual(verdictOf(clipped), { verdict: "unsure", reason: "incomplete_run" });
  assert.deepEqual(verdictOf(clipped, "the typecheck passes", 0.2), { verdict: "missing", reason: undefined });
  assert.equal(facts(cut([...MIXED.slice(0, 10), "[… 4210 characters omitted …]", ...MIXED.slice(11)]))?.incomplete, true);
});

test("tsc watch: a log cut before the Found line that follows its last start or file change is cut off", () => {
  const start = "\u001b[2J\u001b[3J\u001b[H04:49:20 PM - Starting compilation in watch mode...\n\n";
  const killed = `${start}${cut(MIXED.slice(0, 10))}`;
  assert.deepEqual(facts(killed), { passed: 0, errors: 0, incomplete: true, failing: [], summary: null });
  assert.deepEqual(verdictOf(killed), { verdict: "unsure", reason: "incomplete_run" });
  assert.deepEqual(verdictOf(killed, "the typecheck passes", 0.2), { verdict: "missing", reason: undefined });
  const first = `${start}${cut(MIXED.slice(0, 5))}\n04:49:20 PM - Project 'pkgs/a/tsconfig.json' is up to date because newest input 'pkgs/a/src/index.ts' is older than output 'pkgs/a/tsconfig.tsbuildinfo'\n\n04:49:20 PM - Found 0 errors. Watching for file changes.\n`;
  const change = "\u001b[2J\u001b[3J\u001b[H04:49:31 PM - File change detected. Starting incremental compilation...\n\n04:49:31 PM - Project 'pkgs/a/tsconfig.json' is out of date because output 'pkgs/a/tsconfig.tsbuildinfo' is older than input 'pkgs/a/src/index.ts'\n\n04:49:31 PM - Building project 'pkgs/a/tsconfig.json'...\n\n";
  assert.equal(facts(`${first}${change}`)?.incomplete, true);
  assert.deepEqual(verdictOf(`${first}${change}`), { verdict: "unsure", reason: "incomplete_run" });
  assert.equal(facts(`${first}${change}04:49:31 PM - Found 0 errors. Watching for file changes.\n`)?.incomplete, false);
  assert.equal(facts("[3:01:44 PM] Starting compilation in watch mode...\n\n[3:01:45 PM] Found 0 errors. Watching for file changes.\n\n[3:02:10 PM] File change detected. Starting incremental compilation...\n")?.incomplete, true);
});
