// Replay retained public observations through the production speaker boundary.
// No inference, knowledge records or expected target substitution.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {subjectMessages,resolveDialogueSubject} from '../design/prototype/src/dialogue-subject.ts';
const report=JSON.parse(fs.readFileSync('research/evaluations/subject-original-befd36343feda27d.json','utf8'));
const fixtures=JSON.parse(fs.readFileSync('research/fixtures/subject-original-comparison.json','utf8')).cases;
const manifest=JSON.parse(fs.readFileSync('dist/model-manifest.json','utf8'));
assert.equal(report.model,'4B');assert.equal(report.revision,manifest.models.find(m=>m.id==='4B').revision);assert.equal(report.runtime,manifest.runtime.revision);assert.equal(report.contextTokens,2048);assert.equal(report.status,'Completed');assert.equal(report.results.length,5);
const outputs=[];
for(let i=0;i<fixtures.length;i++){
 const f=fixtures[i],r=report.results[i];assert.equal(r.id,f.id);assert.deepEqual(r.input,f.messages);assert.equal(r.maxTokens,64);assert.equal(r.expected,null);assert.equal(r.pass,null);assert.equal(r.profile,'greedy');assert.equal(r.resetSession,true);assert.equal(r.raw.stopped,false);assert.equal(r.count.prompt_tokens,r.raw.usage.prompt_tokens);
 const data=JSON.parse(f.messages[1].content.split('\n').slice(1).join('\n'));
 const original=c=>({turnId:'public-'+c.index,turnIndex:c.index,speaker:c.speaker,quote:c.text,start:0,end:c.text.length});
 const a=original(data.A),b=original(data.B),question=f.messages.at(-1).content;
 assert.deepEqual(subjectMessages(question,a,b),f.messages);
 let calls=0;const selected=await resolveDialogueSubject({manifest:{contextTokens:2048},count:async m=>{assert.deepEqual(m,f.messages);return r.count;},generate:async(m,max)=>{calls++;assert.deepEqual(m,f.messages);assert.equal(max,64);return {text:r.raw.text};}},question,a,b);
 if(a.speaker==='assistant'){assert.equal(calls,0);assert.equal(selected.original,a);assert.equal(selected.choice,'unchanged');}
 else{assert.equal(calls,1);assert.equal(selected.original,JSON.parse(r.raw.text).source==='A'?a:b);}
 outputs.push({case:r.id,observedModelSource:JSON.parse(r.raw.text).source,productionChoice:selected.choice});
}
console.log(JSON.stringify({scope:'retained observation/control replay, not new inference or universal target accuracy',outputs,knownFailure:'Broader same-speaker temporal resolver chose B for explicit older assistant and was rejected'},null,2));
