// Writes jev-evals/decide-close/subsets.json (full set, S1 strict closeness, S2 one per source) from the cases and the two screening reports. Offline and deterministic.
// Usage: node scripts/close-subsets.mjs [--cases file] [--screens r1.json,r2.json] [--out file]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildSubsets, sourceClusters } from "./order-analysis.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const casesPath = flag("--cases", "jev-evals/decide-close/cases.jsonl");
const screens = flag("--screens", "jev-evals/decide-close/screen-r1.json,jev-evals/decide-close/screen-r2.json").split(",");
const out = flag("--out", "jev-evals/decide-close/subsets.json");

const cases = readFileSync(casesPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const subsets = buildSubsets(cases, screens.map((s) => JSON.parse(readFileSync(s, "utf8"))));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(subsets, null, 1) + "\n");
console.log(`full ${subsets.full.length}, S1 ${subsets.S1.length}, S2 ${subsets.S2.length}; wrote ${out}`);
const c = sourceClusters(cases);
console.log(`${c.cases_in_multi_case_sources} of ${c.cases} cases come from ${c.multi_case_sources} source decisions with more than one case (${c.sources.map((x) => `${x.source} ${x.cases}`).join(", ")})`);
