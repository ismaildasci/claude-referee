// judge and verify: item formats, bands, batch stops, claim batching and verdicts.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { parseItems } from "../src/cli/commands/judge.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev, type Answerer } from "./fake-jev.ts";
import { FAKE, memoryIo, tempDir } from "./helpers.ts";

async function call(args: string[], answer: Answerer, stdin = "", cwd?: string) {
  const server = await fakeJev(answer);
  try {
    const io = memoryIo({ stdin, env: { TYPESAFE_API_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() }, ...(cwd ? { cwd } : {}) });
    const code = await run(args, io, commands);
    return { code, out: io.json(), requests: server.requests };
  } finally {
    await server.close();
  }
}

const byItem =
  (scores: Record<string, number>): Answerer =>
  (r) =>
    Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: scores[(r.state as { item: string }).item] ?? 0.5 }]));

test("judge items parse as JSON arrays, JSON lines or plain lines", () => {
  assert.deepEqual(parseItems('["a", {"id": "x", "text": "b"}]'), [{ id: "1", text: "a" }, { id: "x", text: "b" }]);
  assert.deepEqual(parseItems('{"id": 7, "text": "a"}\n{"text": "b"}\n'), [{ id: "7", text: "a" }, { id: "2", text: "b" }]);
  assert.deepEqual(parseItems("first\n\nthird\n"), [{ id: "1", text: "first" }, { id: "3", text: "third" }]);
});

test("judge splits answers into yes, no and review bands", async () => {
  const { out, requests } = await call(["judge", "--question", "line.risky"], byItem({ "rm -rf $DIR": 0.95, "// comment": 0.02, "retry(3)": 0.5 }), "rm -rf $DIR\n// comment\nretry(3)\n");
  assert.equal(requests.length, 3);
  assert.equal(out["verdict"], "flagged");
  assert.deepEqual([out["yes"], out["no"], out["review"]], [1, 1, 1]);
  assert.deepEqual(out["flagged"], ["1"]);
  assert.deepEqual(out["review_ids"], ["3"]);
});

test("judge skips an item holding a credential and still answers the others", async () => {
  const { code, out, requests } = await call(["judge", "--question", "line.risky"], byItem({ ok: 0.01 }), `ok\nkey = ${FAKE.aws}\n`);
  assert.equal(code, 0);
  assert.deepEqual(out["stopped"], ["2"]);
  assert.equal(out["verdict"], "clear");
  assert.equal(requests.length, 1);
});

test("judge needs yes/no questions from the pack", async () => {
  const unknown = await call(["judge", "--question", "no.such"], byItem({}), "x");
  assert.equal(unknown.out["error"], "bad_pack");
  const choice = await call(["judge", "--question", "decide.best"], byItem({}), "x");
  assert.equal(choice.out["error"], "bad_input");
});

test("verify asks every claim about one source in a single request", async () => {
  const cwd = tempDir();
  writeFileSync(join(cwd, "CHANGELOG.md"), "0.1.0: adds done, decide, judge and verify.");
  const answer: Answerer = () => ({ "claim:1": { type: "noul", noul: 0.97 }, "claim:2": { type: "noul", noul: 0.03 }, "claim:3": { type: "noul", noul: 0.5 } } as Record<string, unknown>);
  const { out, requests } = await call(
    ["verify", "--source", "CHANGELOG.md", "--claim", "0.1.0 adds verify", "--claim", "0.1.0 adds a Stop hook", "--claim", "0.1.0 is stable"],
    answer,
    "",
    cwd,
  );
  assert.equal(requests.length, 1);
  assert.deepEqual(Object.keys(requests[0]?.questions ?? {}), ["claim:1", "claim:2", "claim:3"]);
  assert.equal(out["verdict"], "unsupported");
  assert.equal(out["supported"], 1);
  assert.deepEqual(out["unsupported"], ["2"]);
  assert.deepEqual(out["unsure"], ["3"]);
  assert.deepEqual(out["p"], { "2": 0.03, "3": 0.5 });
});

test("verify all supported, and input errors", async () => {
  const yes: Answerer = (r) => Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: 0.99 }]));
  const ok = await call(["verify", "--claim", "the sky is blue"], yes, "The sky is blue.");
  assert.equal(ok.out["verdict"], "supported");
  assert.equal("next_step" in ok.out, false);
  const none = await call(["verify"], yes, "text");
  assert.equal(none.out["error"], "bad_input");
  const both = await call(["verify", "--claims", "-"], yes, "text");
  assert.equal(both.out["error"], "bad_input");
});

test("verify maps answers back to claim ids that look like UUIDs", async () => {
  const cwd = tempDir();
  writeFileSync(join(cwd, "src.md"), "Redis runs in every region.");
  const ids = ["3f2a9c1e-77b1-4d2e-9a3b-1c2d3e4f5a6b", "9b1d7a3c-1e2f-4a5b-8c9d-0e1f2a3b4c5d"];
  const claims = ids.map((id, i) => JSON.stringify({ id, text: i === 0 ? "Redis runs everywhere." : "Redis is down." })).join("\n");
  writeFileSync(join(cwd, "claims.jsonl"), claims);
  const answer: Answerer = (r) => Object.fromEntries(Object.keys(r.questions).map((k) => [k, { type: "noul", noul: k.endsWith(ids[0]!) ? 0.95 : 0.05 }]));
  const { out } = await call(["verify", "--source", "src.md", "--claims", "claims.jsonl"], answer, "", cwd);
  assert.equal(out["supported"], 1);
  assert.deepEqual(out["unsupported"], [ids[1]]);
});
