// Compare baseline (repo recorded.jsonl latest) vs variant recorded for one split dir.
import { readFileSync } from "node:fs";
const R="<repo>", S=process.argv[2], dir=process.argv[3];
const { parseEvidence } = await import(R+"/src/engine/runners/index.ts");
const { doneEvidence } = await import(R+"/src/cli/commands/done.ts");
const L=(f)=>readFileSync(f,"utf8").trim().split("\n").map(JSON.parse);
const cases=L(`${S}/${dir}/done-v2/cases.jsonl`), base=L(R+"/jev-evals/done-v2/recorded.jsonl"), v=L(`${S}/${dir}/done-v2/recorded.jsonl`);
const verd=(p,t,cf)=>{const r=p>=0.7?"met":p<0.5?"missing":"unsure";return r==="met"&&(t==="unparsed"||cf)?"unsure":r};
let out=[],tot={bm:0,vm:0,bw:0,vw:0,E:0};
for(const c of cases){const bp=base.filter(x=>x.case===c.id).pop().answers.c1.noul;const vp=v.filter(x=>x.case===c.id).pop().answers.c1.noul;
 const pe=parseEvidence(doneEvidence(c.evidence));const bv=verd(bp,pe.trust,pe.conflict),vv=verd(vp,pe.trust,pe.conflict);
 if(c.expected==="met"){tot.E++;if(bv==="met")tot.bm++;if(vv==="met")tot.vm++}else{if(bv==="met")tot.bw++;if(vv==="met")tot.vw++}
 out.push({id:c.id,exp:c.expected,trust:pe.trust,base:bp,var:vp,bv,vv});}
console.table(out.filter(r=>Math.abs(r.base-r.var)>=0.1||r.exp==="met"&&(r.bv!=="met"||r.vv!=="met")||r.exp!=="met"&&r.var>=0.5));
console.log(JSON.stringify(tot));
console.log("mean |dp|",(out.reduce((s,r)=>s+Math.abs(r.base-r.var),0)/out.length).toFixed(3),"max",Math.max(...out.map(r=>Math.abs(r.base-r.var))).toFixed(2));
console.log("non-met parsed/exit max var p:",Math.max(...out.filter(r=>r.exp!=="met"&&r.trust!=="unparsed").map(r=>r.var)));
