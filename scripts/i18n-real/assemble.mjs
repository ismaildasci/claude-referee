// Step 4 of the i18n real-code hold-out: blind labels back to ids, the registered scored label per item, and the suite.
// Usage: node assemble.mjs --out DIR --labels1 FILE --labels2 FILE --suite DIR [--part dev|holdout]. Writes the suite's cases.jsonl, labels-1.jsonl, labels-2.jsonl, dropped.json, agreement.json.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { kappa } from "../real-ci/lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const OUT = flag("out");
const SUITE = flag("suite");
if (!OUT || !SUITE || !flag("labels1") || !flag("labels2")) throw new Error("--out, --labels1, --labels2 and --suite are required");
const jsonl = (file) => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const prefix = flag("part") ? `${flag("part")}-` : "";
const split = flag("part") ?? "holdout";
const items = jsonl(join(OUT, `${prefix}items.jsonl`));
mkdirSync(SUITE, { recursive: true });

const labels = [1, 2].map((n) => {
  const keys = JSON.parse(readFileSync(join(OUT, "keys", `${prefix}labeller-${n}.json`), "utf8"));
  const rows = jsonl(flag(`labels${n}`));
  const byId = new Map();
  for (const r of rows) {
    const id = keys[r.key];
    if (id === undefined) throw new Error(`labeller ${n}: unknown key ${r.key}`);
    if (byId.has(id)) throw new Error(`labeller ${n}: key ${r.key} twice`);
    if (r.label !== "yes" && r.label !== "no") throw new Error(`labeller ${n}: label ${r.label} for ${r.key}`);
    byId.set(id, { id, label: r.label, low_confidence: r.low_confidence === true, why: String(r.reason ?? "") });
  }
  const missing = items.filter((i) => !byId.has(i.id)).map((i) => i.id);
  if (missing.length > 0) throw new Error(`labeller ${n}: ${missing.length} items unlabelled`);
  writeFileSync(join(SUITE, `labels-${n}.jsonl`), items.map((i) => JSON.stringify(byId.get(i.id))).join("\n") + "\n");
  return byId;
});

const cases = [];
const dropped = { y_both_no: [], o_disagree: [] };
for (const i of items) {
  const [a, b] = [labels[0].get(i.id).label, labels[1].get(i.id).label];
  let expected;
  if (i.origin === "Y") {
    if (a === "no" && b === "no") { dropped.y_both_no.push(i.id); continue; }
    expected = "yes";
  } else {
    if (a !== b) { dropped.o_disagree.push(i.id); continue; }
    expected = a;
  }
  cases.push({ id: i.id, split, expected, repo: i.repo, framework: i.framework, origin: i.origin, contains_removed_value: i.contains_removed_value, kind: i.kind, text: i.text, context: i.context });
}
writeFileSync(join(SUITE, "cases.jsonl"), cases.map((c) => JSON.stringify(c)).join("\n") + "\n");
writeFileSync(join(SUITE, "dropped.json"), `${JSON.stringify(dropped, null, 1)}\n`);

const agreement = {};
for (const [name, filter] of [["all", () => true], ["Y", (i) => i.origin === "Y"], ["O", (i) => i.origin === "O"], ["O_flagged", (i) => i.origin === "O" && i.contains_removed_value], ["O_unflagged", (i) => i.origin === "O" && !i.contains_removed_value]]) {
  const list = items.filter(filter);
  const pairs = list.map((i) => [labels[0].get(i.id).label, labels[1].get(i.id).label]);
  agreement[name] = {
    n: list.length,
    agree: pairs.filter(([x, y]) => x === y).length,
    kappa: kappa(pairs),
    yes_1: pairs.filter(([x]) => x === "yes").length,
    yes_2: pairs.filter(([, y]) => y === "yes").length,
    low_confidence_1: list.filter((i) => labels[0].get(i.id).low_confidence).length,
    low_confidence_2: list.filter((i) => labels[1].get(i.id).low_confidence).length,
  };
}
agreement.y_with_one_no = items.filter((i) => i.origin === "Y" && [labels[0], labels[1]].filter((l) => l.get(i.id).label === "no").length === 1).map((i) => i.id);
writeFileSync(join(SUITE, "agreement.json"), `${JSON.stringify(agreement, null, 1)}\n`);
console.error(`cases ${cases.length} (yes ${cases.filter((c) => c.expected === "yes").length}, no ${cases.filter((c) => c.expected === "no").length}); dropped Y ${dropped.y_both_no.length}, O ${dropped.o_disagree.length}`);
