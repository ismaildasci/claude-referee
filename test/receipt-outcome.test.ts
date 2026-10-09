// Receipt outcome fields per command kind (numbers and fixed codes only, never user text), zero-request error receipts
// for Jev commands that fail after their input is read, and readers that count verify (the old name) as claims.

import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commands } from "../src/cli/commands/index.ts";
import { run } from "../src/cli/run.ts";
import { projectId } from "../src/engine/datadir.ts";
import { appendReceipt, outcomeOf, readReceipts, type Receipt } from "../src/engine/receipts.ts";
import { scanUsage } from "../src/engine/usage.ts";
import { flow, overview } from "../src/ui/api.ts";
import { defaultAnswer, fakeJev, type FakeRequest } from "./fake-jev.ts";
import { memoryIo, tempDir } from "./helpers.ts";

const MARK = "QZX";
const REPO = new URL("..", import.meta.url).pathname;

function receiptLines(dataDir: string): string[] {
  const root = join(dataDir, "receipts");
  return readdirSync(root)
    .sort()
    .flatMap((p) => readdirSync(join(root, p)).sort().flatMap((f) => readFileSync(join(root, p, f), "utf8").split("\n")))
    .filter((l) => l.trim());
}

const choice = (p: Record<string, number>) => ({ type: "choice", choice: Object.keys(p)[0], confidence: 0.9, probabilities: p });
const relation = (supports: number, contradicts: number, saysNothing: number) => choice({ supports, contradicts, says_nothing: saysNothing });

function answer(request: FakeRequest): Record<string, unknown> {
  const out = defaultAnswer(request);
  const item = JSON.stringify(request.state);
  for (const [id, q] of Object.entries(request.questions)) {
    if (id === "best") out[id] = choice(Object.fromEntries(Object.keys(q.criteria as object).map((name) => [name, name.includes("Alpha") ? 0.8 : 0.2])));
    if (id === "injection") out[id] = { type: "noul", noul: 0.01 };
    if (id === "line.risky") out[id] = { type: "noul", noul: item.includes("YES") ? 0.99 : item.includes("NOPE") ? 0.01 : 0.5 };
    if (id.startsWith("claim:")) out[id] = id.includes("Con") ? relation(0.05, 0.9, 0.05) : id.includes("Mid") ? relation(0.5, 0.3, 0.2) : relation(0.95, 0.03, 0.02);
  }
  return out;
}

