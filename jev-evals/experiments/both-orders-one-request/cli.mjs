// Arm V collector: runs the built CLI's decide end to end (fresh, scratch data dir) per case. Appends to cli.jsonl. Usage: node cli.mjs [limit]
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const S = "<scratchpad>/both-orders-one-request";
const limit = Number(process.argv[2] ?? 1e9);
const cases = readFileSync("jev-evals/decide-close/cases.jsonl", "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const done = new Set(existsSync(`${S}/cli.jsonl`) ? readFileSync(`${S}/cli.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
for (const c of cases.slice(0, limit)) {
  if (done.has(c.id)) continue;
  writeFileSync(`${S}/cli-in.json`, JSON.stringify({ decision: c.decision, context: c.context, options: c.options }));
  const t0 = performance.now();
  const out = execFileSync("node", ["plugins/evidence-referee/dist/cli.mjs", "decide", "--in", `${S}/cli-in.json`, "--fresh", "--data-dir", `${S}/data`], { encoding: "utf8" });
  const wall_ms = performance.now() - t0;
  const r = JSON.parse(out.trim().split("\n").pop());
  appendFileSync(`${S}/cli.jsonl`, JSON.stringify({ id: c.id, ok: r.ok, verdict: r.verdict, lean: r.lean, p: r.p, order_disagrees: r.order_disagrees, wall_ms, keys: Object.keys(r) }) + "\n");
}
