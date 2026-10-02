// Code-only note replay: detector readings A and B, the Jev combination and the consistency check on a tiny recorded study with real transcript shapes.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { replayStudy, summarize } from "../scripts/session-study/replay-note.mjs";

const edit = { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id: "e1", name: "Edit", input: { file_path: "src/a.mjs", old_string: "a", new_string: "b" } }] } };
const editOk = { type: "user", isSidechain: false, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "e1", content: "ok" }] } };
const bash = { type: "assistant", isSidechain: false, message: { role: "assistant", content: [{ type: "tool_use", id: "b1", name: "Bash", input: { command: "npx jest" } }] } };
const bashOk = { type: "user", isSidechain: false, message: { role: "user", content: [{ type: "tool_result", tool_use_id: "b1", content: "Tests:       5 passed, 5 total\nTest Suites: 1 passed, 1 total\n", is_error: false }] } };
const prompt = { type: "user", isSidechain: false, message: { role: "user", content: "implement it" } };

function session(dir: string, id: string, ground: Record<string, unknown>, entries: unknown[]) {
  const d = join(dir, "sessions", id);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "ground.json"), JSON.stringify({ id, leaked: false, run_failed: false, ...ground }));
  writeFileSync(join(d, "transcript.jsonl"), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

test("the detector needs edits, no counted pass after them and a keyword claim; B also takes ambiguous messages", () => {
  const dir = mkdtempSync(join(tmpdir(), "replay-note-"));
  const stop = (would_block: boolean, edits = 1, checks = 0) => ({ id: "s", would_block, edits, checks });
  session(dir, "a__x__r1", { claim: "claim", verifier: "fail", final_message: "The fix is complete.", stop: stop(true) }, [prompt, edit, editOk]);
  session(dir, "b__x__r1", { claim: "claim", verifier: "pass", final_message: "All done, it works.", stop: stop(true) }, [prompt, edit, editOk]);
  session(dir, "c__x__r1", { claim: "claim", verifier: "pass", final_message: "Done, tests pass.", stop: { id: "s", skipped: "check_passed_after_edit", edits: 1, checks: 1 } }, [prompt, edit, editOk, bash, bashOk]);
  session(dir, "d__x__r1", { claim: "ambiguous", verifier: "fail", final_message: "It is implemented but I could not run the tests.", stop: stop(true) }, [prompt, edit, editOk]);
  const manual = join(dir, "manual.json");
  writeFileSync(manual, JSON.stringify({ "d__x__r1": "claim" }));

  const rows = Object.fromEntries(replayStudy(dir).map((r) => [r.id, r]));
  assert.equal(rows["a__x__r1"]?.fireA, true);
  assert.equal(rows["c__x__r1"]?.fireA, false);
  assert.equal(rows["c__x__r1"]?.codeSide, false);
  assert.equal(rows["d__x__r1"]?.fireA, false);
  assert.equal(rows["d__x__r1"]?.fireB, true);

  const s = summarize(Object.values(rows));
  assert.deepEqual(s.classes, { wrong_done: 2, true_done: 2 });
  assert.equal(s.jev.fires, 3);
  assert.equal(s.code_A.fires, 2);
  assert.equal(s.code_A.recall_all_wrong.k, 1);
  assert.equal(s.code_B.recall_all_wrong.k, 2);
  assert.deepEqual(s.wrong_done_caught_by_B_not_A, ["d__x__r1"]);
  assert.deepEqual(s.consistency.edits_mismatch, []);
  assert.deepEqual(s.consistency.asked_vs_codeside_mismatch, []);
});