test("each Jev command records its outcome as numbers and fixed codes, never the user's text", async () => {
  const server = await fakeJev(answer);
  const dataDir = tempDir();
  const cwd = tempDir(`referee-${MARK}-cwd-`);
  const env = { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: dataDir };
  const inputs = join(cwd, `${MARK}dir`);
  mkdirSync(inputs);
  writeFileSync(join(inputs, "context.md"), `${MARK}FileBody: the team ships on Fridays.\n`);
  writeFileSync(join(inputs, "source.md"), `${MARK}Source. The service handles 120 requests per second. The sky is blue.\n`);
  writeFileSync(
    join(inputs, "claims.json"),
    JSON.stringify([
      { id: `${MARK}IdSup`, text: `${MARK}ClaimSup the sky is blue` },
      { id: `${MARK}IdCon`, text: `${MARK}ClaimCon the sky is green` },
      { id: `${MARK}IdMid`, text: `${MARK}ClaimMid the service is fast` },
      { id: `${MARK}IdNum`, text: `${MARK}ClaimNum it handles 999 requests` },
    ]),
  );
  writeFileSync(
    join(inputs, "items.jsonl"),
    [`${MARK}TextYES rm -rf /`, `${MARK}TextNOPE echo hi`, `${MARK}TextMID make build`].map((text, i) => JSON.stringify({ id: `${MARK}Item${i}`, text })).join("\n") + "\n",
  );
  const decision = JSON.stringify({
    decision: `${MARK}Decision: which queue?`,
    context: `${MARK}Context`,
    context_files: [`${MARK}dir/context.md`],
    options: [
      { name: `${MARK}Alpha`, text: `${MARK}TextAlpha: a durable queue` },
      { name: `${MARK}Beta`, text: `${MARK}TextBeta: an in-memory list` },
    ],
  });
  const calls: [string[], string][] = [
    [["done", "--criteria", `${MARK}Criterion all tests pass`], "Tests: 12 passed, 12 total\nexit code: 0\n"],
    [["done", "--criteria", `${MARK}Criterion all tests pass`], `${MARK}Log failed\nexit code: 2\n`],
    [["decide"], decision],
    [["judge", "--question", "line.risky", "--items", `${MARK}dir/items.jsonl`, "--context", `${MARK}SharedContext`], ""],
    [["claims", "--source", `${MARK}dir/source.md`, "--claims", `${MARK}dir/claims.json`], ""],
    [["verify", "--source", `${MARK}dir/source.md`, "--claim", `${MARK}ClaimAlias the sky is blue`], ""],
  ];
  try {
    for (const [argv, stdin] of calls) {
      const io = memoryIo({ env, cwd, stdin });
      assert.equal(await run(argv, io, commands), 0, io.out.join(""));
    }
  } finally {
    await server.close();
  }
  const lines = receiptLines(dataDir);
  assert.equal(lines.length, calls.length);
  for (const line of lines) {
    assert.ok(!line.includes(MARK), `user text in a receipt: ${line}`);
    assert.ok(!line.includes("/") && !line.includes(cwd), `a path in a receipt: ${line}`);
  }
  const receipts = lines.map((l) => JSON.parse(l) as Receipt);
  const fields = receipts.map((r) => ({ command: r.command, verdict: r.verdict, reason: r.reason, outcome: r.outcome }));
  assert.deepEqual(fields, [
    { command: "done", verdict: "met", reason: undefined, outcome: { trust: "parsed", p: 0.9, exit_code: 0, evidence_lines: 3, runners: ["jest"] } },
    { command: "done", verdict: "missing", reason: "exit_code_nonzero", outcome: { trust: "exit_code", p: 0, exit_code: 2, evidence_lines: 3 } },
    { command: "decide", verdict: "weak", reason: undefined, outcome: { lean_p: 0.8, margin: 0.6, orders: 2 } },
    { command: "judge", verdict: "flagged", reason: undefined, outcome: { items: 3, yes: 1, no: 1, review: 1 } },
    {
      command: "claims",
      verdict: "unsupported",
      reason: undefined,
      outcome: { claims: 4, supported: 1, unsupported: 1, contradicted: 1, says_nothing: 0, unsure: 2, unanswered: 0, reasons: { between_bands: 1, contradicted: 1, number_not_in_source: 1 } },
    },
    { command: "claims", verdict: "supported", reason: undefined, outcome: { claims: 1, supported: 1, unsupported: 0, contradicted: 0, says_nothing: 0, unsure: 0, unanswered: 0 } },
  ]);
  assert.deepEqual(receipts.map((r) => r.requests), [1, 0, 2, 3, 1, 1]);

  const verify = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  await run(["receipts", "verify"], verify, commands);
  assert.deepEqual(verify.json()["chain"], { receipts: 6, chained: 5, unchained: 1, breaks: [] });
});

