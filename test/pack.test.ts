// Packs and project files: lookup, extends, validation, threshold tightening and areas.

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { RefereeError } from "../src/engine/errors.ts";
import { bundledPackDirs, listPacks, loadPack, packDirs, threshold } from "../src/engine/pack.ts";
import { areaFor, loadProject } from "../src/engine/project.ts";
import { tempDir } from "./helpers.ts";

const bundled = packDirs({}).filter((d) => d.source === "bundled");

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

test("pack generic ships with the plugin and loads", () => {
  assert.ok(bundledPackDirs().length > 0);
  const pack = loadPack("generic", bundled);
  assert.equal(pack.version, "0.1.0");
  assert.equal(pack.model, "jev-1.13.0");
  for (const id of ["done.met", "verify.relation", "verify.injection", "decide.best", "decide.fit", "line.risky", "failure.env"]) {
    assert.ok(pack.questions[id], id);
    assert.ok(pack.thresholds[id], `threshold ${id}`);
  }
  assert.ok(pack.cheatsheet["session"]?.includes("{{cli}}"));
  assert.match(pack.hash, /^[0-9a-f]{12}$/);
});

test("pack extends a parent and overrides its questions", () => {
  const root = tempDir();
  writeJson(join(root, "team/pack.json"), { name: "team", version: "1.2.0", extends: "generic" });
  writeJson(join(root, "team/questions/extra.json"), { "team.rule": { type: "noul", instructions: "Does it follow the rule?" } });
  writeJson(join(root, "team/thresholds.json"), { "done.met": { met: 0.8, missing: 0.5 } });
  const pack = loadPack("team", [{ dir: root }, ...bundled]);
  assert.equal(pack.version, "1.2.0");
  assert.ok(pack.questions["team.rule"]);
  assert.ok(pack.questions["done.met"]);
  assert.equal(pack.thresholds["done.met"]?.["met"], 0.8);
  assert.equal(pack.redact?.replace?.[0]?.kind, "uuid");
});

test("pack names are validated and missing packs are reported", () => {
  assert.throws(() => loadPack("../etc", bundled), (e: unknown) => e instanceof RefereeError && e.code === "pack_not_found");
  assert.throws(() => loadPack("nope", bundled), (e: unknown) => e instanceof RefereeError && e.code === "pack_not_found");
  const root = tempDir();
  writeJson(join(root, "bad/pack.json"), { name: "bad" });
  writeJson(join(root, "bad/thresholds.json"), { q: { x: 2 } });
  assert.throws(() => loadPack("bad", [{ dir: root }]), (e: unknown) => e instanceof RefereeError && e.code === "bad_pack");
});

test("pack lookup prefers the setting, then the environment, then bundled packs", () => {
  const dirs = packDirs({ CLAUDE_PLUGIN_OPTION_PACKS_DIR: "/s", REFEREE_PACKS_DIR: "/e" });
  assert.deepEqual(dirs.slice(0, 2), [{ dir: "/s", source: "setting" }, { dir: "/e", source: "env" }]);
  assert.deepEqual(listPacks(bundled).map((p) => p.name), ["generic"]);
});

test("project thresholds can only get stricter", () => {
  const pack = loadPack("generic", bundled);
  assert.equal(threshold(pack, { "done.met": { met: 0.9 } }, "done.met", "met", 0.5), 0.9);
  assert.equal(threshold(pack, { "done.met": { met: 0.3 } }, "done.met", "met", 0.5), 0.7);
  assert.equal(threshold(pack, undefined, "unknown.q", "auto", 0.9), 0.9);
});

test("project file is found upward and merged with the local file", () => {
  const root = tempDir();
  writeJson(join(root, ".claude/referee.json"), {
    pack: "generic",
    api_key: "ignored",
    packs_dir: "/ignored",
    areas: [{ prefix: "web/", checks: ["npx vitest run"] }, { prefix: "", checks: ["make test"] }],
  });
  writeJson(join(root, ".claude/referee.local.json"), { hooks: { sessionStart: false, stopGate: "shadow" } });
  mkdirSync(join(root, "web/src"), { recursive: true });
  const project = loadProject(join(root, "web/src"));
  assert.ok(project);
  assert.equal(project.pack, "generic");
  assert.deepEqual(project.hooks, { sessionStart: false, stopGate: "shadow", preModelSwitch: false });
  assert.ok(!("api_key" in project) && !("packs_dir" in project));
  assert.deepEqual(areaFor(project.areas, project.root, join(root, "web/src"))?.checks, ["npx vitest run"]);
  assert.deepEqual(areaFor(project.areas, project.root, root)?.checks, ["make test"]);
});

test("project absent means null, broken means bad_project", () => {
  assert.equal(loadProject(tempDir()), null);
  const root = tempDir();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude/referee.json"), "{not json");
  assert.throws(() => loadProject(root), (e: unknown) => e instanceof RefereeError && e.code === "bad_project");
  writeFileSync(join(root, ".claude/referee.json"), "{}");
  assert.throws(() => loadProject(root), (e: unknown) => e instanceof RefereeError && e.code === "bad_project");
});
