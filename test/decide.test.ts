// decide: two orders, verdict rules, micro flags, per-option mode, context files and output size.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { planDecide } from "../src/cli/commands/decide.ts";
import { run } from "../src/cli/run.ts";
import type { Answer } from "../src/engine/client.ts";
import { loadPack, packDirs } from "../src/engine/pack.ts";
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
    const io = memoryIo({ stdin: JSON.stringify(input), env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() }, ...(cwd ? { cwd } : {}) });
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
  assert.match(String(tie.out["next_step"]), /separates redis from memory \(what each costs/);
  assert.match(String(weak.out["next_step"]), /separates redis from memory/);
  const clear = await decideWith(favour({ redis: 0.97, memory: 0.03 }), { decision: "d", options: OPTIONS.slice(0, 2) });
  assert.equal(clear.out["verdict"], "clear");
  assert.equal("next_step" in clear.out, false);
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

test("decide never sends the home directory in context file paths", async () => {
  const home = tempDir("referee-home-");
  const cwd = join(home, "app");
  mkdirSync(cwd);
  writeFileSync(join(cwd, "adr.md"), "We already run Redis in every region.");
  const server = await fakeJev(favour({ redis: 0.9, memory: 0.1 }));
  try {
    const input = { decision: "d", options: OPTIONS.slice(0, 2), context_files: [join(cwd, "adr.md")] };
    const io = memoryIo({ stdin: JSON.stringify(input), home, cwd, env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir() } });
    assert.equal(await run(["decide"], io, commands), 0);
    for (const r of server.requests) assert.ok(!JSON.stringify(r).includes(home), JSON.stringify(r.state));
    assert.deepEqual(Object.keys((server.requests[0]?.state as { context_files: object }).context_files), ["~/app/adr.md"]);
  } finally {
    await server.close();
  }
});

test("decide rejects bad input", async () => {
  for (const input of [{ options: OPTIONS }, { decision: "d", options: [OPTIONS[0]] }, { decision: "d", options: [OPTIONS[0], OPTIONS[0]] }, { decision: "d", options: [{ name: "bad name", text: "x" }, "y"] }]) {
    const { code, out } = await decideWith(favour({}), input);
    assert.equal(code, 1);
    assert.equal(out["error"], "bad_input");
  }
});

test("decide uses a pack's decide.micro questions when the input has none; bad: 1 marks yes as bad", async () => {
  const packs = tempDir();
  const dir = join(packs, "micro-test");
  mkdirSync(join(dir, "questions"), { recursive: true });
  writeFileSync(join(dir, "pack.json"), JSON.stringify({ name: "micro-test", version: "0.0.1", extends: "generic" }));
  writeFileSync(
    join(dir, "questions", "micro.json"),
    JSON.stringify({ "decide.micro.stateless": { type: "noul", instructions: "Does this keep the service stateless?" }, "decide.micro.risky": { type: "noul", instructions: "Is this risky to run?" } }),
  );
  writeFileSync(join(dir, "thresholds.json"), JSON.stringify({ "decide.micro.risky": { bad: 1 } }));
  const answer: Answerer = (r) => {
    if (r.questions["best"]) return favour({ redis: 0.9, memory: 0.1 })(r);
    const p = (r.state as { option: string }).option.startsWith("Redis") ? 0.9 : 0.1;
    return Object.fromEntries(Object.keys(r.questions).map((id) => [id, { type: "noul", noul: p }]));
  };
  const server = await fakeJev(answer);
  try {
    const input = { decision: "d", options: OPTIONS.slice(0, 2) };
    const io = memoryIo({ stdin: JSON.stringify(input), env: { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: tempDir(), REFEREE_PACKS_DIR: packs } });
    assert.equal(await run(["decide", "--pack", "micro-test"], io, commands), 0);
    assert.equal(server.requests.length, 4);
    assert.deepEqual(Object.keys(server.requests[2]?.questions ?? {}), ["stateless", "risky"]);
    assert.deepEqual(io.json()["flags"], [{ option: "redis", rule: "risky", p: 0.9 }, { option: "memory", rule: "stateless", p: 0.1 }]);
  } finally {
    await server.close();
  }
});

test("decide's two requests differ in option order for every accepted kind of name", async () => {
  for (const names of [["redis", "memory", "edge"], ["o1", "o2", "o3"], ["1a", "2b", "3c"], ["1.5", "2.5"], ["v1.5", "v2.0"]]) {
    const input = { decision: "d", options: names.map((name) => ({ name, text: `Option ${name}` })) };
    const io = memoryIo({ stdin: JSON.stringify(input), env: { TYPESAFE_API_KEY: "ts_test", REFEREE_DATA_DIR: tempDir() } });
    assert.equal(await run(["decide", "--dry-run", "--pretty"], io, commands), 0, names.join(","));
    const sent = io.json()["sent"] as { id: string; questions: { best: { criteria: object } } }[];
    const order = (id: string) => Object.keys(sent.find((s) => s.id === id)?.questions.best.criteria ?? {});
    assert.deepEqual(order("written"), names);
    assert.deepEqual(order("reversed"), [...names].reverse());
  }
});

test("decide rejects option names made only of digits, which would defeat the reversed order", async () => {
  const input = { decision: "d", options: [{ name: "1", text: "one" }, { name: "2", text: "two" }, { name: "3", text: "three" }] };
  const { code, out } = await decideWith(favour({}), input);
  assert.equal(code, 1);
  assert.equal(out["error"], "bad_input");
  assert.match(String(out["next_step"]), /starts with a letter/);
});

