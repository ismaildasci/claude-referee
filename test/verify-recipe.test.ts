// Checks the copyable verify skill recipe: valid frontmatter, pipes to done, and is linked from the READMEs.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ALLOWED = new Set(["name", "description", "when_to_use", "argument-hint", "arguments", "disable-model-invocation", "user-invocable", "allowed-tools", "disallowed-tools", "model", "effort", "context", "agent", "background", "hooks", "paths", "shell", "metadata", "license", "compatibility"]);

test("recipe frontmatter is valid and the skill is named verify", () => {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(read("docs/recipes/verify/SKILL.md"));
  assert.ok(m, "frontmatter block");
  const fields = Object.fromEntries((m[1] as string).split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
  assert.equal(fields.name, "verify");
  assert.ok((fields.description ?? "").length > 20 && (fields.description ?? "").length <= 1024);
  for (const k of Object.keys(fields)) assert.ok(ALLOWED.has(k), `unknown field ${k}`);
});

test("recipe pipes test output to done and the docs link it", () => {
  assert.match(read("docs/recipes/verify/SKILL.md"), /echo "exit code: \$\?"; \} 2>&1 \| npx claude-referee done .*--evidence -/);
  assert.doesNotMatch(read("docs/verify-skill.md"), /Not on npm yet/);
  assert.doesNotMatch(read("docs/recipes/verify/SKILL.md"), /Until the package is on npm|npx 404/);
  assert.match(read("docs/verify-skill.md"), /privacy\.md/);
  for (const f of ["README.md", "README.tr.md"]) assert.match(read(f), /docs\/verify-skill\.md/);
  assert.match(read("docs/verify-skill.md"), /recipes\/verify\/SKILL\.md/);
  assert.match(read("docs/verify-skill.md"), /code\.claude\.com\/docs\/en\/changelog/);
});
