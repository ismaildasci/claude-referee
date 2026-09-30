# Joins labelled claims with decide's three-way answers and picks the lowest supports threshold that keeps no false claim.
import json, os
cases = [json.loads(l) for l in open("jev-evals/claims/cases.jsonl")]
rows, reqs, est_tok = [], 0, 0
for c in cases:
    o = json.load(open(f"jev-evals/claims/out/{c['id']}.json"))
    assert o.get("ok"), (c["id"], o)
    p = o["p"]; reqs += o.get("requests", 0)
    body = json.load(open(f"jev-evals/claims/in/{c['id']}.json"))
    est_tok += 2 * (len(json.dumps(body)) // 3 + 120)
    rows.append({"id": c["id"], "label": c["label"], "covers": c["excerpt_covers"], "supports": p.get("supports", 0),
                 "contradicts": p.get("contradicts", 0), "says_nothing": p.get("says_nothing", 0),
                 "lean": o.get("lean"), "verdict": o.get("verdict"), "order_disagrees": o.get("order_disagrees")})
def table(sub):
    out = []
    for i in range(10):
        t = round(0.50 + 0.05 * i, 2)
        out.append({"t": t, "true_kept": sum(r["label"] and r["supports"] >= t for r in sub),
                    "true_total": sum(r["label"] for r in sub), "false_kept": sum((not r["label"]) and r["supports"] >= t for r in sub)})
    safe = next((x for x in out if x["false_kept"] == 0), None)
    return out, safe
covered = [r for r in rows if r["covers"]]
tc, sc = table(covered); ta, sa = table(rows)
summary = {"cases": len(rows), "requests": reqs, "est_input_tokens": est_tok, "est_cost_usd": round(est_tok * 0.042 / 1e6, 6),
           "lowest_safe_t_covered": sc, "lowest_safe_t_all": sa,
           "false_top_supports": sorted(({"id": r["id"], "supports": r["supports"], "lean": r["lean"]} for r in rows if not r["label"]), key=lambda x: -x["supports"])[:5],
           "false_lean": {k: sum(1 for r in rows if not r["label"] and r["lean"] == k) for k in ("supports", "contradicts", "says_nothing")},
           "uncovered_lean": {k: sum(1 for r in rows if not r["covers"] and r["lean"] == k) for k in ("supports", "contradicts", "says_nothing")},
           "true_covered_lean": {k: sum(1 for r in covered if r["label"] and r["lean"] == k) for k in ("supports", "contradicts", "says_nothing")},
           "order_disagrees": sum(1 for r in rows if r["order_disagrees"])}
json.dump({"date": "2026-10-01", "model": "jev-1.13.0", "method": "decide with options supports/contradicts/says_nothing, two orders averaged",
           "summary": summary, "table_covered": tc, "table_all": ta, "rows": rows}, open("results/claims-calibration-2026-10-01.json", "w"), indent=1)
print(json.dumps(summary, indent=1))
print("t    covered(true_kept/total, false_kept)   all(true_kept/total, false_kept)")
for a, b in zip(tc, ta): print(f"{a['t']:.2f}  {a['true_kept']}/{a['true_total']}, {a['false_kept']}    {b['true_kept']}/{b['true_total']}, {b['false_kept']}")
for r in rows: print(r["id"], "T" if r["label"] else "F", "cov" if r["covers"] else "unc", f"s={r['supports']:.2f} c={r['contradicts']:.2f} n={r['says_nothing']:.2f}", r["verdict"], "DIS" if r["order_disagrees"] else "")
