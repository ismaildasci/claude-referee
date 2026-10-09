// The canary install check: pure assessment plus the full runner against a fake claude binary (pass, refused install, wrong version, no binary).

import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { posixTest as test } from "./posix-test.ts";
import { assessInstall, runCanary } from "../scripts/canary-install.mjs";

const repo = resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(join(repo, "plugins", "claude-referee", ".claude-plugin", "plugin.json"), "utf8")).version as string;
const entry = { id: "claude-referee@claude-referee", enabled: true, version, installPath: "/x" };

test("assessInstall accepts a matching, enabled install", () => {
  assert.deepEqual(assessInstall({ list: [entry], expectedVersion: version, cliOut: `${version}\n` }), []);
});

test("assessInstall flags missing, disabled, wrong version and wrong CLI output", () => {
  assert.equal(assessInstall({ list: [], expectedVersion: version, cliOut: version }).length, 1);
  assert.equal(assessInstall({ list: "nope", expectedVersion: version, cliOut: version }).length, 1);
  assert.equal(assessInstall({ list: [{ ...entry, enabled: false }], expectedVersion: version, cliOut: version }).length, 1);
  assert.equal(assessInstall({ list: [{ ...entry, version: "0.0.1" }], expectedVersion: version, cliOut: version }).length, 1);
  assert.equal(assessInstall({ list: [entry], expectedVersion: version, cliOut: "boom" }).length, 1);
  assert.equal(assessInstall({ list: [entry], expectedVersion: version, cliOut: "" }).length, 1);
});

function fakeClaude(): string {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  const plugin = join(dir, "plugin");
  mkdirSync(join(plugin, "dist"), { recursive: true });
  writeFileSync(join(plugin, "dist", "cli.mjs"), `console.log(process.env.FAKE_CLI_VERSION ?? ${JSON.stringify(version)});\n`);
  const bin = join(dir, "claude");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2).join(" ");
const mode = process.env.FAKE_MODE ?? "ok";
if (a === "--version") console.log("9.9.9 (Claude Code)");
else if (a.startsWith("plugin marketplace add")) process.exit(0);
else if (a.startsWith("plugin install")) { if (mode === "refuse") { console.error("name is reserved"); process.exit(1); } }
else if (a === "plugin list --json") console.log(JSON.stringify([{ id: "claude-referee@claude-referee", enabled: true, version: ${JSON.stringify(version)}, installPath: ${JSON.stringify(plugin)} }]));
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}

test("runCanary passes against a healthy fake claude and records its version", () => {
  const res = runCanary({ repo, claude: fakeClaude() });
  assert.deepEqual(res.problems, []);
  assert.equal(res.status, "pass");
  assert.equal(res.claudeVersion, "9.9.9 (Claude Code)");
});

test("runCanary fails when the install is refused", () => {
  process.env.FAKE_MODE = "refuse";
  try {
    const res = runCanary({ repo, claude: fakeClaude() });
    assert.equal(res.status, "fail");
    assert.match(res.problems[0] ?? "", /install failed: name is reserved/);
  } finally {
    delete process.env.FAKE_MODE;
  }
});

test("runCanary fails when the installed CLI prints another version", () => {
  process.env.FAKE_CLI_VERSION = "0.0.1";
  try {
    const res = runCanary({ repo, claude: fakeClaude() });
    assert.equal(res.status, "fail");
    assert.match(res.problems.join("\n"), /installed CLI printed "0.0.1"/);
  } finally {
    delete process.env.FAKE_CLI_VERSION;
  }
});

test("runCanary skips when no claude binary exists", () => {
  assert.equal(runCanary({ repo, claude: "/nonexistent/claude-binary" }).status, "skip");
});
