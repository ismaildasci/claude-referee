// Hard-task study set: counts, disjointness from the base-rate tasks, and the contract per task (starter fails, reference passes, wrong fails, visible tests pass the wrong one).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { HARD_KINDS } from "../scripts/session-study/hard.mjs";
import { HARD_TASKS, TASKS, manifest, validateTasks, verifierCommand, verifierExt, verifierSource, visibleCommand, type Task } from "../scripts/session-study/tasks.mjs";

const hasPython = spawnSync("python3", ["--version"]).status === 0;
const base = mkdtempSync(join(tmpdir(), "study-hard-"));

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

function verdict(task: Task, dir: string): number | null {
  const path = join(base, `verify-${task.id}.${verifierExt(task)}`);
  writeFileSync(path, verifierSource(task));
  const [cmd, args] = verifierCommand(task, path, dir);
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 60_000, env: { ...process.env, TZ: "UTC" } }).status;
}

function visible(task: Task, dir: string): number | null {
  const found = visibleCommand(task);
  if (!found) return null;
  const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
  return spawnSync(found[0], found[1], { cwd: dir, env, encoding: "utf8", timeout: 60_000 }).status;
}

test("the hard set is well formed, sized as registered and disjoint from the base-rate tasks", () => {
  assert.deepEqual(validateTasks(HARD_TASKS, HARD_KINDS, ["node", "python", "shell"]), []);
  assert.ok(HARD_TASKS.length >= 30);
  assert.equal(HARD_TASKS.length, 32);
  const langs = Object.fromEntries(["node", "python", "shell"].map((l) => [l, HARD_TASKS.filter((t) => t.lang === l).length]));
  assert.deepEqual(langs, { node: 15, python: 14, shell: 3 });
  const kinds = Object.fromEntries(HARD_KINDS.map((k) => [k, HARD_TASKS.filter((t) => t.kind === k).length]));
  assert.deepEqual(kinds, { hidden: 10, weakvis: 7, trap: 9, multifile: 6 });
  assert.ok(HARD_TASKS.every((t) => t.id.startsWith("h-")));
  const title = (t: Task) => (t.files["README.md"] ?? "").split("\n")[0] ?? "";
  const earlier = new Set(TASKS.flatMap((t) => [t.id, t.prompt, title(t)]));
  for (const t of HARD_TASKS) for (const key of [t.id, t.prompt, title(t)]) assert.equal(earlier.has(key), false, `${t.id} reuses ${key}`);
  assert.equal(new Set(HARD_TASKS.map(title)).size, HARD_TASKS.length, "README titles are unique");
  assert.equal(manifest(HARD_TASKS).hash, manifest(HARD_TASKS).hash);
  assert.equal(HARD_TASKS.filter((t) => !t.visible).length >= 22, true, "most tasks have no visible tests");
});

for (const task of HARD_TASKS) {
  test(`${task.id}: starter fails, reference passes, wrong fails`, { skip: task.lang === "python" && !hasPython ? "python3 missing" : false }, () => {
    assert.equal(verdict(task, tree(task, null)), 1, "the starter must fail the verifier");
    assert.equal(verdict(task, tree(task, task.solution)), 0, "the reference must pass the verifier");
    assert.ok(task.wrong, "every hard task has a plausible wrong solution");
    assert.equal(verdict(task, tree(task, task.wrong)), 1, "the plausible wrong solution must fail the verifier");
    if (task.visible) {
      assert.notEqual(visible(task, tree(task, null)), 0, "the visible tests must fail on the starter");
      assert.equal(visible(task, tree(task, task.solution)), 0, "the visible tests must pass on the reference");
      assert.equal(visible(task, tree(task, task.wrong)), 0, "the visible tests must pass the wrong solution");
    }
    assert.equal(task.kind === "weakvis", task.visible, "visible tests exist exactly for the weak-visible-test kind");
  });
}
