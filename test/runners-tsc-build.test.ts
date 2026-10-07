// tsc -b status lines behind a "t - " clock (TypeScript 7, and 5/6 when not on a TTY) or "[t]": clean, up to date, errors, dry runs, watch, logs cut by tail, head, a watch kill or the done clip (incomplete),
// timestamped logs that are not tsc, and the clean-build marker (only when every listed project ends built or up to date because, with no error token and only clock-stamped status, blank and exit lines after the list).
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

test("tsc -b with a 't - ' clock: a clean TS7 or TS6 build is tsc with 0 errors; a solution root with no status line leaves no pass count and no summary", () => {
  assert.deepEqual(facts(TS7_CLEAN), { passed: 0, errors: 0, incomplete: false, failing: [], summary: null });
  assert.deepEqual(facts(TS6_CLEAN), { passed: 1, errors: 0, incomplete: false, failing: [], summary: "Building project '/srv/work/demo/pkg/tsconfig.json'..." });
  for (const log of [TS7_CLEAN, TS6_CLEAN]) assert.deepEqual(parseEvidence(`${log}exit code: 0\n`).runners.map((r) => r.runner), ["tsc"]);
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

const TS5_ONE = "[10:42:07] Projects in this build: \n    * tsconfig.json\n\n[10:42:07] Project 'tsconfig.json' is out of date because output file 'tsconfig.tsbuildinfo' does not exist\n\n[10:42:07] Building project '/srv/work/ledger/tsconfig.json'...\n\n";
const TS7_ONE = "05:16:25 PM - Projects in this build: \r\n    * tsconfig.json\n\n05:16:25 PM - Project 'tsconfig.json' is being forcibly rebuilt\n\n05:16:25 PM - Building project 'tsconfig.json'...\n\n";
const TS7_SOME_UP = [
  "02:11:40 PM - Projects in this build: \r",
  "    * packages/core/tsconfig.json\r",
  "    * packages/api/tsconfig.json\r",
  "    * packages/web/tsconfig.json",
  "",
  "02:11:40 PM - Project 'packages/core/tsconfig.json' is up to date because newest input 'packages/core/src/index.ts' is older than output 'packages/core/tsconfig.tsbuildinfo'",
  "",
  "02:11:40 PM - Project 'packages/api/tsconfig.json' is out of date because output 'packages/api/tsconfig.tsbuildinfo' is older than input 'packages/api/src/routes.ts'",
  "",
  "02:11:40 PM - Building project 'packages/api/tsconfig.json'...",
  "",
  "02:11:42 PM - Project 'packages/web/tsconfig.json' is up to date because newest input 'packages/web/src/app.ts' is older than output 'packages/web/tsconfig.tsbuildinfo'",
  "",
];
const TS5_ROOT = [
  "[9:05:13 AM] Projects in this build: ",
  "    * libs/util/tsconfig.json",
  "    * tsconfig.json",
  "",
  "[9:05:13 AM] Project 'libs/util/tsconfig.json' is out of date because output file 'libs/util/tsconfig.tsbuildinfo' does not exist",
  "",
  "[9:05:13 AM] Building project '/srv/work/demo/libs/util/tsconfig.json'...",
  "",
  "[9:05:14 AM] Project 'tsconfig.json' is up to date because newest input 'src/main.ts' is older than output 'tsconfig.tsbuildinfo'",
  "",
];
const UP_WEB = "Project 'packages/web/tsconfig.json' is up to date because newest input 'packages/web/src/app.ts' is older than output 'packages/web/tsconfig.tsbuildinfo'";
const unchanged = { passed: 0, errors: 0, incomplete: false, failing: [], summary: null };

test("tsc -b marker: a clean single-project build, '[t]' or 't - ', passes 1 with its last status line as summary, clock removed", () => {
  assert.deepEqual(facts(TS5_ONE), { passed: 1, errors: 0, incomplete: false, failing: [], summary: "Building project '/srv/work/ledger/tsconfig.json'..." });
  assert.deepEqual(facts(TS7_ONE), { passed: 1, errors: 0, incomplete: false, failing: [], summary: "Building project 'tsconfig.json'..." });
  assert.equal(facts(TS7_ONE.replace(/05:16:25 PM - /g, "16.05.12 - "))?.summary, "Building project 'tsconfig.json'...");
  assert.deepEqual(facts(TS7_ONE.replace(/05:16:25 PM - Project 'tsconfig\.json' is being forcibly rebuilt\n\n05:16:25 PM - Building project 'tsconfig\.json'\.\.\./, "05:16:25 PM - Project 'tsconfig.json' is up to date because newest input 'src/a.ts' is older than output 'tsconfig.tsbuildinfo'")), { passed: 1, errors: 0, incomplete: false, failing: [], summary: "Project 'tsconfig.json' is up to date because newest input 'src/a.ts' is older than output 'tsconfig.tsbuildinfo'" });
});

test("tsc -b marker: a multi-project build where some projects are up to date passes every listed project", () => {
  assert.deepEqual(facts(cut(TS7_SOME_UP)), { passed: 3, errors: 0, incomplete: false, failing: [], summary: UP_WEB });
  const bracket = cut(TS7_SOME_UP.map((l) => l.replace(/^(\d\d:\d\d:\d\d PM) - /, "[$1] ")));
  assert.deepEqual(facts(bracket), { passed: 3, errors: 0, incomplete: false, failing: [], summary: UP_WEB });
  assert.deepEqual(facts(cut(TS5_ROOT)), { passed: 2, errors: 0, incomplete: false, failing: [], summary: "Project 'tsconfig.json' is up to date because newest input 'src/main.ts' is older than output 'tsconfig.tsbuildinfo'" });
});

test("tsc -b marker: a listed project with no status line, or one that ends waiting, keeps today's facts", () => {
  for (const log of [TS7_CLEAN, TS7_UP_TO_DATE, cut(TS5_ROOT.slice(0, -2)), cut(TS7_SOME_UP.slice(0, -2))]) assert.deepEqual(facts(log), unchanged);
  const waiting = TS7_UPSTREAM.replace(/\ncore\/src\/a\.ts.*\n/, "\n");
  assert.deepEqual(facts(waiting), unchanged);
  assert.deepEqual(facts(`${TS7_ONE}05:16:26 PM - Project 'tsconfig.json' is up to date but needs to update timestamps of output files that are older than input files\n\n05:16:26 PM - Updating output timestamps of project 'tsconfig.json'...\n\n`), unchanged);
});

test("tsc -b marker: errors are counted as before and give no pass count", () => {
  const error = "src/a.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n";
  assert.deepEqual(facts(`${TS7_ONE}${error}`), { passed: 0, errors: 1, incomplete: false, failing: ["src/a.ts:1:14 TS2322"], summary: null });
  assert.deepEqual(facts(`${TS5_ONE}${error}\nFound 1 error.\n\n`), { passed: 0, errors: 1, incomplete: false, failing: ["src/a.ts:1:14 TS2322"], summary: "Found 1 error." });
  assert.deepEqual(facts(`${cut(TS7_SOME_UP)}error TS6053: File 'packages/web/src/gone.ts' not found.\n`), { passed: 0, errors: 1, incomplete: false, failing: ["TS6053"], summary: null });
});

test("tsc -b marker: a cut log stays incomplete with no pass count", () => {
  const cutOff = { passed: 0, errors: 0, incomplete: true, failing: [], summary: null };
  assert.deepEqual(facts(TS7_ONE.replace(/05:16:25 PM - Building project.*\n\n$/, "")), cutOff);
  assert.deepEqual(facts(cut(TS7_SOME_UP.slice(0, 8))), cutOff);
  assert.deepEqual(facts(cut(TS7_SOME_UP.slice(-6))), cutOff);
  assert.deepEqual(facts(cut([...TS7_SOME_UP.slice(0, 7), "[… 4210 characters omitted …]", ...TS7_SOME_UP.slice(8)])), cutOff);
  assert.deepEqual(facts(TS7_ONE.replace(/05:16:25 PM - Building project 'tsconfig\.json'\.\.\./, "05:16:25 PM - A non-dry build would build project '/srv/work/demo/tsconfig.json'")), cutOff);
});

test("tsc -b marker: watch mode keeps its Found reading", () => {
  for (const [start, found] of [["05:16:24 PM - ", "05:16:26 PM - "], ["[5:16:24 PM] ", "[5:16:26 PM] "]] as const) {
    const log = `${start}Starting compilation in watch mode...\n\n${TS7_ONE.replace(/05:16:25 PM - /g, start)}${found}Found 0 errors. Watching for file changes.\n`;
    assert.deepEqual(facts(log), { passed: 1, errors: 0, incomplete: false, failing: [], summary: `${found}Found 0 errors. Watching for file changes.` });
  }
});

test("done: the marker reaches Jev as tsc facts and adds no cap", () => {
  const ev = `$ npx tsc -b --verbose\n${TS7_ONE}exit code: 0\n`;
  const { planned } = doneRequest(pack, undefined, ["the typecheck passes"], ev);
  const sent = (planned[0]?.state as { evidence: { runners: unknown[] } }).evidence.runners;
  assert.deepEqual(sent, [{ runner: "tsc", passed: 1, failed: 0, errors: 0, skipped: 0, failing: [], summary_line: "Building project 'tsconfig.json'..." }]);
  assert.deepEqual(verdictOf(ev), { verdict: "met", reason: undefined });
  assert.deepEqual(verdictOf(`$ npx tsc -b --verbose\n${cut(TS7_SOME_UP)}exit code: 0\n`), { verdict: "met", reason: undefined });
});

const sentRunners = (evidence: string) => (doneRequest(pack, undefined, ["the typecheck passes"], doneEvidence(evidence)).planned[0]?.state as { evidence: { runners: unknown[] } }).evidence.runners;

test("tsc -b marker: an error line the error parser can't read (a path with a space) still blocks the marker, anywhere in the log", () => {
  const spaced = "src/my file.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.\n";
  const pretty = "src/my file.ts:1:14 - error TS2322: Type 'string' is not assignable to type 'number'.\n\n1 export const a: number = \"x\";\n               ~\n\n";
  for (const log of [`${TS7_ONE}${spaced}`, `${TS5_ONE}${spaced}`, `${TS7_ONE}${pretty}`, `${cut(TS7_SOME_UP)}${spaced}`, `${TS7_ONE}${spaced}${TS7_ONE}`, `$ npx tsc -p src\n${spaced}${TS7_ONE}`]) assert.deepEqual(facts(log), unchanged, log);
  assert.deepEqual(sentRunners(`${TS7_ONE}${spaced}`), [{ runner: "tsc", passed: 0, failed: 0, errors: 0, skipped: 0, failing: [], summary_line: null }]);
});

test("tsc -b marker: text after the status lines (a crash, another tool, a test run) or between them blocks the marker", () => {
  const oom = "\n<--- Last few GCs --->\n\n[1234:0x1a2b3c4d5e]      210 ms: Mark-Compact (reduce) 30.1 (32.0) -> 30.0 (31.5) MB\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n----- Native stack trace -----\n\n 1: 0x100000001 node::OOMErrorHandler(char const*, v8::OOMDetails const&)\n";
  const panic = "panic: runtime error: index out of range [3] with length 3\n\ngoroutine 1 [running]:\nmain.main()\n";
  const debug = "Error: Debug Failure. False expression.\n    at Object.createProgram (/srv/work/demo/node_modules/typescript/lib/typescript.js:1:1)\n";
  const eslint = "/srv/work/demo/src/x.ts\n  3:7  warning  'y' is assigned a value but never used  no-unused-vars\n\n✖ 1 problem (0 errors, 1 warning)\n";
  const nodeTest = "✔ build plan prints status lines (3.1ms)\nℹ tests 1\nℹ pass 1\nℹ fail 0\n";
  for (const tail of [oom, `${oom}exit code: 0\n`, panic, debug, eslint, nodeTest, "Done in 2.41s.\n"]) {
    assert.deepEqual(facts(`${TS5_ONE}${tail}`), unchanged, tail);
    assert.deepEqual(facts(`${TS7_ONE}${tail}`), unchanged, tail);
  }
  assert.deepEqual(facts(cut([...TS7_SOME_UP.slice(0, 6), "  3:7  warning  'y' is assigned a value but never used  no-unused-vars", ...TS7_SOME_UP.slice(6)])), unchanged);
  assert.deepEqual(sentRunners(`${TS5_ONE}${oom}exit code: 0\n`), [{ runner: "tsc", passed: 0, failed: 0, errors: 0, skipped: 0, failing: [], summary_line: null }]);
  for (const exit of ["exit code: 0\n", "Exit status: 0\n", "\nexit code: 0\n\n"]) assert.equal(facts(`${TS7_ONE}${exit}`)?.passed, 1, exit);
});

test("tsc -b marker: status lines without tsc's clock (printed by a test, say) give no marker", () => {
  const bare = "Projects in this build:\n    * fixtures/app/tsconfig.json\n\nBuilding project 'fixtures/app/tsconfig.json'...\n\n";
  assert.deepEqual(facts(bare), unchanged);
  assert.deepEqual(facts(`\n RUN  v3.2.4 /srv/app\n\nstdout | test/build.test.ts > prints the plan\n${bare} ✓ test/build.test.ts (1 test) 12ms\n\n Test Files  1 passed (1)\n      Tests  1 passed (1)\n`), unchanged);
  assert.deepEqual(facts(TS7_ONE.replace("05:16:25 PM - Building", "Building")), unchanged);
  assert.deepEqual(facts(TS7_ONE.replace("05:16:25 PM - Projects", "Projects")), unchanged);
  assert.deepEqual(facts(TS7_ONE.replace(/05:16:25 PM - /g, "[build] ")), unchanged);
});

test("tsc -b marker: a dry run's bare 'is up to date' (no 'because') ends nothing, so it keeps today's facts", () => {
  const dry = "05:16:25 PM - Projects in this build: \r\n    * single/tsconfig.json\n\n05:16:25 PM - Project 'single/tsconfig.json' is up to date because newest input 'single/src/a.ts' is older than output 'single/tsconfig.tsbuildinfo'\n\n05:16:25 PM - Project '/srv/work/demo/single/tsconfig.json' is up to date\n\n";
  assert.deepEqual(facts(dry), unchanged);
  assert.deepEqual(facts(dry.replace(/05:16:25 PM - /g, "[8:00:28 PM] ")), unchanged);
  assert.deepEqual(facts(dry.replace(/05:16:25 PM - Project '\/srv.*\n\n$/, "")), { passed: 1, errors: 0, incomplete: false, failing: [], summary: "Project 'single/tsconfig.json' is up to date because newest input 'single/src/a.ts' is older than output 'single/tsconfig.tsbuildinfo'" });
});
