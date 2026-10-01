// Usage: node record.mjs <variant> <split|all> [--fresh] [--only id,id]. Records via the built CLI (judge / decide), one data dir per case.
import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const E = dirname(fileURLToPath(import.meta.url));
const CLI = "<repo>/plugins/claude-referee/dist/cli.mjs";
const CAP = 540;
const V = {
  "risky-base": { pack: "base", cases: "risky", mode: "judge", q: "line.risky" },
  "risky-v1": { pack: "v1", cases: "risky", mode: "judge", q: "line.risky" },
  "risky-rc": { pack: "rc", cases: "risky", mode: "decide", opts: "rc" },
  "env-base": { pack: "base", cases: "env", mode: "judge", q: "failure.env" },
  "env-v1": { pack: "v1", cases: "env", mode: "judge", q: "failure.env" },
  "env-ec": { pack: "ec", cases: "env", mode: "decide", opts: "ec" },
};
// extra variants (round 2) are registered in variants-extra.json
const extra = join(E, "variants-extra.json");
if (existsSync(extra)) Object.assign(V, JSON.parse(readFileSync(extra, "utf8")));
const [variant, split, ...rest] = process.argv.slice(2);
const fresh = rest.includes("--fresh");
const only = rest.includes("--only") ? rest[rest.indexOf("--only") + 1].split(",") : null;
const tag = fresh ? process.argv.slice(2).find((a) => a.startsWith("--tag="))?.slice(6) ?? "fresh" : "";
const v = V[variant];
if (!v) throw new Error("unknown variant " + variant);
const opts = JSON.parse(readFileSync(join(E, "cases/choice-options.json"), "utf8"));
const cases = readFileSync(join(E, "cases", v.cases + ".jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((c) => (split === "all" || c.split === split) && (!only || only.includes(c.id)));
const outFile = join(E, "recorded", variant + (tag ? "." + tag : "") + ".jsonl");
mkdirSync(join(E, "recorded"), { recursive: true });
const done = new Set(existsSync(outFile) ? readFileSync(outFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).case) : []);
const spent = () => (existsSync(join(E, "ledger.jsonl")) ? readFileSync(join(E, "ledger.jsonl"), "utf8").trim().split("\n").filter(Boolean).reduce((s, l) => s + JSON.parse(l).requests, 0) : 0);
const run = (args, input) => new Promise((res) => { const p = execFile("node", [CLI, ...args], { cwd: E, env: { ...process.env, REFEREE_PACKS_DIR: join(E, "packs") }, maxBuffer: 1 << 22 }, (err, stdout, stderr) => res({ err, stdout, stderr })); if (input) p.stdin.end(input); });
async function one(c) {
  const dir = join(E, "data", variant + (tag ? "." + tag : ""), c.id);
  mkdirSync(dir, { recursive: true });
  const base = ["--pack", v.pack, "--data-dir", dir];
  if (fresh) base.push("--fresh");
  let r;
  if (v.mode === "judge") {
    const f = join(dir, "items.json");
    writeFileSync(f, JSON.stringify([c.item]));
    r = await run(["judge", "--question", v.q, "--items", f, ...(c.context ? ["--context", c.context] : []), ...base]);
  } else {
    const input = v.opts === "rc"
      ? { decision: "What can this changed diff line do when applied as written?", options: opts.rc, context: `File and change: ${c.context}\nLine: ${c.item}` }
      : { decision: "What most likely caused this test failure?", options: opts.ec, context: c.item };
    const f = join(dir, "decision.json");
    writeFileSync(f, JSON.stringify(input));
    r = await run(["decide", "--in", f, ...base]);
  }
  let out = {};
  try { out = JSON.parse(r.stdout.trim().split("\n").pop()); } catch {}
  const cdir = join(dir, "cache");
  const answers = existsSync(cdir) ? readdirSync(cdir).sort().map((n) => JSON.parse(readFileSync(join(cdir, n), "utf8")).answers) : [];
  const reqs = out.requests ?? 0;
  appendFileSync(join(E, "ledger.jsonl"), JSON.stringify({ variant: variant + (tag ? "." + tag : ""), case: c.id, requests: out.cached ? Math.max(0, reqs - out.cached) : reqs, raw_requests: reqs, cached: out.cached ?? 0, ts: new Date().toISOString() }) + "\n");
  appendFileSync(outFile, JSON.stringify({ variant, case: c.id, split: c.split, stopped: Array.isArray(out.stopped) && out.stopped.length > 0, error: out.ok === false ? out.error : undefined, answers }) + "\n");
}
const todo = cases.filter((c) => !done.has(c.id));
const need = todo.length * (v.mode === "decide" ? 2 : 1);
if (spent() + need > CAP) { console.error(`budget: spent ${spent()} + ${need} > ${CAP}; abort`); process.exit(2); }
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => { while (i < todo.length) await one(todo[i++]); }));
console.log(JSON.stringify({ variant, split, recorded: todo.length, skipped: cases.length - todo.length, spent_total: spent() }));
