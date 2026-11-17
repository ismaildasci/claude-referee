// Silent success reading for npm-echoed eslint and oxlint (docs/decisions/silent-success-reading.md): claimed only for the clean shape, never for hidden, redirected or extra output.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEvidence } from "../src/engine/runners/index.ts";

const log = (command: string, tail = "exit code: 0\n", head = "> app@1.0.0 lint"): string => `\n${head}\n> ${command}\n\n${tail}`;
const names = (text: string): string[] => parseEvidence(text).runners.map((r) => r.runner);

test("the real silent shapes are a clean run of eslint or oxlint, build-only, with a summary that says it printed nothing", () => {
  const eslint = parseEvidence(log('eslint --ext ".js,.vue" --ignore-path .gitignore . --cache'));
  assert.equal(eslint.trust, "parsed");
  assert.equal(eslint.exit_code, 0);
  assert.deepEqual(eslint.runners.map((r) => [r.runner, r.errors, r.warnings, r.failed, r.build_only, r.summary_line]), [["eslint", 0, 0, 0, true, "eslint printed no diagnostics and exited 0"]]);
  assert.deepEqual(names(log("oxlint src/ test/")), ["oxlint"]);
  assert.deepEqual(names(log("eslint . --max-warnings 0")), ["eslint"]);
  assert.deepEqual(names(log("eslint .", "npm run lint exit code: 0\n")), ["eslint"]);
});

test("flags that hide, redirect or change output, and shell operators, are not claimed", () => {
  for (const command of ["eslint --quiet .", "eslint -q .", "oxlint --silent src", "eslint --format json .", "eslint -f json .", "eslint . --output-file out.txt", "eslint . -o out.txt", "eslint --fix .", "eslint . --no-error-on-unmatched-pattern", "oxlint --no-error-on-unmatched-pattern src", "eslint . || true", "eslint . ; true", "eslint . && echo ok", "eslint . > out.txt", "eslint . | tee out.txt", "eslint $(pwd)"]) {
    assert.deepEqual(names(log(command)), [], command);
    assert.equal(parseEvidence(log(command)).trust, "exit_code", command);
  }
  assert.deepEqual(names(log("prettier --check .")), []);
  assert.deepEqual(names(log("npx eslint .")), []);
});

test("extra output, a non-zero or missing exit, a second script and printed warnings are not claimed", () => {
  assert.deepEqual(names(log("eslint .", "eslint: 131 files, 0 errors\nexit code: 0\n")), []);
  assert.deepEqual(names(log("oxlint src/", "src/a.ts:7:42: warning eslint(no-useless-escape): Unnecessary escape\nexit code: 0\n")), []);
  assert.deepEqual(names(log("eslint .", "exit code: 1\n")), []);
  assert.deepEqual(names(log("eslint .", "")), []);
  assert.deepEqual(names(log("eslint .", "exit code: 0\nexit code: 2\n")), []);
  assert.deepEqual(names(`${log("eslint .")}${log("oxlint src/", "exit code: 0\n", "> app@1.0.0 lint2")}`), []);
  assert.deepEqual(names("exit code: 0\n"), []);
});

test("pnpm's head, which adds the folder and may lack a name or version, is read; other text after the script name is not a head", () => {
  for (const head of ["> web@1.0.0 lint /home/dev/my app", "> web@1.0.0 lint ~/code/web", "> @ lint /srv/web", "> web@ lint /srv/web", "> @scope/web@1.0.0 lint C:\\code\\web"]) {
    assert.deepEqual(names(log('eslint --ext ".js,.vue" --ignore-path .gitignore . --cache', "exit code: 0\n", head)), ["eslint"], head);
  }
  for (const head of ["> web@1.0.0 lint and more", "> web@1.0.0 lint ./relative", "> web@1.0.0 lint src"]) assert.deepEqual(names(log("eslint .", "exit code: 0\n", head)), [], head);
  const pnpm = "> web@1.0.0 lint /srv/web";
  for (const command of ["eslint . --quiet", "eslint . -f json", "eslint . --fix", "eslint . || true"]) assert.deepEqual(names(log(command, "exit code: 0\n", pnpm)), [], command);
  assert.deepEqual(names(log("oxlint src/", "src/a.ts:7:42: warning eslint(no-useless-escape): Unnecessary escape\nexit code: 0\n", pnpm)), []);
  assert.deepEqual(names(log("eslint .", "eslint: 131 files, 0 errors\nexit code: 0\n", pnpm)), []);
  assert.deepEqual(names(log("eslint .", "exit code: 1\n", pnpm)), []);
  assert.deepEqual(names(`${log("eslint .", "exit code: 0\n", pnpm)}${log("oxlint src/", "exit code: 0\n", "> web@1.0.0 lint2 /srv/web")}`), []);
});

test("a combined log with test output keeps its own reading", () => {
  const combined = `${log("eslint .", "npm run lint exit code: 0\n")}\nℹ tests 3\nℹ pass 3\nℹ fail 0\n`;
  assert.deepEqual(names(combined).filter((n) => n === "eslint"), []);
});
