// Retained public observation integrity only; never new/model-quality inference.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {parseHarnessCases} from '../design/prototype/src/harness-fixtures.ts';
import {parseJSON} from '../dist/core.js';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=json('dist/model-manifest.json'),pin=manifest.models.find(m=>m.id==='2B');
function check(file,fixtureFile,status,length){
 const report=json('research/evaluations/'+file),fixtures=parseHarnessCases(fs.readFileSync('research/fixtures/'+fixtureFile,'utf8'));
 assert.equal(report.model,pin.id);assert.equal(report.revision,pin.revision);assert.equal(report.runtime,manifest.runtime.revision);assert.equal(report.contextTokens,manifest.contextTokens);assert.equal(report.status,status);assert.equal(report.results.length,length);
 for(let i=0;i<report.results.length;i++){const r=report.results[i],f=fixtures[i];assert.equal(r.id,f.id);assert.deepEqual(r.input,f.messages);assert.equal(r.expected,null);assert.equal(r.pass,null);assert.equal(r.profile,'greedy');assert.equal(r.resetSession,true);assert.equal(r.maxTokens,f.maxTokens??256);if(f.json)assert.equal(parseJSON(r.raw.text).answer,r.answer);else assert.equal(r.raw.text,r.answer);assert.equal(r.error,'');assert.equal(r.raw.stopped,false);assert.equal(r.count.prompt_tokens,r.raw.usage.prompt_tokens);assert.ok(r.count.prompt_tokens+r.maxTokens<=report.contextTokens);}
 return report;
}
const main=check('bonsai-2b-a3e7e037d7c773b6.json','bonsai-2b-comparison.json','Completed',8);
const oldFiles=['harness-initial-833486c101132c29.json','current-request-routing-probe-3ed5b4802c79ade6.json','current-request-indexed-5ca20e9c35b7cfc8.json','current-request-routing-controls-3ed5b4802c79ade6.json','current-request-operations-read-3ed5b4802c79ade6.json'];
const originals=oldFiles.flatMap(file=>{const report=json('research/evaluations/'+file);assert.equal(report.model,'4B');assert.equal(report.revision,manifest.models.find(m=>m.id==='4B').revision);assert.equal(report.runtime,manifest.runtime.revision);return report.results;});
for(const r of main.results){const before=originals.find(v=>v.id===r.id);assert.ok(before);assert.deepEqual(r.input,before.input);assert.deepEqual(r.count,before.count);assert.equal(r.maxTokens,before.maxTokens??256);}
const offline=check('bonsai-2b-offline-befd36343feda27d.json','bonsai-2b-offline.json','Completed',1);
const stopped=check('bonsai-2b-stop-befd36343feda27d.json','bonsai-2b-comparison.json','Stopped',1);
assert.throws(()=>parseJSON(main.results.find(r=>r.id==='separate-greeting').raw.text));
assert.equal(parseJSON(main.results.find(r=>r.id==='read-tool-operation-split').raw.text).action,'read');
console.log(JSON.stringify({scope:'retained input/pin/count integrity, not semantic acceptance or new inference',observedCases:main.results.length,offlineAnswer:offline.results[0].answer,stoppedAfterCompletedCases:stopped.results.length,knownFailures:{greetingInvalidJSON:true,splitMisclassifiedRead:true}},null,2));
