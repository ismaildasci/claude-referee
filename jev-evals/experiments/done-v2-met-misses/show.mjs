import { readFileSync } from "node:fs";
const R = "<repo>";
const { parseEvidence } = await import(R + "/src/engine/runners/index.ts");
const { doneEvidence } = await import(R + "/src/cli/commands/done.ts");
const cases = readFileSync(R + "/jev-evals/done-v2/cases.jsonl", "utf8").trim().split("\n").map(JSON.parse);
for (const id of process.argv.slice(2)) {
  const c = cases.find((x) => x.id === id);
  const ev = doneEvidence(c.evidence);
  const p = parseEvidence(ev);
  console.log("=====", id, c.variant, "\n", ev, "\n--- facts:", JSON.stringify({ trust: p.trust, exit_code: p.exit_code, exit_lines: p.exit_lines, runners: p.runners, conflict: p.conflict, lines: p.lines }));
}
