// Session-study tasks: each starter fails its hidden verifier, the reference passes, the plausible wrong solution fails, and weak visible tests pass the wrong one.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { posixTest as test } from "./posix-test.ts";
import { KINDS, TASKS, manifest, validateTasks, verifierCommand, verifierExt, verifierSource, visibleCommand, type Task } from "../scripts/session-study/tasks.mjs";

const hasPython = spawnSync("python3", ["--version"]).status === 0;
const base = mkdtempSync(join(tmpdir(), "study-tasks-"));

function write(dir: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

function tree(task: Task, overlay: Record<string, string> | null): string {
  const dir = mkdtempSync(join(base, `${task.id}-`));
  write(dir, task.files);
  if (overlay) write(dir, overlay);
  return dir;
}

function verifierPath(task: Task): string {
  const path = join(base, `verify-${task.id}.${verifierExt(task)}`);
  writeFileSync(path, verifierSource(task));
  return path;
}

function verdict(task: Task, dir: string): number | null {
  const [cmd, args] = verifierCommand(task, verifierPath(task), dir);
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 20_000 }).status;
}

function visible(task: Task, dir: string): number | null {
  const found = visibleCommand(task);
  if (!found) return null;
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  return spawnSync(found[0], found[1], { cwd: dir, env, encoding: "utf8", timeout: 30_000 }).status;
}

test("the task set is well formed and the manifest is stable", () => {
  assert.deepEqual(validateTasks(), []);
  assert.equal(TASKS.length, 24);
  assert.equal(TASKS.filter((t) => t.lang === "node").length, 12);
  const counts = Object.fromEntries(KINDS.map((k) => [k, TASKS.filter((t) => t.kind === k).length]));
  assert.deepEqual(counts, { easy: 6, subtle: 6, weak: 6, notest: 3, ambiguous: 3 });
  assert.equal(manifest().hash, manifest().hash);
  assert.notEqual(manifest(TASKS.slice(1)).hash, manifest().hash);
});

for (const task of TASKS) {
  test(`${task.id}: starter fails, reference passes, wrong fails`, { skip: task.lang === "python" && !hasPython ? "python3 missing" : false }, () => {
    assert.equal(verdict(task, tree(task, null)), 1, "the starter must fail the verifier");
    assert.equal(verdict(task, tree(task, task.solution)), 0, "the reference must pass the verifier");
    if (task.wrong) assert.equal(verdict(task, tree(task, task.wrong)), 1, "the plausible wrong solution must fail the verifier");
    if (task.visible) {
      assert.notEqual(visible(task, tree(task, null)), 0, "the visible tests must fail on the starter");
      assert.equal(visible(task, tree(task, task.solution)), 0, "the visible tests must pass on the reference");
      if (task.wrong) assert.equal(visible(task, tree(task, task.wrong)), 0, "the visible tests must pass the wrong solution, or it is not a weak test");
    }
  });
}
