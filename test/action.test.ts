// Tests for action.yml and action/run.sh: the shell logic runs against a stub CLI, the YAML is parsed with ruby or yq when present.
// Covers the no-key (fork PR) skip, exit-code mapping, claim extraction from a real git diff and the example workflow in the docs.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { posixTest as test } from "./posix-test.ts";
import { tempDir } from "./helpers.ts";

const root = new URL("..", import.meta.url).pathname;
const SECRET = ["tsk", "-", "not-a-real-key-", "0123456789"].join("");

const STUB = `
const fs = require("node:fs");
const [cmd, ...args] = process.argv.slice(2);
const dir = process.env.STUB_DIR;
const get = (flag) => args[args.indexOf(flag) + 1];
fs.appendFileSync(dir + "/calls.log", JSON.stringify({ cmd, args, key: process.env.TYPESAFE_API_KEY ?? null, plugin: process.env.CLAUDE_PLUGIN_OPTION_API_KEY ?? null, eval: process.env.EVAL_TYPESAFE_API_KEY ?? null, data: process.env.REFEREE_DATA_DIR ?? null }) + "\\n");
if (cmd === "claims") {
  fs.copyFileSync(get("--claims"), dir + "/claims.txt");
  fs.copyFileSync(get("--source"), dir + "/source.txt");
}
if (cmd === "receipts") { fs.writeFileSync(get("--out"), '{"id":"r1"}\\n'); process.stdout.write('{"ok":true,"verdict":"exported"}\\n'); process.exit(0); }
const verdict = process.env["STUB_" + cmd.toUpperCase() + "_VERDICT"] ?? "met";
process.stdout.write(JSON.stringify({ ok: true, verdict }) + "\\n");
process.exit(Number(process.env["STUB_" + cmd.toUpperCase() + "_EXIT"] ?? 0));
`;

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly dir: string;
  readonly outDir: string;
  readonly outputs: string;
  readonly calls: { cmd: string; args: string[]; key: string | null; plugin: string | null; eval: string | null; data: string | null }[];
}

function runAction(env: Record<string, string>, cwd?: string): Run {
  const dir = tempDir("referee-action-");
  const outDir = join(dir, "receipts");
  const stub = join(dir, "stub.cjs");
  writeFileSync(stub, STUB);
  const outputs = join(dir, "output.txt");
  writeFileSync(outputs, "");
  const res = spawnSync("bash", [join(root, "action/run.sh")], {
    cwd: cwd ?? dir,
    encoding: "utf8",
    env: { PATH: process.env["PATH"] ?? "", HOME: dir, REFEREE_CLI: `node ${stub}`, STUB_DIR: dir, OUT_DIR: outDir, GITHUB_OUTPUT: outputs, ...env },
  });
  const log = join(dir, "calls.log");
  const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, dir, outDir, outputs: readFileSync(outputs, "utf8"), calls };
}

function git(cwd: string, ...args: string[]): string {
  const res = spawnSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout.trim();
}

function logFile(text = "Tests 3 passed\nexit code: 0\n"): string {
  const path = join(tempDir("referee-log-"), "test.log");
  writeFileSync(path, text);
  return path;
}

test("no key (fork pull request): exits 0, sends nothing, reports skipped", () => {
  const run = runAction({ TYPESAFE_API_KEY: "", IN_LOG: logFile(), EVAL_TYPESAFE_API_KEY: SECRET, TYPESAFE_API_KEY_CMD: "echo nope" });
  assert.equal(run.status, 0);
  assert.equal(run.calls.length, 0);
  assert.match(run.stdout, /::notice title=claude-referee skipped::No TypeSafe API key/);
  assert.match(run.outputs, /skipped=true/);
  assert.ok(!(run.stdout + run.stderr).includes(SECRET));
});

test("key unset entirely behaves like an empty secret", () => {
  const run = runAction({ IN_LOG: logFile() });
  assert.equal(run.status, 0);
  assert.equal(run.calls.length, 0);
});

