// The plugin validation filter ignores only the known reserved-name error for claude-referee and fails on anything else.

import assert from "node:assert/strict";
import { test } from "node:test";
import { unexpectedProblems } from "../scripts/validate-plugin.mjs";

const known = {
  path: "plugins[0].name",
  message: 'Plugin name "claude-referee" is reserved: it passes as one of Anthropic\'s own. Name it for what it does.',
};

test("known reserved-name error passes", () => {
  assert.equal(unexpectedProblems({ success: false, manifest: { errors: [known], warnings: [] } }).length, 0);
});

test("unrelated error or warning fails", () => {
  assert.equal(unexpectedProblems({ manifest: { errors: [known, { path: "plugins.0.source", message: "Invalid input" }] } }).length, 1);
  assert.equal(unexpectedProblems({ manifest: { errors: [known], warnings: [{ message: "missing metadata" }] } }).length, 1);
});

test("reserved-name error for another plugin fails", () => {
  const other = { message: 'Plugin name "claude-other" is reserved: it passes as one of Anthropic\'s own.' };
  assert.equal(unexpectedProblems({ manifest: { errors: [other] } }).length, 1);
});

test("failure without a listed problem fails", () => {
  assert.equal(unexpectedProblems({ success: false }).length, 1);
});