test("outcomeOf copies only allowlisted numbers and codes, and caps its lists", () => {
  assert.equal(outcomeOf({ ok: true, verdict: "clear" }), undefined);
  assert.deepEqual(outcomeOf({ verdict: "weak", lean: "Secret-name", p: { "Secret-name": 0.71234567, other: 0.2, third: 0.1 }, orders: 6, read: [{ path: "a/b.md", bytes: 3 }], flags: [{ option: "Secret-name", rule: "m1", p: 0.9 }] }), { lean_p: 0.7123, margin: 0.5123, orders: 6 });
  assert.deepEqual(outcomeOf({ trust: "made-up", p: Number.NaN, exit_code: 1.5, runners: [{ runner: "jest" }, { runner: "jest" }, { runner: "../evil path" }, "tsc", ...Array.from({ length: 12 }, (_, i) => ({ runner: `r${i}` }))] }), { runners: ["jest", "r0", "r1", "r2", "r3", "r4", "r5", "r6"] });
  const reasons = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`claim-${i}`, i < 2 ? "Free text, not a code" : `code_${i % 15}`]));
  const claims = outcomeOf({ claims: 20, supported: 0, unsure: Array.from({ length: 20 }, (_, i) => `claim-${i}`), reasons, p: { "claim-1": 0.4 } });
  assert.equal(Object.keys(claims?.reasons ?? {}).length, 12);
  assert.ok(!JSON.stringify(claims).includes("claim-") && !JSON.stringify(claims).includes("Free"));
  assert.deepEqual({ ...claims, reasons: undefined }, { claims: 20, supported: 0, unsupported: 0, contradicted: 0, says_nothing: 0, unsure: 20, unanswered: 0, reasons: undefined });
  assert.deepEqual(outcomeOf({ items: 2, yes: 1, no: 0, review: 1, flagged: ["item-1"], review_ids: ["item-2"] }), { items: 2, yes: 1, no: 0, review: 1 });
});