test("done runs with criteria, evidence and fail-on; the key reaches the CLI only as TYPESAFE_API_KEY", () => {
  const log = logFile();
  const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_LOG: log, IN_CRITERIA: "all tests pass\n\ntypecheck passes\n", IN_FAIL_ON: "missing,unsure", EVAL_TYPESAFE_API_KEY: "other", TYPESAFE_API_KEY_CMD: "echo x" });
  assert.equal(run.status, 0);
  const done = run.calls.find((c) => c.cmd === "done");
  assert.ok(done);
  assert.deepEqual(done.args, ["--criteria", "all tests pass", "--criteria", "typecheck passes", "--evidence", log, "--fail-on", "missing,unsure"]);
  assert.equal(done.key, SECRET);
  assert.equal(done.eval, null);
  assert.match(run.outputs, /skipped=false/);
  assert.match(run.outputs, /done-verdict=met/);
  assert.ok(!(run.stdout + run.stderr).includes(SECRET));
  assert.ok(!readFileSync(join(run.outDir, "results.jsonl"), "utf8").includes(SECRET));
  assert.equal(readFileSync(join(run.outDir, "receipts.jsonl"), "utf8"), '{"id":"r1"}\n');
  const receipts = run.calls.find((c) => c.cmd === "receipts");
  assert.ok(receipts?.data && !receipts.data.startsWith(run.outDir), "cache and data dir stay out of the uploaded directory");
});

test("exit 3 from --fail-on fails the step; a CLI error only warns unless on-error is fail", () => {
  const gate = runAction({ TYPESAFE_API_KEY: SECRET, IN_LOG: logFile(), STUB_DONE_EXIT: "3", STUB_DONE_VERDICT: "missing" });
  assert.equal(gate.status, 3);
  assert.match(gate.stdout, /::error title=claude-referee done::verdict missing/);
  assert.ok(existsSync(join(gate.outDir, "receipts.jsonl")), "receipts are still exported when the gate fails");
  const soft = runAction({ TYPESAFE_API_KEY: SECRET, IN_LOG: logFile(), STUB_DONE_EXIT: "1" });
  assert.equal(soft.status, 0);
  assert.match(soft.stdout, /::warning title=claude-referee done::CLI error \(exit 1\)/);
  const hard = runAction({ TYPESAFE_API_KEY: SECRET, IN_LOG: logFile(), STUB_DONE_EXIT: "1", IN_ON_ERROR: "fail" });
  assert.equal(hard.status, 1);
});

test("missing or empty log skips done without failing", () => {
  const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_LOG: "/nonexistent/test.log" });
  assert.equal(run.status, 0);
  assert.ok(!run.calls.some((c) => c.cmd === "done"));
  assert.match(run.stdout, /done skipped/);
});

test("claims: added doc lines are checked against the changed non-markdown files", () => {
  const repo = tempDir("referee-repo-");
  git(repo, "init", "-q", "-b", "main");
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "README.md"), "# Title\n\nOld sentence that stays the same here.\n");
  writeFileSync(join(repo, "src/a.ts"), "export const a = 1;\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "README.md"), "# Title\n\nOld sentence that stays the same here.\n\n## New\n\n- The retry limit is 5 attempts per request.\n1. short\nPlain added sentence about the cache expiry.\n");
  writeFileSync(join(repo, "src/a.ts"), "export const a = 1;\nexport const RETRY_LIMIT = 5;\n");
  writeFileSync(join(repo, "package-lock.json"), '{"lockfile":true}\n');
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "head");
  const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_BASE_SHA: base, IN_CLAIMS_FAIL_ON: "unsupported", STUB_CLAIMS_VERDICT: "supported" }, repo);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const claims = run.calls.find((c) => c.cmd === "claims");
  assert.ok(claims);
  assert.deepEqual(claims.args.filter((a, i) => claims.args[i - 1] === "--fail-on"), ["unsupported"]);
  assert.equal(readFileSync(join(run.dir, "claims.txt"), "utf8"), '{"text":"The retry limit is 5 attempts per request."}\n{"text":"Plain added sentence about the cache expiry."}\n');
  const source = readFileSync(join(run.dir, "source.txt"), "utf8");
  assert.match(source, /=== src\/a\.ts ===/);
  assert.match(source, /RETRY_LIMIT = 5/);
  assert.ok(!source.includes("README") && !source.includes("lockfile"));
  assert.match(run.outputs, /claims-verdict=supported/);
});

