// Part A2: decide margin re-derivation from printed p, and float-edge of the runtime comparison (supplementary, decide-close and decide order files).
import { readFileSync, writeFileSync } from "node:fs";
const out = {};
for (const f of ["decide/order-2026-09-30.json", "decide-close/order-2026-10-01.json"]) {
  const j = JSON.parse(readFileSync("jev-evals/" + f, "utf8"));
  const r = { pairs: 0, margin_derived_from_floor_differs: 0, clear_derived_from_floor_differs: 0, fp_edge_margin: 0, fp_edge_clear: 0, examples: [] };
  for (const d of j.raw) {
    const m = new Map(d.orders.map((o) => [o.order.join(","), o.p]));
    for (const o of d.orders) {
      const rev = m.get([...o.order].reverse().join(",")); if (!rev) continue;
      r.pairs++;
      const mean = Object.keys(o.p).map((n) => [n, (o.p[n] + rev[n]) / 2]).sort((a, b) => b[1] - a[1]);
      const p1 = mean[0][1], p2 = mean[1][1];
      // exact arithmetic in thousandths
      const e1 = Math.round(p1 * 1000), e2 = Math.round(p2 * 1000);
      const exactMargin = e1 - e2 >= 100, exactClear = e1 >= 850;
      const fpMargin = p1 - p2 >= 0.1, fpClear = p1 >= 0.85;
      if (exactMargin !== fpMargin) r.fp_edge_margin++;
      if (exactClear !== fpClear) r.fp_edge_clear++;
      const f1 = Math.floor(p1 * 100 + 1e-9) / 100, f2 = Math.floor(p2 * 100 + 1e-9) / 100;
      const dm = Math.round((f1 - f2) * 100) >= 10;
      if (dm !== exactMargin) { r.margin_derived_from_floor_differs++; if (r.examples.length < 8) r.examples.push({ id: d.id, raw: [p1, p2], printed: [f1, f2], rawMarginOK: exactMargin, printedMarginOK: dm }); }
      if ((f1 >= 0.85 - 1e-9) !== exactClear) r.clear_derived_from_floor_differs++;
    }
  }
  out[f] = r;
}
writeFileSync(new URL("partA2.json", import.meta.url), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