test("a Jev command that fails after its input is read writes one zero-request receipt; the chain stays valid", async () => {
  const server = await fakeJev();
  const dataDir = tempDir();
  const cwd = tempDir();
  const evals = tempDir();
  const base = { REFEREE_DATA_DIR: dataDir, TYPESAFE_BASE_URL: server.url };
  const keyed = { ...base, REFEREE_BASE_URL_KEY: "ts_test" };
  mkdirSync(join(evals, "s1"));
  writeFileSync(join(evals, "s1", "suite.json"), JSON.stringify({ command: "done", criteria: "tests pass" }));
  writeFileSync(join(evals, "s1", "cases.jsonl"), JSON.stringify({ id: "c1", split: "dev", expected: "met", evidence: "Tests: 1 passed, 1 total\n" }) + "\n");
  const tooMany = join(cwd, "claims.txt");
  writeFileSync(tooMany, Array.from({ length: 101 }, (_, i) => `${MARK} claim ${i}`).join("\n") + "\n");
  const call = async (argv: string[], options: { stdin?: string; env?: Record<string, string> } = {}) => {
    const io = memoryIo({ env: options.env ?? keyed, cwd, stdin: options.stdin ?? "" });
    const code = await run(argv, io, commands);
    return { code, out: io.out.join("") };
  };
  const errorOf = (r: { out: string }) => (JSON.parse(r.out) as { error?: string }).error;
  try {
    const written: [string[], string, Record<string, string> | undefined, string][] = [
      [["done", "--criteria", `${MARK} tests pass`], "", undefined, "bad_input"],
      [["done", "stray", "--criteria", "tests pass", "--fresh"], "", undefined, "bad_input"],
      [["decide"], `{${MARK} not json`, undefined, "bad_input"],
      [["done", "--criteria", "tests pass", "--pack", `${MARK}NoSuchPack`], "PASS ok", undefined, "pack_not_found"],
      [["claims", "--source", "-", "--claims", "claims.txt"], "", undefined, "too_large"],
      [["done", "--criteria", "tests pass"], "PASS ok", base, "no_api_key"],
      [["done", "--criteria", "tests pass"], "PASS ok", { ...base, REFEREE_BASE_URL_KEY: "bad key" }, "invalid_api_key"],
      [["eval", "record", "--suite", `${MARK}nope`, "--evals-dir", evals], "", undefined, "bad_input"],
      [["eval", "record", "--suite", "s1", "--evals-dir", evals, "--max-requests", "0"], "", undefined, "bad_input"],
    ];
    for (const [argv, stdin, env, code] of written) {
      const r = await call(argv, { stdin, ...(env ? { env } : {}) });
      assert.deepEqual([r.code, errorOf(r)], [1, code], argv.join(" "));
    }
    const silent: [string[], string][] = [
      [["done"], ""],
      [["decide"], ""],
      [["done", "--describe"], ""],
      [["done", "--criteria", "x", "--bogus"], "PASS ok"],
      [["nope", "--criteria", "x"], "PASS ok"],
      [["--help"], ""],
      [["done", "--criteria", "x", "--dry-run"], ""],
      [["claims", "--claims", "claims.txt", "--source", "-", "--dry-run"], ""],
      [["receipts", "--days", "0"], ""],
      [["extract"], ""],
      [["done", "help"], ""],
      [["done", "help"], "PASS ok"],
      [["done", "foo"], ""],
      [["judge", "help"], ""],
      [["decide", "help"], ""],
      [["claims", "help"], ""],
      [["verify", "help"], ""],
      [["eval", "record"], ""],
      [["eval", "score", "--suite", `${MARK}nope`, "--evals-dir", evals], ""],
    ];
    for (const [argv, stdin] of silent) await call(argv, { stdin });
    const ok = await call(["done", "--criteria", "tests pass"], { stdin: "Tests: 1 passed, 1 total\n" });
    assert.equal(ok.code, 0);
  } finally {
    await server.close();
  }
  const lines = receiptLines(dataDir);
  for (const line of lines) assert.ok(!line.includes(MARK), line);
  const receipts = lines.map((l) => JSON.parse(l) as Receipt);
  assert.deepEqual(
    receipts.map((r) => [r.command, r.error ?? r.verdict, r.requests]),
    [["done", "bad_input", 0], ["done", "bad_input", 0], ["decide", "bad_input", 0], ["done", "pack_not_found", 0], ["claims", "too_large", 0], ["done", "no_api_key", 0], ["done", "invalid_api_key", 0], ["eval", "bad_input", 0], ["eval", "bad_input", 0], ["done", "met", 1]],
  );
  const [first, fresh] = receipts;
  assert.deepEqual(Object.keys(first ?? {}).sort(), ["command", "cost_usd", "cached", "error", "id", "input_tokens", "ms", "project", "requests", "ts", "worktree"].sort());
  assert.deepEqual(Object.keys(fresh ?? {}).sort(), ["command", "cost_usd", "cached", "error", "fresh", "id", "input_tokens", "ms", "prev", "project", "requests", "ts", "worktree"].sort());
  assert.equal(fresh?.fresh, true);
  assert.deepEqual({ cached: first?.cached, input_tokens: first?.input_tokens, cost_usd: first?.cost_usd, project: first?.project }, { cached: 0, input_tokens: 0, cost_usd: 0, project: projectId(cwd) });
  assert.deepEqual(receipts.map((r) => r.pack ?? null), [null, null, null, null, null, "generic", "generic", null, "generic", "generic"], "an error once the Session exists keeps its own receipt, not a second one");

  const verify = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  await run(["receipts", "verify", "--fail-on", "chain_broken"], verify, commands);
  assert.deepEqual(verify.json()["chain"], { receipts: 10, chained: 9, unchained: 1, breaks: [] });
  const summary = memoryIo({ env: { REFEREE_DATA_DIR: dataDir }, cwd });
  await run(["receipts"], summary, commands);
  assert.deepEqual(summary.json()["by_command"], { done: 6, decide: 1, claims: 1, eval: 2 });
});

