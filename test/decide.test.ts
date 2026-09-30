// decide: two orders, verdict rules, micro flags, per-option mode, context files and output size.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { fakeJev, type Answerer, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const OPTIONS = [
  { name: "redis", text: "Redis, already deployed in every region" },
  { name: "memory", text: "In-process LRU cache on each instance" },
  { name: "postgres", text: "A counters table in the main Postgres database" },
  { name: "edge", text: "Rate limiting at the CDN edge" },
];

function labels(r: FakeRequest): string[] {
  return Object.keys((r.questions["best"]?.criteria ?? {}) as object);
}

function favour(weights: Record<string, number>): Answerer {
  return (r) => {
    if (r.questions["best"]) {
      const probabilities = Object.fromEntries(labels(r).map((l) => [l, weights[l] ?? 0]));
      return { best: { type: "choice", choice: labels(r)[0], confidence: 0.9, probabilities } };
    }
    return Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: 0.9 }]));
  };
}

const firstWins: Answerer = (r) => {
  const ls = labels(r);
  return { best: { type: "choice", choice: ls[0], confidence: 0.6, probabilities: Object.fromEntries(ls.map((l, i) => [l, i === 0 ? 0.6 : 0.4 / (ls.length - 1)])) } };
};

async function decideWith(answer: Answerer, input: unknown, cwd?: string) {
  const server = await fakeJev(answer);
  try {
    const io = memoryIo({ stdin: JSON.stringify(input), env: { TYPESAFE_API_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() }, ...(cwd ? { cwd } : {}) });
    const code = await run(["decide"], io, commands);
    return { code, out: io.json(), line: io.out.join("").trim(), requests: server.requests };
  } finally {
    await server.close();
  }
}

test("decide asks the written and the reversed order in two requests", async () => {
  const { out, requests } = await decideWith(favour({ redis: 0.9, memory: 0.04, postgres: 0.03, edge: 0.03 }), { decision: "Where should rate-limit counters live?", options: OPTIONS });
  assert.equal(requests.length, 2);
  assert.deepEqual(labels(requests[0]!), ["redis", "memory", "postgres", "edge"]);
  assert.deepEqual(labels(requests[1]!), ["edge", "postgres", "memory", "redis"]);
  assert.equal(out["verdict"], "clear");
  assert.equal(out["lean"], "redis");
  assert.equal(out["order_disagrees"], false);
});

test("decide output stays under 400 characters and never echoes option text", async () => {
  const { line } = await decideWith(favour({ redis: 0.5, memory: 0.3, postgres: 0.1, edge: 0.1 }), { decision: "Where should rate-limit counters live?", options: OPTIONS });
  assert.ok(line.length <= 400, `${line.length}: ${line}`);
  for (const o of OPTIONS) assert.ok(!line.includes(o.text));
  assert.ok(!line.includes("rate-limit counters"));
});

test("decide verdicts: weak needs a margin, a tie gives lean and a next step", async () => {
  const weak = await decideWith(favour({ redis: 0.6, memory: 0.4 }), { decision: "d", options: OPTIONS.slice(0, 2) });
  assert.equal(weak.out["verdict"], "weak");
  const tie = await decideWith(favour({ redis: 0.52, memory: 0.48 }), { decision: "d", options: OPTIONS.slice(0, 2) });
  assert.equal(tie.out["verdict"], "tie");
  assert.equal(tie.out["lean"], "redis");
  assert.match(String(tie.out["next_step"]), /missing fact.*won't change/);
});

test("decide can't be clear when the two orders disagree", async () => {
  const { out } = await decideWith(firstWins, { decision: "d", options: OPTIONS });
  assert.equal(out["order_disagrees"], true);
  assert.equal(out["verdict"], "tie");
  assert.match(String(out["next_step"]), /different leaders/);
});

test("decide asks micro questions once per option and reports them only as flags", async () => {
  const answer: Answerer = (r) =>
    r.questions["best"] ? favour({ redis: 0.9, memory: 0.1 })(r) : { stateless: { type: "noul", noul: (r.state as { option: string }).option.startsWith("Redis") ? 0.9 : 0.1 } };
  const { out, requests } = await decideWith(answer, { decision: "d", options: OPTIONS.slice(0, 2), micro: [{ id: "stateless", question: "Does this keep the service stateless?" }] });
  assert.equal(requests.length, 4);
  assert.equal(out["verdict"], "clear");
  assert.deepEqual(out["flags"], [{ option: "memory", rule: "stateless", p: 0.1 }]);
});

test("decide switches to per-option scores when the options don't fit one request", async () => {
  const long = "x".repeat(60_000);
  const answer: Answerer = (r) => ({ fit: { type: "score", score: (r.state as { option: string }).option.startsWith("A") ? 4 : 1, confidence: 0.9, legend: {}, probabilities: {} } });
  const { out, requests } = await decideWith(answer, { decision: "d", options: [{ name: "a", text: `A ${long}` }, { name: "b", text: `B ${long}` }] });
  assert.equal(requests.length, 2);
  assert.equal(out["mode"], "per_option");
  assert.equal(out["lean"], "a");
  assert.equal(out["verdict"], "clear");
});

test("decide reads context files itself and reports paths and sizes", async () => {
  const cwd = tempDir();
  writeFileSync(join(cwd, "adr.md"), "We already run Redis in every region.");
  const { out, requests } = await decideWith(favour({ redis: 0.9, memory: 0.1 }), { decision: "d", options: OPTIONS.slice(0, 2), context_files: ["adr.md"] }, cwd);
  assert.deepEqual(out["read"], [{ path: "adr.md", bytes: 37 }]);
  assert.deepEqual((requests[0]?.state as { context_files: object }).context_files, { "adr.md": "We already run Redis in every region." });
});

test("decide rejects bad input", async () => {
  for (const input of [{ options: OPTIONS }, { decision: "d", options: [OPTIONS[0]] }, { decision: "d", options: [OPTIONS[0], OPTIONS[0]] }, { decision: "d", options: [{ name: "bad name", text: "x" }, "y"] }]) {
    const { code, out } = await decideWith(favour({}), input);
    assert.equal(code, 1);
    assert.equal(out["error"], "bad_input");
  }
});
