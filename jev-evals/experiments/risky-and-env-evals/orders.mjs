import { load } from "./score.mjs";
for (const [v,k] of [["risky-rc","rc"],["env-ec","ec"]]) {
  const { rec, cases } = load(v);
  const P = (a) => k==="rc" ? 1-(a.best.probabilities.routine??0) : ["network","tool","permission","resource"].reduce((s,x)=>s+(a.best.probabilities[x]??0),0);
  let dis=0, maxgap=0, singleWp=[0,0], singleWn=[0,0], flips=0; const gaps=[];
  const argmaxDis = [];
  for (const r of rec) { const c=cases[r.case]; const pos = c.expected===(k==="rc"?"risky":"env"); const ps=r.answers.map(P);
    const gap=Math.abs(ps[0]-ps[1]); gaps.push(gap); maxgap=Math.max(maxgap,gap);
    if ((ps[0]>=0.5)!==(ps[1]>=0.5)) dis++;
    ps.forEach((p,i)=>{ if(p>=0.9&&!pos) singleWp[i]++; if(p<=0.1&&pos) singleWn[i]++; });
    const a=r.answers.map(a=>Object.entries(a.best.probabilities).sort((x,y)=>y[1]-x[1])[0][0]); if(a[0]!==a[1]) argmaxDis.push(r.case+":"+a.join("/"));
  }
  console.log(v,{n:rec.length,mean_gap:+(gaps.reduce((s,x)=>s+x,0)/gaps.length).toFixed(3),max_gap:+maxgap.toFixed(2),side_disagreements_at_half:dis,single_order_wp:singleWp,single_order_wn:singleWn,top_category_disagreements:argmaxDis});
}
