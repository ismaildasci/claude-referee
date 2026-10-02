// Split done-v2 bar (docs/decisions/done-bar-split.md): evidence classes, clusters, per-class scoring, the repository split and the dev backlog.
// Offline; the replay test reads the committed jev-evals suites and the hash-only real-log table.

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { R_RECALL_MIN_N, SEED, backlogOf, classOfTrust, clusterKey, holdoutHash, scoreByClass, scoreClass, splitRepos, verdictOfBar, type BarRow } from "../scripts/done-bar/lib.mjs";
import { evidenceClass, replaySuite } from "../scripts/done-bar/replay.mjs";

const PYTEST = "$ pytest -q\n....\n4 passed in 0.31s\nexit code: 0";
const EXIT_ONLY = "$ make build\ncc -o app main.c\nexit code: 0";
const NOTHING = "$ make build\ncc -o app main.c";

test("classes follow the repository's own parser: R parsed, E exit code only, U neither", () => {
  assert.equal(evidenceClass(PYTEST), "R");
  assert.equal(evidenceClass(EXIT_ONLY), "E");
  assert.equal(evidenceClass(NOTHING), "U");
  assert.equal(classOfTrust("parsed"), "R");
  assert.equal(classOfTrust("exit_code"), "E");
  assert.equal(classOfTrust("unparsed"), "U");
});

test("class is taken from the text after the done clipping", () => {
  const tail = `${"noise line\n".repeat(3000)}${PYTEST}`;
  assert.equal(evidenceClass(tail), "R");
  const hidden = `$ pytest -q\n${"x".repeat(5000)}\n4 passed in 0.31s\n${"y".repeat(20_000)}\nexit code: 0`;
  assert.equal(evidenceClass(hidden), "E");
});

test("the same step logged with and without its exit code line is one cluster; labels and content keep clusters apart", () => {
  assert.equal(clusterKey(EXIT_ONLY, "met"), clusterKey(NOTHING, "met"));
  assert.equal(clusterKey(`${EXIT_ONLY}\n`, "met"), clusterKey(EXIT_ONLY.replace("exit code: 0", "Exit status = 0"), "met"));
  assert.notEqual(clusterKey(EXIT_ONLY, "met"), clusterKey(EXIT_ONLY, "missing"));
  assert.notEqual(clusterKey(EXIT_ONLY, "met"), clusterKey(`${EXIT_ONLY}\nwarning: x`, "met"));
});

const row = (id: string, cls: BarRow["cls"], expected: string, verdict: string | null, over: Partial<BarRow> = {}): BarRow => ({ cls, expected, code_decided: false, status: "ok", verdict, cluster: id, ...over });

test("wrong met, recalls and exclusions are counted over clusters of sent cases", () => {
  const rows: BarRow[] = [
    row("a", "R", "met", "met"),
    row("b", "R", "met", "unsure"),
    row("c", "R", "missing", "met"),
    row("d", "R", "missing", "missing"),
    row("e", "E", "missing", "missing"),
    row("f", "E", "missing", "missing", { code_decided: true, status: "code" }),
    row("g", "E", "met", null, { status: "stale" }),
    row("h", "U", "missing", "unsure"),
  ];
  const s = scoreByClass(rows);
  assert.deepEqual([s.R.wrong_met.k, s.R.wrong_met.n], [1, 2]);
  assert.deepEqual([s.R.met_recall.k, s.R.met_recall.n], [1, 2]);
  assert.deepEqual([s.E.wrong_met.k, s.E.wrong_met.n], [0, 1]);
  assert.equal(s.E.code_decided, 1);
  assert.equal(s.E.unusable, 1);
  assert.equal(s.U.missing_recall.k, 0);
  assert.equal(s.all.clusters, 6);
  const bar = verdictOfBar(s);
  assert.equal(bar.wrong_met_zero_each_class, false);
  assert.deepEqual(bar.r_met_recall, { evaluable: false, n: 2 });
  assert.equal(bar.u_coverage.clusters, 1);
});

test("a cluster is a wrong met when any member is met and a hit only when all members are", () => {
  const rows: BarRow[] = [row("1", "E", "missing", "missing", { cluster: "x" }), row("2", "U", "missing", "met", { cluster: "x" }), row("3", "E", "met", "met", { cluster: "y" }), row("4", "E", "met", "unsure", { cluster: "y" })];
  const s = scoreClass(rows);
  assert.equal(s.clusters, 2);
  assert.equal(s.wrong_met.k, 1);
  assert.equal(s.met_recall.k, 0);
  const merged = scoreByClass(rows);
  assert.equal(merged.E.clusters, 2);
  assert.equal(merged.U.clusters, 0);
});