test("readers count verify, the old name, as claims", async () => {
  const server = await fakeJev((r) => ({ ...answer(r), injection: { type: "noul", noul: 0.01 } }));
  const dataDir = tempDir();
  const cwd = tempDir();
  const env = { TYPESAFE_API_KEY: "ts_test", REFEREE_BASE_URL_KEY: "ts_test", TYPESAFE_BASE_URL: server.url, REFEREE_DATA_DIR: dataDir };
  const project = projectId(cwd);
  appendReceipt(dataDir, { id: "rOldVerify", ts: "2026-09-30T08:00:00.000Z", command: "verify", project, verdict: "supported", requests: 1, cached: 0, input_tokens: 100, cost_usd: 0.0000042, ms: 5 });
  try {
    for (const name of ["claims", "verify"]) {
      const io = memoryIo({ env, cwd, stdin: "The sky is blue." });
      assert.equal(await run([name, "--claim", `the sky is blue (${name})`], io, commands), 0);
    }
  } finally {
    await server.close();
  }
  assert.deepEqual(readReceipts(dataDir).map((r) => r.command), ["verify", "claims", "claims"]);

  const summary = memoryIo({ env, cwd });
  await run(["receipts"], summary, commands);
  assert.deepEqual(summary.json()["by_command"], { claims: 3 });
  const tokens = memoryIo({ env, cwd });
  await run(["receipts", "--tokens"], tokens, commands);
  assert.deepEqual((tokens.json()["rows"] as { command: string; runs: number }[]).map((r) => [r.command, r.runs]), [["claims", 3]]);

  const ctx = { dataDir, cwd, home: tempDir(), env: {}, now: () => Date.parse("2026-09-30T12:00:00Z") };
  assert.deepEqual(overview(ctx).receipts.by_command, { claims: 3 });
  const all = flow(ctx);
  assert.deepEqual(all.commands, ["claims"]);
  assert.deepEqual(all.events.map((e) => e.kind === "call" && e.command), ["claims", "claims", "claims"]);
  assert.equal(flow(ctx, { command: "claims" }).events.length, 3);
  assert.equal(flow(ctx, { command: "verify" }).command, "all");
  const newest = all.events[0];
  assert.equal(newest?.kind === "call" ? newest.outcome : null, "claims 1; supported 1; unsupported 0; contradicted 0; says_nothing 0; unsure 0; unanswered 0");

  const transcripts = tempDir();
  const use = (id: string, command: string) => JSON.stringify({ type: "assistant", timestamp: "2026-09-30T10:00:00.000Z", message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
  writeFileSync(join(transcripts, "s.jsonl"), [use("a", "claude-referee verify --claim x"), use("b", "claude-referee claims --claim y"), use("c", "claude-referee receipts verify")].join("\n") + "\n");
  assert.deepEqual(scanUsage([transcripts], "2026-09-01").rows.map((r) => [r.command, r.calls]), [["claims", 2], ["receipts", 1]]);
});

test("an eval suite whose command is claims scores like one named verify", async () => {
  const root = tempDir();
  const source = join(REPO, "jev-evals", "verify-v2");
  for (const [name, command] of [["as-verify", "verify"], ["as-claims", "claims"]] as const) {
    const dir = join(root, name);
    mkdirSync(dir);
    for (const file of ["cases.jsonl", "recorded.jsonl"]) writeFileSync(join(dir, file), readFileSync(join(source, file), "utf8").replaceAll('"suite":"verify-v2"', `"suite":"${name}"`));
    writeFileSync(join(dir, "suite.json"), JSON.stringify({ ...JSON.parse(readFileSync(join(source, "suite.json"), "utf8")), command }));
  }
  const score = async (suite: string) => {
    const io = memoryIo({ env: { REFEREE_DATA_DIR: tempDir() }, cwd: root });
    assert.equal(await run(["eval", "score", "--suite", suite, "--evals-dir", root], io, commands), 0, io.out.join(""));
    const { suite: _name, ...rest } = io.json();
    return rest;
  };
  const claims = await score("as-claims");
  assert.equal(typeof claims["cases"], "number");
  assert.deepEqual(claims, await score("as-verify"));
});
