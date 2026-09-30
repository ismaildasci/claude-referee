// done: verdict bands, several criteria, stdin evidence, dry runs and credential stops.

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev, type FakeJev, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, secretsFile, tempDir } from "./helpers.ts";

const nouls = (p: number) => (request: FakeRequest) => Object.fromEntries(Object.keys(request.questions).map((id) => [id, { type: "noul", noul: p }]));

function io(server: FakeJev | null, stdin: string, dataDir = tempDir()) {
  return memoryIo({ stdin, env: { TYPESAFE_API_KEY: "ts_test", ...(server ? { TYPESAFE_BASE_URL: server.url } : {}), REFEREE_DATA_DIR: dataDir } });
}

test("done bands: met, unsure and missing all exit 0", async () => {
  for (const [p, verdict] of [[0.92, "met"], [0.6, "unsure"], [0.2, "missing"]] as const) {
    const server = await fakeJev(nouls(p));
    try {
      const out = io(server, "Tests: 12 passed, 12 total\n");
      assert.equal(await run(["done", "--criteria", "all tests pass", "--evidence", "-"], out, commands), 0);
      const result = out.json();
      assert.equal(result["verdict"], verdict);
      assert.equal(result["p"], p);
      assert.equal("next_step" in result, verdict !== "met");
      assert.match(String(result["receipt"]), /^r[0-9a-z]+$/);
    } finally {
      await server.close();
    }
  }
});

test("done --fail-on missing exits 3", async () => {
  const server = await fakeJev(nouls(0.1));
  try {
    assert.equal(await run(["done", "--criteria", "lint is clean", "--fail-on", "missing,unsure"], io(server, "3 errors"), commands), 3);
  } finally {
    await server.close();
  }
});

test("done asks several criteria in one request and echoes none of the text", async () => {
  const server = await fakeJev((r) => ({ c1: { type: "noul", noul: 0.95 }, c2: { type: "noul", noul: 0.3 } }));
  try {
    const out = io(server, "\u001b[32mPASS\u001b[0m 3 tests\nlint: 2 warnings");
    await run(["done", "--criteria", "all tests pass", "--criteria", "no lint warnings"], out, commands);
    assert.equal(server.requests.length, 1);
    assert.deepEqual(Object.keys(server.requests[0]?.questions ?? {}), ["c1", "c2"]);
    assert.equal((server.requests[0]?.state as { evidence: string }).evidence, "PASS 3 tests\nlint: 2 warnings");
    const line = out.out.join("");
    assert.equal(out.json()["verdict"], "missing");
    assert.deepEqual(out.json()["criteria"], [{ i: 1, verdict: "met", p: 0.95 }, { i: 2, verdict: "missing", p: 0.3 }]);
    assert.ok(!line.includes("all tests pass") && !line.includes("lint warnings") && !line.includes("PASS"));
  } finally {
    await server.close();
  }
});

test("done without evidence or criteria is a bad_input error", async () => {
  const noEvidence = io(null, "");
  assert.equal(await run(["done", "--criteria", "x"], noEvidence, commands), 1);
  assert.equal(noEvidence.json()["error"], "bad_input");
  const noCriteria = io(null, "ok");
  assert.equal(await run(["done"], noCriteria, commands), 1);
  assert.equal(noCriteria.json()["error"], "bad_input");
});

test("done --dry-run shows the redacted request and touches neither network nor disk", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  try {
    const out = io(server, "mail ops@acme.io\nall green", dataDir);
    assert.equal(await run(["done", "--criteria", "all green", "--dry-run"], out, commands), 0);
    const result = out.json();
    assert.equal(result["verdict"], "would_send");
    assert.match(JSON.stringify(result["sent"]), /\[REDACTED:email\]/);
    assert.equal(server.requests.length, 0);
    assert.deepEqual(readdirSync(dataDir), []);
  } finally {
    await server.close();
  }
});

test("done with credentials in the evidence sends nothing and prints no secret", async () => {
  const server = await fakeJev();
  try {
    const out = io(server, "");
    const code = await run(["done", "--criteria", "tests pass", "--evidence", secretsFile(), "--dry-run"], out, commands);
    assert.equal(code, 1);
    assert.equal(out.json()["error"], "credential_in_state");
    assert.doesNotMatch(out.out.join(""), /AKIA|ghp_|sk-ant-/);
    const live = io(server, "");
    assert.equal(await run(["done", "--criteria", "tests pass", "--evidence", secretsFile()], live, commands), 1);
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
  }
});
