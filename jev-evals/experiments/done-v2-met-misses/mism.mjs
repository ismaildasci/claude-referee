import { readFileSync } from "node:fs";
const R="<repo>";
const { parseEvidence } = await import(R+"/src/engine/runners/index.ts");
const { doneEvidence } = await import(R+"/src/cli/commands/done.ts");
const rows=JSON.parse(readFileSync(process.argv[2]+"/rows.json","utf8"));
const cases=readFileSync(R+"/jev-evals/done-v2/cases.jsonl","utf8").trim().split("\n").map(JSON.parse);
for(const c of cases){const p=parseEvidence(doneEvidence(c.evidence));const r=rows.find(x=>x.id===c.id);
 if(c.expected!=="met"||p.trust!=="parsed")continue;
 for(const k of p.runners){ if(!k.summary_line||!new RegExp("\\b"+k.passed+"\\b").test(k.summary_line)) console.log("MISMATCH",c.id,r.p,k.runner,k.passed,"|",k.summary_line); }
 if(p.runners.length>1)console.log("PHANTOM?",c.id,r.p,p.runners.map(k=>k.runner+":"+k.passed).join(","));}
