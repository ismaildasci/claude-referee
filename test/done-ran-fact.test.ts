// docs/decisions/done-ran-fact.md: done --run sends the detected command's name as a fact next to parsed counts, and a build-only log under a test claim gets the build-only reason and next step whatever Jev answers.
// Every log line below is invented; the fake Jev answers the probability given per test.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { posixTest } from "./posix-test.ts";
import { commands } from "../src/cli/commands/index.ts";
import { doneRequest } from "../src/cli/commands/done.ts";
import { run } from "../src/cli/run.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
import { fakeJev, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const pack = loadPack("generic", packDirs(process.env));
const lines = (...l: string[]) => `${l.join("\n")}\n`;
const PINT = '{"tool":"pint","result":"passed"}';
const PINT_FAILED = '{"tool":"pint","result":"failed"}';

function ask(evidence: string, criterion: string, p: number, ran?: string) {
  const { planned, finish } = doneRequest(pack, undefined, [criterion], evidence, ran === undefined ? undefined : 0, ran);
  const result = finish(planned.length === 0 ? [] : [{ id: "done", answers: { c1: { type: "noul" as const, noul: p } }, stopped: [], cached: true }]);
  return { planned, result };
}
const factsOf = (planned: ReturnType<typeof ask>["planned"]) => (planned[0]?.state as { evidence: Record<string, unknown> }).evidence;

test("ran is a fact only for parsed evidence, with a subfolder prefix removed and 80 characters at most", () => {
  const parsed = lines(PINT, "exit code: 0");
  assert.equal(factsOf(ask(parsed, "composer test exits with code 0", 0.9, "composer test").planned)["ran"], "composer test");
  assert.equal(factsOf(ask(parsed, "x exits with code 0", 0.9, 'cd "web app" && npm run test').planned)["ran"], "npm run test");
  assert.equal(factsOf(ask(parsed, "x exits with code 0", 0.9, `composer ${"t".repeat(120)}`).planned)["ran"]?.toString().length, 80);
  assert.equal("ran" in factsOf(ask(lines("exit code: 0"), "x exits with code 0", 0.9, "npm run test").planned), false);
  assert.equal("ran" in factsOf(ask(parsed, "pint passes", 0.9).planned), false);
});

test("a build-only log under a test claim gets no_tests_run and the build-only next step when Jev says missing or unsure", () => {
  for (const p of [0.1, 0.6]) {
    const { result } = ask(lines(PINT, "exit code: 0"), "all tests pass", p, "composer test");
    assert.equal(result["reason"], "no_tests_run", String(p));
    assert.match(String(result["next_step"]), /^The log shows only a build or a lint run/);
  }
});

test("no build-only reason when the criterion is not a test claim, a runner failed, or the evidence is not parsed", () => {
  assert.equal(ask(lines(PINT, "exit code: 0"), "lint is clean", 0.1, "composer test").result["reason"], undefined);
  assert.equal(ask(lines(PINT_FAILED, "exit code: 0"), "all tests pass", 0.1, "composer test").result["reason"], undefined);
  assert.equal(ask(lines("exit code: 0"), "all tests pass", 0.1, "composer test").result["reason"], undefined);
});

async function doneRun(scripts: Record<string, string>, args: string[], p: number): Promise<{ out: Record<string, unknown>; requests: FakeRequest[] }> {
  const dir = tempDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "p", scripts }));
  const fake = await fakeJev((request) => Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: p }])));
  try {
    const home = tempDir();
    const io = memoryIo({ cwd: dir, home, platform: "linux", env: { HOME: home, PATH: process.env["PATH"], TYPESAFE_BASE_URL: fake.url, REFEREE_BASE_URL_KEY: "test-key" } });
    await run(["done", ...args], io, commands);
    return { out: JSON.parse(io.out.join("").trim().split("\n").at(-1) ?? "{}") as Record<string, unknown>, requests: fake.requests };
  } finally {
    await fake.close();
  }
}

posixTest("done --run: Jev gets the command name, and a missing answer on a lint-only script names the criterion to claim", async () => {
  const script = { test: `node -e "console.log(JSON.stringify({tool:'pint',result:'passed'}))"` };
  const claimed = await doneRun(script, ["--run", "test", "--criteria", "npm run test exits with code 0"], 0.97);
  assert.equal((claimed.requests[0]?.state as { evidence: { ran?: string } }).evidence.ran, "npm run test");
  assert.equal(claimed.out["verdict"], "met");
  const defaulted = await doneRun(script, ["--run", "test"], 0.1);
  assert.deepEqual([defaulted.out["verdict"], defaulted.out["reason"]], ["missing", "no_tests_run"]);
  assert.match(String(defaulted.out["next_step"]), /^npm run test ran only build or lint tools.*--criteria "npm run test exits with code 0"/);
});

posixTest("done --run in a subfolder: the fact and the hint name the command without the folder", async () => {
  const root = tempDir();
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(join(root, ".claude", "referee.json"), JSON.stringify({ pack: "generic" }));
  mkdirSync(join(root, "web"));
  writeFileSync(join(root, "web", "package.json"), JSON.stringify({ name: "p", scripts: { test: `node -e "console.log(JSON.stringify({tool:'pint',result:'passed'}))"` } }));
  const fake = await fakeJev((request) => Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: 0.1 }])));
  try {
    const home = tempDir();
    const io = memoryIo({ cwd: root, home, platform: "linux", env: { HOME: home, PATH: process.env["PATH"], TYPESAFE_BASE_URL: fake.url, REFEREE_BASE_URL_KEY: "test-key" } });
    await run(["done", "--run", "test"], io, commands);
    const out = JSON.parse(io.out.join("").trim().split("\n").at(-1) ?? "{}") as Record<string, unknown>;
    assert.equal(out["ran"], "cd web && npm run test");
    assert.equal((fake.requests[0]?.state as { evidence: { ran?: string } }).evidence.ran, "npm run test");
    assert.match(String(out["next_step"]), /^cd web && npm run test ran only.*--criteria "npm run test exits with code 0"/);
  } finally {
    await fake.close();
  }
});
