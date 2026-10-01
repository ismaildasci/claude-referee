// The docs watcher's pure parts: page facts and the comparison with recorded hashes. The fetch itself runs weekly in CI.

import assert from "node:assert/strict";
import { test } from "node:test";
import { compare, facts, sha256 } from "../scripts/docs-watch.mjs";

const MODELS = "# Models\n\n| Rate limits | 100K tokens per second / 40 requests per second |\n\nUse jev-1.13.0 or jev-latest. jev-1.13.0 again.\n";

test("facts reads the limits row and the model ids from models.md and counts links in llms.txt", () => {
  assert.deepEqual(facts("models.md", MODELS), { rate_limits: "| Rate limits | 100K tokens per second / 40 requests per second |", models: ["jev-1.13.0"] });
  assert.deepEqual(facts("llms.txt", "# TypeSafe AI\n- [A](a)\n- [B](b)\ntext\n"), { links: 2 });
  assert.deepEqual(facts("api.md", "x"), {});
});

test("compare reports only the pages whose hash differs, with the old and new facts", () => {
  const entry = (text: string, page: string) => ({ sha256: sha256(text), facts: facts(page, text) });
  const recorded = { "models.md": entry(MODELS, "models.md"), "api.md": entry("a", "api.md"), "llms.txt": entry("- [A](a)\n", "llms.txt") };
  assert.deepEqual(compare(recorded, { ...recorded }), []);
  const changed = compare(recorded, { ...recorded, "models.md": entry(MODELS.replace("100K", "250K"), "models.md") });
  assert.equal(changed.length, 1);
  assert.equal(changed[0]?.page, "models.md");
  assert.match(JSON.stringify(changed[0]?.now), /250K/);
  assert.match(JSON.stringify(changed[0]?.was), /100K/);
  assert.equal(compare({}, recorded).length, 3);
});
