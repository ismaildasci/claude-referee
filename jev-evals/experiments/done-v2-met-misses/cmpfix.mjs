import { readFileSync } from "node:fs";
const R="<repo>", S=process.argv[2];
const a=await import(R+"/src/engine/runners/index.ts"); const b=await import(S+"/srcfix/engine/runners/index.ts");
const cases=readFileSync(R+"/jev-evals/done-v2/cases.jsonl","utf8").trim().split("\n").map(JSON.parse);
const inj=readFileSync(R+"/jev-evals/injection/cases.jsonl","utf8").trim().split("\n").map(JSON.parse);
let n=0,d=0;
for(const c of [...cases,...inj.map(x=>({id:x.id,evidence:x.evidence??x.text??""}))]){ if(!c.evidence)continue; n++;
 const x=JSON.stringify(a.parseEvidence(c.evidence)),y=JSON.stringify(b.parseEvidence(c.evidence));
 if(x!==y){d++;console.log("DIFF",c.id);console.log(JSON.stringify(b.parseEvidence(c.evidence).runners.map(r=>r.runner+":"+r.passed+"/"+r.failed)))}}
console.log("compared",n,"changed",d);
