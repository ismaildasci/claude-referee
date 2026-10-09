// The docs watcher's pure parts: page facts and the comparison with recorded hashes. The fetch itself runs weekly in CI.

import assert from "node:assert/strict";
import { test } from "node:test";
import { compare, facts, infoNotes, latestRelease, sha256 } from "../scripts/docs-watch.mjs";

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

test("latestRelease reads the newest version from Markdown and from the HTML heading form, and nothing from text without a release", () => {
  assert.deepEqual(latestRelease("# Changelog\n\n## v0.6.0 (2026-09-15)\n\n### Breaking\n\n## v0.5.7 (2026-09-11)\n"), { version: "0.6.0", date: "2026-09-15" });
  assert.deepEqual(latestRelease('<h2 id="v073-2026-10-09">\n  v0.7.3 (2026-10-09)\n</h2>\n## v0.7.2 (2026-09-26)'), { version: "0.7.3", date: "2026-10-09" });
  assert.equal(latestRelease("# Changelog\n\nNothing yet."), null);
});

test("a changed SDK version gives a notice and is not a changed page; the jaggedness page date is a fact", () => {
  const recorded = { python: { version: "0.7.3", date: "2026-10-09" }, javascript: { version: "0.6.0", date: "2026-09-15" } };
  assert.deepEqual(infoNotes(recorded, recorded), []);
  const notes = infoNotes(recorded, { ...recorded, python: { version: "0.8.0", date: "2026-10-20" } });
  assert.equal(notes.length, 1);
  assert.match(notes[0] ?? "", /python SDK is now 0\.8\.0 \(2026-10-20\), was 0\.7\.3/);
  assert.match(infoNotes(recorded, { ...recorded, javascript: null })[0] ?? "", /javascript SDK changelog could not be read/);
  assert.match(infoNotes(undefined, recorded)[0] ?? "", /unrecorded/);
  const page = "model-jaggedness/jev-1.13.md";
  const text = "# Jev 1.13 jaggedness\n**Applies to `jev-1.13`.** Last reviewed 2026-10-02.\n";
  assert.deepEqual(facts(page, text), { reviewed: "2026-10-02" });
  const entry = (t: string) => ({ sha256: sha256(t), facts: facts(page, t) });
  assert.equal(compare({ [page]: entry(text) }, { [page]: entry(text.replace("10-02", "10-20")) })[0]?.page, page);
});