test("decide counts a margin of exactly 0.1 as weak, not a tie", async () => {
  const { out } = await decideWith(favour({ redis: 0.5, memory: 0.4, postgres: 0.1, edge: 0 }), { decision: "Pick a rate limiter", options: OPTIONS });
  assert.equal(out["lean"], "redis");
  assert.equal(out["verdict"], "weak");
});

const slotBonus = (base: Record<string, number>, bonus: number): Answerer => (r) => {
  const ls = labels(r);
  const raw = Object.fromEntries(ls.map((l, i) => [l, (base[l] ?? 0) + (i === 0 ? bonus : 0)]));
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  return { best: { type: "choice", choice: ls[0], confidence: 0.6, probabilities: Object.fromEntries(ls.map((l) => [l, raw[l]! / total])) } };
};

test("a two-order tie asks the other balanced orders and takes lean and verdict from the mean of all 2n", async () => {
  const { out, requests } = await decideWith(slotBonus({ redis: 0.5, memory: 0.2, postgres: 0.15, edge: 0.15 }, 0.4), { decision: "Where should rate-limit counters live?", options: OPTIONS });
  const names = OPTIONS.map((o) => o.name);
  const rot = (i: number) => [...names.slice(i), ...names.slice(0, i)];
  const expected = [0, 1, 2, 3].flatMap((i) => [rot(i).join(","), [...rot(i)].reverse().join(",")]);
  assert.equal(requests.length, 8);
  assert.deepEqual(requests.map((r) => labels(r).join(",")).sort(), [...expected].sort());
  assert.deepEqual(requests.slice(0, 2).map((r) => labels(r).join(",")), [rot(0).join(","), [...rot(0)].reverse().join(",")]);
  assert.equal(out["orders"], 8);
  assert.equal(out["order_disagrees"], true);
  assert.equal(out["lean"], "redis");
  assert.equal(out["verdict"], "weak");
  assert.equal((out["p"] as Record<string, number>)["redis"], 0.42);
});

test("two agreeing orders and two-option ties stay at two requests", async () => {
  const agree = await decideWith(favour({ redis: 0.6, memory: 0.2, postgres: 0.1, edge: 0.1 }), { decision: "d", options: OPTIONS });
  assert.equal(agree.requests.length, 2);
  assert.equal(agree.out["orders"], 2);
  const two = await decideWith(favour({ redis: 0.52, memory: 0.48 }), { decision: "d", options: OPTIONS.slice(0, 2) });
  assert.equal(two.requests.length, 2);
  assert.equal(two.out["verdict"], "tie");
});

test("an exact top tie inside one order is no leader for that order, whatever the key order of the answer", () => {
  const best = (probabilities: Record<string, number>): Readonly<Record<string, Answer>> => ({ best: { type: "choice", choice: "", confidence: 0.5, probabilities } as Answer });
  const byId = (written: Record<string, number>, reversed: Record<string, number>) => new Map([["written", best(written)], ["reversed", best(reversed)]]);
  const two = planDecide(loadPack("generic", packDirs({})), undefined, { decision: "x" }, [{ name: "a", text: "A" }, { name: "b", text: "B" }]);
  const ab = two.summarize(byId({ a: 0.5, b: 0.5 }, { b: 0.7, a: 0.3 }));
  const ba = two.summarize(byId({ b: 0.5, a: 0.5 }, { b: 0.7, a: 0.3 }));
  assert.deepEqual(ab, ba);
  assert.equal(ab.disagree, true);
  assert.equal(ab.verdict, "tie");
  const three = planDecide(loadPack("generic", packDirs({})), undefined, { decision: "x" }, [{ name: "a", text: "A" }, { name: "b", text: "B" }, { name: "c", text: "C" }]);
  const reversed = { c: 0.05, b: 0.7, a: 0.25 };
  assert.equal(three.followUp(byId({ a: 0.45, b: 0.45, c: 0.1 }, reversed)).length, 4);
  assert.equal(three.followUp(byId({ b: 0.45, a: 0.45, c: 0.1 }, reversed)).length, 4);
  const agreeing = two.summarize(byId({ b: 0.6, a: 0.4 }, { b: 0.7, a: 0.3 }));
  assert.equal(agreeing.disagree, false);
  const unanswered = two.summarize(new Map());
  assert.equal(unanswered.disagree, false);
});

test("decide's next step names an exact tie in one order, not a leader disagreement, when both orders favour the same option", async () => {
  const options = [{ name: "a", text: "A" }, { name: "b", text: "B" }];
  const answer: Answerer = (r) => ({ best: { type: "choice", choice: labels(r)[0], confidence: 0.5, probabilities: labels(r)[0] === "a" ? { a: 0.45, b: 0.45 } : { b: 0.3, a: 0.6 } } });
  const { out } = await decideWith(answer, { decision: "d", options });
  assert.equal(out["verdict"], "tie");
  assert.equal(out["order_disagrees"], true);
  assert.match(String(out["next_step"]), /exact tie at the top/);
  assert.doesNotMatch(String(out["next_step"]), /different leaders/);
  const best = (probabilities: Record<string, number>): Readonly<Record<string, Answer>> => ({ best: { type: "choice", choice: "", confidence: 0.5, probabilities } as Answer });
  const plan = planDecide(loadPack("generic", packDirs({})), undefined, { decision: "x" }, options);
  const split = plan.summarize(new Map([["written", best({ a: 0.6, b: 0.4 })], ["reversed", best({ b: 0.7, a: 0.3 })]]));
  assert.deepEqual([split.disagree, split.tied], [true, false]);
});
