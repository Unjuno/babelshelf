// Public fixed input only. Carries ACTUAL previous diagnostic outputs; never reads knowledge storage.
import fs from 'node:fs';import path from 'node:path';
import {compactionMessages,historyPayload} from '../design/prototype/src/conversation.ts';
const cycle=Number(process.argv[2]);if(![1,2,3].includes(cycle))throw Error('Use cycle1..3 and the preceding real harness report for later cycles');
const initial='User code is BIRCH-2468. Folder is '+String.raw`C:\notes\reserve.md`+'. User requested the code on two lines: BIRCH\n2468. Water stock was corrected from 3L to 4L.';
let summaries={old:initial,literal:initial};
if(cycle>1){const previous=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));if(previous.model!=='4B'||previous.status!=='Completed')throw Error('Completed actual4B report required');
 for(const kind of ['old','literal']){const r=previous.results.find(r=>r.id===kind+'-'+(cycle-1));if(!r||r.error||r.raw?.stopped||r.maxTokens!==192||typeof r.answer!=='string'||!r.answer.trim())throw Error('Missing completed case');summaries[kind]=r.answer.trim();}
}
const turns=[{id:'public-'+cycle,user:'Water stock is now 4L after correction from 3L. The exact code, folder and requested two-line rendering remain important.'}],system=compactionMessages('',{turns})[0],projected=historyPayload({summary:'',recent:turns,refs:[]}).recent;
const cases=Object.entries(summaries).map(([kind,summary])=>({id:kind+'-'+cycle,expected:null,json:false,reset:true,maxTokens:192,profile:'greedy',messages:kind==='old'?[system,{role:'user',content:JSON.stringify({earlierSummary:summary,turns:projected})}]:compactionMessages(summary,{turns})}));
const folder=path.resolve('research/fixtures');fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,'compaction-carry-cycle'+cycle+'.json');fs.writeFileSync(target,JSON.stringify({cases},null,2));console.log(target);
if(cycle>1){const report=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));console.log(JSON.stringify(report.results.map(r=>({id:r.id,code:r.answer.includes('BIRCH-2468'),exactPath:r.answer.includes(String.raw`C:\notes\reserve.md`),backslashes:(r.answer.match(/\\/g)||[]).length,longestRun:Math.max(0,...(r.answer.match(/\\+/g)||[]).map(s=>s.length)),text:r.answer})),null,2));}