test("claims default source keeps files that merely contain 'lock' and drops lockfiles and sensitive files", () => {
  const repo = tempDir("referee-repo-");
  git(repo, "init", "-q", "-b", "main");
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "README.md"), "# Title\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "README.md"), "# Title\n\n- The block cache expires after ten seconds.\n");
  const kept = { "src/block.ts": "BLOCK_MARK", "src/clock.ts": "CLOCK_MARK", "src/Dockerfile.lockdown": "LOCKDOWN_MARK" };
  const dropped = { ".env": "ENV_MARK", "config/.env.production": "ENVPROD_MARK", "certs/server.pem": "PEM_MARK", "deploy.key": "KEY_MARK", "src/secrets.json": "SECRETS_MARK", "aws-credentials.txt": "CRED_MARK", "yarn.lock": "YARN_MARK", "Cargo.lock": "CARGO_MARK", "package-lock.json": "NPMLOCK_MARK", "id_rsa": "RSA_MARK" };
  for (const [f, v] of Object.entries({ ...kept, ...dropped })) {
    mkdirSync(dirname(join(repo, f)), { recursive: true });
    writeFileSync(join(repo, f), v + "\n");
  }
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "head");
  const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_BASE_SHA: base, STUB_CLAIMS_VERDICT: "supported" }, repo);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const source = readFileSync(join(run.dir, "source.txt"), "utf8");
  for (const v of Object.values(kept)) assert.ok(source.includes(v), v);
  for (const v of Object.values(dropped)) assert.ok(!source.includes(v), v);
});

test("claims: added doc lines that look like JSON or start with a link reach the real CLI as plain claims", () => {
  const wrap = join(tempDir("referee-wrap-"), "wrap.cjs");
  const main = join(root, "src/cli/main.ts");
  writeFileSync(wrap, `const { spawnSync } = require("node:child_process");
const env = { ...process.env };
delete env.TYPESAFE_API_KEY;
const r = spawnSync(process.execPath, [${JSON.stringify(main)}, ...process.argv.slice(2), "--dry-run"], { env, encoding: "utf8" });
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);
`);
  const added = {
    link: "- [Configuration](docs/configuration.md) explains the four settings layers.\n",
    quotedLink: '- ["Quick start"](docs/start.md) explains how to install the CLI.\n',
    placeholder: "[{name}] placeholders are replaced by the layer name.\n",
    jsonSamples: '```json\n{"id": "a", "text": "first sample object in the docs"}\n{"id": "a", "text": "second sample object with the same id"}\n```\n',
    jsObject: "```js\n{ layers: 4, name: 'the four settings layers' }\n```\n",
  };
  for (const [name, lines] of Object.entries(added)) {
    const repo = tempDir("referee-repo-");
    git(repo, "init", "-q", "-b", "main");
    mkdirSync(join(repo, "src"));
    writeFileSync(join(repo, "README.md"), "# Title\n");
    writeFileSync(join(repo, "src/a.ts"), "export const a = 1;\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "base");
    const base = git(repo, "rev-parse", "HEAD");
    writeFileSync(join(repo, "README.md"), `# Title\n\n${lines}`);
    writeFileSync(join(repo, "src/a.ts"), "export const LAYERS = 4;\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "head");
    const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_BASE_SHA: base, REFEREE_CLI: `node ${wrap}` }, repo);
    assert.equal(run.status, 0, name + run.stdout + run.stderr);
    assert.doesNotMatch(run.stdout, /claude-referee claims::CLI error/, name);
    assert.match(run.outputs, /claims-verdict=would_send/, name);
    assert.ok(!(run.stdout + run.stderr).includes(SECRET));
  }
});

test("an explicit claims-source is used as given", () => {
  const repo = tempDir("referee-repo-");
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "README.md"), "# Title\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "README.md"), "# Title\n\n- The block cache expires after ten seconds.\n");
  writeFileSync(join(repo, "notes.txt"), "EXPLICIT_MARK\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "head");
  const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_BASE_SHA: base, IN_SOURCE: "notes.txt" }, repo);
  assert.match(readFileSync(join(run.dir, "source.txt"), "utf8"), /EXPLICIT_MARK/);
});

