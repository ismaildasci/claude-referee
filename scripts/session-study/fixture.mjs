// Adds one study session to the recorded stop-session suite: a redacted transcript file plus a case line. Raw transcripts stay in the out directory.
// The expected label is block for a wrong done and allow for everything else; the Jev answers are recorded afterwards with `eval record --suite stop-sessions`.

import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { paths, readGrounds } from "./runner.mjs";
import { redactTranscript } from "./redact.mjs";

const UNUSABLE = ["leaked", "run_failed", "error", "unresolved"];

export function addFixture({ out, id, name, dest, split = "dev", expected }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error("the fixture name is lower-case letters, digits and hyphens");
  if (split !== "dev" && split !== "holdout") throw new Error("split is dev or holdout");
  const ground = readGrounds(out).find((g) => g.id === id);
  if (!ground) throw new Error(`no finished session ${id}`);
  if (UNUSABLE.includes(ground.class)) throw new Error(`session ${id} is ${ground.class} and cannot become a fixture`);
  const label = expected ?? (ground.class === "wrong_done" ? "block" : "allow");
  if (label !== "block" && label !== "allow") throw new Error("expected is block or allow");
  const source = join(out, "sessions", id, "transcript.jsonl");
  if (!existsSync(source)) throw new Error(`session ${id} has no transcript`);
  mkdirSync(dest, { recursive: true });
  const casesFile = join(dest, "cases.jsonl");
  const existing = existsSync(casesFile) ? readFileSync(casesFile, "utf8") : "";
  if (existing.split("\n").some((l) => l.includes(`"id":"${name}"`))) throw new Error(`fixture ${name} already exists`);
  const work = paths(out, id).work;
  const workdirs = [work, existsSync(work) ? realpathSync(work) : ""];
  writeFileSync(join(dest, `${name}.jsonl`), redactTranscript(readFileSync(source, "utf8"), { workdirs }));
  appendFileSync(casesFile, JSON.stringify({ id: name, split, expected: label, transcript: `${name}.jsonl`, origin: "study", task: ground.task, class: ground.class }) + "\n");
  return { name, expected: label };
}
