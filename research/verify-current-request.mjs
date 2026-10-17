// Replay retained PUBLIC actual outputs through the real parser/tool. Does not run inference.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {planDialogueMessages} from '../design/prototype/src/conversation.ts';
import {inspectTextMessages,applyTextTransform} from '../design/prototype/src/text-transform.ts';
import {parseJSON} from '../dist/core.js';
const report=name=>JSON.parse(fs.readFileSync('research/evaluations/'+name+'-3ed5b4802c79ade6.json','utf8'));
const probe=report('current-request-routing-probe'),separate=probe.results.find(r=>r.id==='separate-transform'),payload=JSON.parse(separate.input[1].content.split('\n').slice(1).join('\n'));
const context={summary:payload.summary,refs:[],turnCount:payload.turnCount,lastAnswerIndex:payload.lastAnswerIndex,recalled:payload.originalEarlierExcerpts,recent:payload.recent.map((t,i)=>({id:'public-'+i,...t}))};
assert.ok(JSON.stringify(planDialogueMessages(separate.input.at(-1).content,context))===JSON.stringify(separate.input),'Production planner input differs from actual tested separate carrier');
const old=parseJSON(probe.results.find(r=>r.id==='old-transform').answer),current=parseJSON(separate.answer);assert.equal(old.historyIndex,13);assert.equal(current.historyIndex,73);assert.equal(current.historyPart,'assistant');assert.equal(current.action,'recall');
const operations=report('current-request-operations-read');for(const r of operations.results){assert.equal(r.error,'');assert.equal(r.raw.stopped,false);const args=JSON.parse(r.input.at(-1).content),original={turnId:'public',turnIndex:r.id.endsWith('-split')?73:0,speaker:r.id.endsWith('-split')?'assistant':'user',quote:args.text,start:0,end:args.text.length};assert.ok(JSON.stringify(inspectTextMessages(args.instruction,original))===JSON.stringify(r.input),'Production original-processing input differs from actual tested candidate');if(r.id.endsWith('-split'))assert.equal(applyTextTransform(r.answer,original).answer,'ORCHID\n5821');else assert.deepEqual(parseJSON(r.answer),{action:'read'});}
console.log(JSON.stringify({sourceMatchesActualTestedInputs:true,oldWrongTarget:13,separateTarget:73,separateStillRecall:true,actualToolOutputSplitsExactOriginal:true,actualReadDecisionHasNoAnswer:true,scope:'retained public GPU outputs and current production message builders; no new inference or general semantic guarantee'}));