test("CLAUDE_PLUGIN_OPTION_API_KEY in the runner environment does not override the input key", () => {
  const run = runAction({ TYPESAFE_API_KEY: SECRET, IN_LOG: logFile(), CLAUDE_PLUGIN_OPTION_API_KEY: "other-key" });
  assert.equal(run.status, 0);
  const done = run.calls.find((c) => c.cmd === "done");
  assert.ok(done);
  assert.equal(done.key, SECRET);
  assert.equal(done.plugin, null);
});

test("claims skip with a notice when no pull request base is given", () => {
  const run = runAction({ TYPESAFE_API_KEY: SECRET });
  assert.equal(run.status, 0);
  assert.ok(!run.calls.some((c) => c.cmd === "claims"));
  assert.match(run.stdout, /claims skipped/);
});

function parseYaml(file: string): unknown | undefined {
  const ruby = spawnSync("ruby", ["-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: false))", file], { encoding: "utf8" });
  if (ruby.status === 0) return JSON.parse(ruby.stdout);
  const yq = spawnSync("yq", ["-o=json", ".", file], { encoding: "utf8" });
  if (yq.status === 0) return JSON.parse(yq.stdout);
  return undefined;
}

test("action.yml parses and is a composite action with the documented inputs", (t) => {
  const doc = parseYaml(join(root, "action.yml")) as { runs: { using: string; steps: Record<string, unknown>[] }; inputs: Record<string, { default?: string }>; outputs: Record<string, unknown> } | undefined;
  if (!doc) return t.skip("neither ruby nor yq is available");
  assert.equal(doc.runs.using, "composite");
  for (const name of ["typesafe-api-key", "log-file", "criteria", "fail-on", "docs", "claims-source", "claims-fail-on", "base-sha", "on-error", "artifact-name"]) assert.ok(doc.inputs[name], name);
  assert.equal(doc.inputs["typesafe-api-key"]?.default, "");
  assert.deepEqual(Object.keys(doc.outputs).sort(), ["claims-verdict", "done-verdict", "skipped"]);
  const upload = doc.runs.steps.find((s) => String(s["uses"]).startsWith("actions/upload-artifact@"));
  assert.ok(upload);
  assert.equal(upload["if"], "always()");
  assert.ok(doc.runs.steps.filter((s) => "run" in s).every((s) => s["shell"] === "bash"));
});

test("action.yml never interpolates inputs into shell text and reads no secrets itself", () => {
  const text = readFileSync(join(root, "action.yml"), "utf8");
  const runLines = text.split("\n").filter((l) => /^\s+run:/.test(l));
  assert.ok(runLines.length > 0);
  for (const line of runLines) assert.ok(!line.includes("${{"), line);
  assert.ok(!text.includes("secrets."));
  assert.ok(!/pull_request_target/.test(text));
});

test("the example workflow in docs/recipes/github-action.md parses and follows the fork-safety rules", (t) => {
  const doc = readFileSync(join(root, "docs/recipes/github-action.md"), "utf8");
  const block = /```yaml\n(# example-workflow[\s\S]*?)```/.exec(doc);
  assert.ok(block, "the doc has a yaml block that starts with # example-workflow");
  const dir = tempDir("referee-wf-");
  const file = join(dir, "wf.yml");
  writeFileSync(file, block[1] ?? "");
  const parsed = parseYaml(file) as (Record<string, unknown> & { permissions: Record<string, string> }) | undefined;
  if (parsed) {
    const triggers = (parsed["on"] ?? parsed["true"]) as Record<string, unknown>;
    assert.ok("pull_request" in triggers);
    assert.ok(!("pull_request_target" in triggers));
    assert.deepEqual(parsed.permissions, { contents: "read" });
  } else t.diagnostic("no yaml parser; text checks only");
  assert.ok(!/pull_request_target/.test((block[1] ?? "").replace(/^#.*$/gm, "")));
  assert.match(block[1] ?? "", /typesafe-api-key: \$\{\{ secrets\.TYPESAFE_API_KEY \}\}/);
});
