import { readFileSync, writeFileSync } from "node:fs";
const D = new URL(".", import.meta.url).pathname;
const rows = readFileSync(D + "live.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const dec = (v) => (String(v).split(".")[1] || "").length;
const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(4), median: s[Math.floor((s.length - 1) / 2)] , max: s.at(-1), gt001: s.filter((x) => x > 0.01 + 1e-9).length, ge002: s.filter((x) => x >= 0.02 - 1e-9).length, ge004: s.filter((x) => x >= 0.04 - 1e-9).length }; };
const out = { B1: {}, B2: {}, B4: null };
const per = [];
let maxdec = 0;
for (const id of [...new Set(rows.filter((r) => r.part === "B1").map((r) => r.id))]) {
  const rs = rows.filter((r) => r.part === "B1" && r.id === id); const opts = Object.keys(rs[0].p);
  for (const r of rs) for (const v of Object.values(r.p)) maxdec = Math.max(maxdec, dec(v));
  const rangeBy = Object.fromEntries(opts.map((o) => { const v = rs.map((r) => r.p[o]); return [o, +(Math.max(...v) - Math.min(...v)).toFixed(4)]; }));
  const leaders = rs.map((r) => Object.entries(r.p).sort((a, b) => b[1] - a[1])[0][0]);
  const lead = Object.entries(rs[0].p).sort((a, b) => b[1] - a[1])[0][0];
  per.push({ id, reps: rs.length, range_max_option: Math.max(...Object.values(rangeBy)), range_by_option: rangeBy, distinct_leaders: new Set(leaders).size, leader_p_series: rs.map((r) => Math.max(...Object.values(r.p))) });
}
out.B1.per_case = per; out.B1.stat_range = stat(per.map((p) => p.range_max_option)); out.B1.max_decimals_in_raw_api_p = maxdec;
out.B1.cases_with_leader_change = per.filter((p) => p.distinct_leaders > 1).length;
const b2 = [...new Set(rows.filter((r) => r.part === "B2").map((r) => r.id))].map((id) => { const rs = rows.filter((r) => r.part === "B2" && r.id === id); const p = rs.map((r) => r.p); return { id, series: p, range: +(Math.max(...p) - Math.min(...p)).toFixed(4), verdicts: [...new Set(rs.map((r) => r.verdict))] }; });
out.B2.per_case = b2; out.B2.stat_range = stat(b2.map((x) => x.range));
out.B4 = rows.find((r) => r.part === "B4");
writeFileSync(D + "partB.json", JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
