// detectChecks and the briefing: script names only, nearest manifest, at most 4, byte-stable, silent on bad files.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { detectChecks } from "../src/engine/detect-checks.ts";
import { BRIEFING_LIMIT, sessionStart } from "../src/hooks/session-start.ts";
import { tempDir } from "./helpers.ts";

const pluginRoot = fileURLToPath(new URL("../plugins/claude-referee", import.meta.url));

function repo(files: Record<string, string | object>, config: object = { pack: "generic" }): string {
  const root = tempDir();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude/referee.json"), JSON.stringify(config));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), typeof body === "string" ? body : JSON.stringify(body));
  }
  return root;
}

async function briefing(cwd: string, plugin = pluginRoot): Promise<string> {
  const io = { env: {}, home: tempDir("referee-home-"), now: () => Date.parse("2026-10-09T12:00:00Z"), readStdin: async () => JSON.stringify({ cwd, session_id: "t" }) };
  const out = await sessionStart({ ...io, env: { REFEREE_DATA_DIR: join(io.home, "data") } }, plugin);
  return (JSON.parse(out ?? "{}") as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
}

test("package.json scripts are listed in family order with the lockfile's runner", () => {
  const scripts = { build: "x", lint: "x", test: "x", dev: "x" };
  assert.deepEqual(detectChecks(repo({ "package.json": { scripts } }), "/"), ["npm run test", "npm run lint", "npm run build"]);
  const pnpm = repo({ "package.json": { scripts }, "pnpm-lock.yaml": "" });
  assert.deepEqual(detectChecks(pnpm, pnpm), ["pnpm run test", "pnpm run lint", "pnpm run build"]);
});

test("composer scripts and artisan give composer and php artisan test", () => {
  assert.deepEqual(detectChecks(repo({ "composer.json": { scripts: { test: "x", lint: "x" } } }), "/"), ["composer test", "composer lint"]);
  const laravel = repo({ artisan: "", "composer.json": { require: { "laravel/framework": "^12" } }, "package.json": { scripts: { build: "x" } } });
  assert.deepEqual(detectChecks(laravel, laravel), ["php artisan test", "npm run build"]);
});

test("cargo and go manifests give their test command", () => {
  assert.deepEqual(detectChecks(repo({ "Cargo.toml": "" }), "/"), ["cargo test"]);
  assert.deepEqual(detectChecks(repo({ "go.mod": "" }), "/"), ["go test ./..."]);
});

test("one command per family, at most 4, suffixed scripts only when the plain name is missing", () => {
  const scripts = { "test:unit": "x", "test:e2e": "x", typecheck: "x", lint: "x", check: "x", build: "x", ci: "x" };
  assert.deepEqual(detectChecks(repo({ "package.json": { scripts } }), "/"), ["npm run test:e2e", "npm run typecheck", "npm run lint", "npm run check"]);
});

test("no manifest, no matching scripts or an unparsable package.json give nothing and do not throw", () => {
  assert.deepEqual(detectChecks(repo({}), "/"), []);
  assert.deepEqual(detectChecks(repo({ "package.json": { scripts: { dev: "x" } } }), "/"), []);
  assert.deepEqual(detectChecks(repo({ "package.json": "{ not json" }), "/"), []);
  assert.deepEqual(detectChecks(repo({ "package.json": '{"scripts": ["test"]}' }), "/"), []);
});

test("the nearest manifest from the working directory wins", () => {
  const root = repo({ "package.json": { scripts: { test: "x" } }, "web/package.json": { scripts: { lint: "x" } } });
  assert.deepEqual(detectChecks(join(root, "web"), root), ["npm run lint"]);
  assert.deepEqual(detectChecks(join(root, "web/deeper"), root), ["npm run lint"]);
});

test("the briefing says detected, is byte-stable and keeps explicit area checks untouched", async () => {
  const root = repo({ "package.json": { scripts: { test: "x", build: "x" } } });
  const text = await briefing(root);
  assert.ok(text.includes("Checks here: npm run test; npm run build (detected)."));
  assert.equal(text, await briefing(root));
  const explicit = repo({ "package.json": { scripts: { test: "x" } } }, { pack: "generic", areas: [{ prefix: "", checks: ["make verify"] }] });
  const explicitText = await briefing(explicit);
  assert.ok(explicitText.includes("Checks here: make verify.") && !explicitText.includes("detected"));
  assert.ok((await briefing(repo({}))).includes("Checks here: none listed in .claude/referee.json."));
});

test("the briefing with long detected checks and a long plugin path stays within the 800 limit and keeps its last line", async () => {
  const installed = "/Users/averageusername/.claude/plugins/cache/claude-referee/claude-referee/0.1.1";
  const root = repo({ "package.json": { scripts: { "test:integration": "x", typecheck: "x", lint: "x", check: "x" } }, "pnpm-lock.yaml": "" });
  const text = await briefing(root, installed);
  assert.ok(text.length <= BRIEFING_LIMIT, String(text.length));
  assert.ok(text.includes("pnpm run test:integration; pnpm run typecheck; pnpm run lint; pnpm run check (detected)."));
  assert.ok(text.endsWith("narrow the question."));
});