test("R met recall gets a verdict only from 30 clusters; zero wrong met reports an exact upper bound", () => {
  const few = scoreByClass(Array.from({ length: R_RECALL_MIN_N - 1 }, (_, i) => row(`m${i}`, "R", "met", "met")));
  assert.equal(verdictOfBar(few).r_met_recall.evaluable, false);
  const enough = scoreByClass([...Array.from({ length: R_RECALL_MIN_N }, (_, i) => row(`m${i}`, "R", "met", i < 27 ? "met" : "unsure")), ...Array.from({ length: 19 }, (_, i) => row(`x${i}`, "R", "missing", "missing"))]);
  assert.deepEqual(verdictOfBar(enough).r_met_recall, { evaluable: true, ok: true, n: 30 });
  assert.ok(Math.abs((enough.R.wrong_met.upper95_one_sided ?? 0) - (1 - 0.05 ** (1 / 19))) < 1e-6);
});

const REPOS = ["java", "js", "py", "go", "rs", "rb"].flatMap((l) => Array.from({ length: l === "go" ? 5 : 4 }, (_, i) => ({ repo: `${l}/r${i}`, language: l })));

test("repository split is deterministic, balanced per bucket, and moves with the seed", () => {
  const a = splitRepos(REPOS);
  assert.deepEqual([...splitRepos([...REPOS].reverse())].sort(), [...a].sort());
  for (const lang of new Set(REPOS.map((r) => r.language))) {
    const parts = REPOS.filter((r) => r.language === lang).map((r) => a.get(r.repo));
    const dev = parts.filter((p) => p === "dev").length;
    assert.equal(dev, Math.ceil(parts.length / 2));
  }
  assert.notDeepEqual([...splitRepos(REPOS, `${SEED}-other`)].sort(), [...a].sort());
  assert.equal(holdoutHash(["b", "a"]), holdoutHash(["a", "b"]));
});

interface TableRow { id: string; repo: string; language: string; tool: string; purpose: string; parsed: boolean; expected: string; trust: string; code_decided: boolean }
const table = readFileSync(new URL("../docs/data/done-v2-real/table.jsonl", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as TableRow);
const dataFile = (name: string) => JSON.parse(readFileSync(new URL(`../docs/data/done-v2-real/${name}`, import.meta.url), "utf8"));

test("the whole-sample backlog is reproduced by the backlog function, and the dev backlog uses dev repositories only", () => {
  assert.deepEqual(backlogOf(table), dataFile("backlog.json"));
  const split = dataFile("split.json") as { repos: Record<string, string>; dev_ids: string[]; holdout_ids: string[]; holdout_ids_sha256: string };
  const dev = table.filter((r) => split.repos[r.repo] === "dev");
  assert.deepEqual(backlogOf(dev), dataFile("backlog-dev.json"));
  assert.equal(dev.length, split.dev_ids.length);
  assert.equal(new Set([...split.dev_ids, ...split.holdout_ids]).size, table.length);
  assert.equal(split.holdout_ids_sha256, holdoutHash(split.holdout_ids));
  const again = splitRepos(table);
  assert.deepEqual(Object.fromEntries([...again].sort(([a], [b]) => (a < b ? -1 : 1))), split.repos);
});

test("real-log classes in the table match the parser trust field and no case is unparsed", () => {
  const counts: Record<string, number> = {};
  for (const r of table) counts[classOfTrust(r.trust)] = (counts[classOfTrust(r.trust)] ?? 0) + 1;
  assert.deepEqual(counts, { R: 82, E: 147 });
  assert.ok(table.every((r) => (r.trust === "parsed") === r.parsed));
});

test("replay: recorded suites match current hashes, a changed text is stale, a missing recording is missing, a non-zero exit is code", () => {
  const rows = replaySuite(new URL("../jev-evals", import.meta.url).pathname, "done-v2-h6p");
  assert.equal(rows.length, 8);
  assert.ok(rows.every((r) => r.status === "ok" && r.cls === "R"));
  const dir = mkdtempSync(join(tmpdir(), "done-bar-"));
  const src = new URL("../jev-evals/done-v2-h6p", import.meta.url).pathname;
  mkdirSync(join(dir, "s"));
  const cases = readFileSync(join(src, "cases.jsonl"), "utf8").split("\n").filter(Boolean).slice(0, 2).map((l) => JSON.parse(l));
  cases[0].evidence += "\nan extra line";
  cases.push({ id: "x-fail", split: "holdout", group: "P", criterion: "all tests pass", expected: "missing", evidence: "$ npm test\nexit code: 1" });
  cases.push({ id: "x-new", split: "holdout", group: "P", criterion: "all tests pass", expected: "met", evidence: PYTEST });
  writeFileSync(join(dir, "s", "cases.jsonl"), `${cases.map((c) => JSON.stringify(c)).join("\n")}\n`);
  writeFileSync(join(dir, "s", "suite.json"), readFileSync(join(src, "suite.json"), "utf8"));
  writeFileSync(join(dir, "s", "recorded.jsonl"), readFileSync(join(src, "recorded.jsonl"), "utf8"));
  const byId = Object.fromEntries(replaySuite(dir, "s").map((r) => [r.id, r.status]));
  assert.deepEqual(byId, { "h6p-01": "stale", "h6p-02": "ok", "x-fail": "code", "x-new": "missing" });
});
