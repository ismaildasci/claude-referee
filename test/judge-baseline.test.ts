// judge --baseline: hash-only ratchet; new, moved, edited, removed and duplicate items, exit codes and file format.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { itemHash, parseBaseline } from "../src/engine/baseline.ts";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev, type Answerer } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const risky: Answerer = (r) =>
  Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: String((r.state as { item: string }).item).includes("rm -rf") ? 0.97 : 0.02 }]));

async function judge(args: string[], stdin: string, cwd: string) {
  const server = await fakeJev(risky);
  try {
    const io = memoryIo({ stdin, cwd, env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() } });
    const code = await run(["judge", "--question", "line.risky", ...args], io, commands);
    return { code, out: io.json() };
  } finally {
    await server.close();
  }
}

const call = (args: string[], stdin: string, cwd: string) => judge(["--baseline", "base.json", ...args], stdin, cwd);
const record = (cwd: string, lines: string) => call(["--baseline-write"], lines, cwd);

test("baseline-write stores hashes and counts only, no text", async () => {
  const cwd = tempDir();
  const { out } = await record(cwd, "rm -rf $A\nok\nrm -rf $A\nrm -rf $B\n");
  assert.equal(out["verdict"], "recorded");
  assert.equal(out["recorded"], 3);
  const file = readFileSync(join(cwd, "base.json"), "utf8");
  assert.ok(!file.includes("rm") && !file.includes("$A"));
  const baseline = parseBaseline(file);
  assert.equal(baseline.version, 1);
  assert.deepEqual(baseline.entries["line.risky"], { [itemHash("line.risky", "rm -rf $A")]: 2, [itemHash("line.risky", "rm -rf $B")]: 1 });
});

test("a baselined finding is quiet, moves and whitespace changes stay known, exit 0 under --fail-on flagged", async () => {
  const cwd = tempDir();
  await record(cwd, "rm -rf $A\nok\n");
  const { code, out } = await call(["--fail-on", "flagged"], "ok\nok\n   rm -rf    $A\n", cwd);
  assert.equal(code, 0);
  assert.equal(out["verdict"], "clear");
  assert.deepEqual([out["yes"], out["new"], out["baselined"], out["gone"]], [1, 0, 1, 0]);
  assert.equal(out["flagged"], undefined);
});

test("a changed item is new and the old one is gone; --fail-on flagged exits 3", async () => {
  const cwd = tempDir();
  await record(cwd, "rm -rf $A\n");
  const { code, out } = await call(["--fail-on", "flagged"], "rm -rf $A/x\n", cwd);
  assert.equal(code, 3);
  assert.equal(out["verdict"], "flagged");
  assert.deepEqual([out["new"], out["baselined"], out["gone"]], [1, 0, 1]);
  assert.deepEqual(out["flagged"], ["1"]);
});

test("a removed item counts as gone and the verdict is clear", async () => {
  const cwd = tempDir();
  await record(cwd, "rm -rf $A\nrm -rf $B\n");
  const { out } = await call([], "rm -rf $A\nok\n", cwd);
  assert.equal(out["verdict"], "clear");
  assert.deepEqual([out["new"], out["baselined"], out["gone"]], [0, 1, 1]);
});

test("duplicates match as a multiset: the extra copy is new", async () => {
  const cwd = tempDir();
  await record(cwd, "rm -rf $A\nrm -rf $A\n");
  const same = await call([], "rm -rf $A\nrm -rf $A\n", cwd);
  assert.deepEqual([same.out["new"], same.out["baselined"]], [0, 2]);
  const more = await call([], "rm -rf $A\nrm -rf $A\nx\nrm -rf $A\n", cwd);
  assert.equal(more.out["verdict"], "flagged");
  assert.deepEqual([more.out["new"], more.out["baselined"]], [1, 2]);
  assert.deepEqual(more.out["flagged"], ["4"]);
});

test("rewriting reports what was added and dropped", async () => {
  const cwd = tempDir();
  await record(cwd, "rm -rf $A\nrm -rf $B\n");
  const { out } = await record(cwd, "rm -rf $B\nrm -rf $C\n");
  assert.deepEqual([out["recorded"], out["added"], out["dropped"]], [2, 1, 1]);
});

test("baseline errors: missing file, write without file, bad version, other pack", async () => {
  const cwd = tempDir();
  assert.equal((await call([], "x\n", cwd)).out["error"], "bad_input");
  const alone = await judge(["--baseline-write"], "x\n", cwd);
  assert.equal(alone.code, 1);
  assert.match(String(alone.out["message"]), /needs --baseline/);
  writeFileSync(join(cwd, "base.json"), JSON.stringify({ version: 2, pack: "generic", entries: {} }));
  assert.match(String((await call([], "x\n", cwd)).out["message"]), /version 2/);
  writeFileSync(join(cwd, "base.json"), JSON.stringify({ version: 1, pack: "other", entries: {} }));
  assert.match(String((await call([], "x\n", cwd)).out["message"]), /pack other/);
});
